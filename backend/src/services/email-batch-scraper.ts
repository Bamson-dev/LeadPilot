import type { Browser, BrowserContext } from "playwright";
import type { BusinessLead, PredictedEmail, StreamEvent } from "@leadthur/shared";
import {
  createEmailBrowserContext,
  discoverBusinessEmailsCombined,
} from "../scraper/emailCrawler/email-crawler";
import {
  EMAIL_SCRAPE_MAX_MS,
  EMAIL_SCRAPE_TAB_CONCURRENCY,
  EMAIL_SCRAPE_TAB_CONCURRENCY_LARGE,
  MEDIUM_CITY_RESULT_THRESHOLD,
} from "../scraper/utils/constants";
import {
  getAllSearchLeads,
  markBusinessLeadEmailScraped,
  updateBusinessLeadEnrichment,
} from "../database/search-repository";
import { logger } from "../utils/logger";

export type ScrapeEmitter = (event: StreamEvent) => void;

export interface BatchEmailScrapeOptions {
  totalResultCount?: number;
  browser?: Browser;
}

function leadHasEmail(lead: BusinessLead): boolean {
  return Boolean(
    lead.email?.trim() ||
      (lead.emails?.length ?? 0) > 0 ||
      (lead.verifiedEmails?.length ?? 0) > 0 ||
      (lead.predictedEmails?.length ?? 0) > 0
  );
}

function buildEnrichedLead(
  lead: BusinessLead,
  verified: string[],
  predicted: string[]
): BusinessLead {
  const predictedEmails: PredictedEmail[] = predicted.map((email) => ({
    email,
    confidence: 78,
    label: "medium",
    source: "business_pattern",
  }));

  const hasVerified = verified.length > 0;
  const displayParts = [...verified, ...predicted];

  return {
    ...lead,
    emails: verified,
    verifiedEmails: verified,
    predictedEmails,
    email: displayParts.length > 0 ? displayParts.join(", ") : null,
    emailSource: hasVerified ? "website" : predicted.length > 0 ? "predicted" : "none",
    emailScraped: true,
  };
}

async function scrapeOneLeadEmail(
  lead: BusinessLead,
  browserContext: BrowserContext
): Promise<BusinessLead> {
  if (!lead.website || leadHasEmail(lead) || lead.emailScraped) {
    return lead;
  }

  logger.info("[email-diag] Scraping lead email", {
    businessId: lead.id,
    name: lead.name?.substring(0, 60),
    website: lead.website.substring(0, 80),
    category: lead.category,
  });

  const { verifiedEmails, predictedEmails } = await discoverBusinessEmailsCombined(
    lead.website,
    {
      category: lead.category,
      businessName: lead.name,
      browserContext,
    }
  );

  if (verifiedEmails.length === 0 && predictedEmails.length === 0) {
    logger.info("[email-diag] No emails discovered for lead", {
      businessId: lead.id,
      website: lead.website.substring(0, 80),
    });
    return { ...lead, emailScraped: true };
  }

  return buildEnrichedLead(lead, verifiedEmails, predictedEmails);
}

function resolveTabConcurrency(totalResultCount?: number): number {
  const count = totalResultCount ?? 0;
  if (count >= MEDIUM_CITY_RESULT_THRESHOLD) {
    return EMAIL_SCRAPE_TAB_CONCURRENCY_LARGE;
  }
  return EMAIL_SCRAPE_TAB_CONCURRENCY;
}

async function runWithTabConcurrency<T>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<void>
): Promise<void> {
  if (items.length === 0) return;
  const limit = Math.max(1, Math.min(concurrency, items.length));
  let index = 0;

  const runners = Array.from({ length: limit }, async () => {
    while (index < items.length) {
      const current = items[index];
      index += 1;
      await worker(current);
    }
  });

  await Promise.all(runners);
}

async function markRemainingUnscraped(searchId: string): Promise<void> {
  const remaining = (await getAllSearchLeads(searchId)).filter(
    (lead) => lead.website && !lead.emailScraped && !leadHasEmail(lead)
  );

  for (const lead of remaining) {
    await markBusinessLeadEmailScraped(lead.id, []).catch(() => undefined);
  }
}

export async function runBatchEmailScraping(
  searchId: string,
  emit: ScrapeEmitter,
  deadlineMs = EMAIL_SCRAPE_MAX_MS,
  options: BatchEmailScrapeOptions = {}
): Promise<{ emailsFound: number; emailsScraped: number }> {
  const deadline = Date.now() + deadlineMs;
  const tabConcurrency = resolveTabConcurrency(options.totalResultCount);
  let emailsFound = 0;
  let emailsScraped = 0;
  let websitesAttempted = 0;

  const ownsBrowser = !options.browser;
  let browser = options.browser ?? null;
  let browserContext: BrowserContext | null = null;

  logger.info("[search-diag] Starting batch email scrape", {
    searchId,
    tabConcurrency,
    totalResultCount: options.totalResultCount ?? null,
    perSiteTimeoutMs: 15000,
    websiteCap: "none",
    reusingBrowser: Boolean(options.browser),
  });

  try {
    if (!browser) {
      const { getBrowserPool } = await import("../scraper/browser/browser-pool");
      browser = await getBrowserPool().acquire(60_000);
    }

    browserContext = await createEmailBrowserContext(browser);

    while (Date.now() < deadline) {
      const pending = (await getAllSearchLeads(searchId)).filter(
        (lead) =>
          lead.website && !lead.emailScraped && !leadHasEmail(lead)
      );

      if (pending.length === 0) break;

      const context = browserContext;
      await runWithTabConcurrency(pending, tabConcurrency, async (lead) => {
        if (Date.now() >= deadline) return;

        websitesAttempted++;
        emailsScraped++;

        try {
          const enriched = await scrapeOneLeadEmail(lead, context);
          const hasEmails =
            (enriched.verifiedEmails?.length ?? 0) > 0 ||
            (enriched.predictedEmails?.length ?? 0) > 0;

          if (hasEmails) {
            emailsFound++;
            await updateBusinessLeadEnrichment(enriched).catch((err) =>
              logger.warn("[email-diag] Failed to persist enriched email", {
                searchId,
                businessId: enriched.id,
                error: err instanceof Error ? err.message : "unknown",
              })
            );

            const allEmails = [
              ...(enriched.verifiedEmails ?? []),
              ...(enriched.predictedEmails?.map((p) => p.email) ?? []),
            ];

            emit({
              type: "email_update",
              businessId: enriched.id,
              email: enriched.email,
              emails: allEmails,
              emailSource:
                enriched.emailSource === "predicted" ? "predicted" : "website",
              lead: enriched,
              data: enriched,
            });
          } else {
            await markBusinessLeadEmailScraped(lead.id, []).catch(() => undefined);
          }
        } catch (err) {
          logger.warn("[email-diag] Website scrape failed", {
            searchId,
            businessId: lead.id,
            website: lead.website?.substring(0, 80),
            error: err instanceof Error ? err.message : "unknown",
          });
          await markBusinessLeadEmailScraped(lead.id, []).catch(() => undefined);
        }
      });
    }
  } finally {
    await browserContext?.close().catch(() => undefined);
    if (ownsBrowser && browser) {
      const { getBrowserPool } = await import("../scraper/browser/browser-pool");
      getBrowserPool().release(browser);
    }
  }

  await markRemainingUnscraped(searchId);

  logger.info("[search-diag] Batch email scrape complete", {
    searchId,
    emailsFound,
    emailsScraped,
    websitesAttempted,
    tabConcurrency,
  });

  return { emailsFound, emailsScraped };
}
