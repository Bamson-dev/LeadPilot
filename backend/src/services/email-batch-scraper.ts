import type { BrowserContext } from "playwright";
import type { BusinessLead, PredictedEmail, StreamEvent } from "@leadthur/shared";
import { isBlockedEmailScrapeDomain } from "@leadthur/shared";
import { createEmailBrowserContext } from "../scraper/emailCrawler/email-crawler";
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
import {
  enrichBusinessLeadEmail,
  enrichmentToBusinessLead,
} from "./email-enrichment-service";
import { logger } from "../utils/logger";
import { logSearchLifecycle } from "../utils/search-job-lifecycle";

export type ScrapeEmitter = (event: StreamEvent) => void;

const phase2FirstTabLogged = new Set<string>();

export interface BatchEmailScrapeOptions {
  totalResultCount?: number;
  browser?: import("playwright").Browser;
}

function leadHasEmail(lead: BusinessLead): boolean {
  return Boolean(
    lead.email?.trim() ||
      (lead.emails?.length ?? 0) > 0 ||
      (lead.verifiedEmails?.length ?? 0) > 0 ||
      (lead.predictedEmails?.length ?? 0) > 0
  );
}

async function scrapeOneLeadEmail(
  lead: BusinessLead,
  browserContext: BrowserContext
): Promise<{ lead: BusinessLead; fromCache: boolean }> {
  if (!lead.website || leadHasEmail(lead) || lead.emailScraped) {
    return { lead, fromCache: false };
  }

  if (isBlockedEmailScrapeDomain(lead.website)) {
    logger.info("[email-diag] Skipped blocked platform domain", {
      businessId: lead.id,
      website: lead.website.substring(0, 80),
    });
    return {
      lead: {
        ...lead,
        emailScraped: true,
        email: null,
        emails: [],
        verifiedEmails: [],
        predictedEmails: [],
        emailSource: "none",
      },
      fromCache: false,
    };
  }

  logger.info("[email-diag] Scraping lead email", {
    businessId: lead.id,
    name: lead.name?.substring(0, 60),
    website: lead.website.substring(0, 80),
    category: lead.category,
  });

  if (!phase2FirstTabLogged.has(lead.searchId)) {
    phase2FirstTabLogged.add(lead.searchId);
    logSearchLifecycle("phase2_first_playwright_tab", lead.searchId, {
      businessId: lead.id,
      website: lead.website.substring(0, 80),
    });
  }

  const enrichment = await enrichBusinessLeadEmail(lead, { browserContext });

  if (
    enrichment.verifiedEmails.length === 0 &&
    enrichment.predictedEmails.length === 0
  ) {
    logger.info("[email-diag] No emails discovered for lead", {
      businessId: lead.id,
      website: lead.website.substring(0, 80),
      fromCache: enrichment.fromCache,
    });
    return { lead: { ...lead, emailScraped: true }, fromCache: enrichment.fromCache };
  }

  if (enrichment.fromCache) {
    logger.info("[email-diag] Email served from domain cache", {
      businessId: lead.id,
      website: lead.website.substring(0, 80),
      source: enrichment.emailSource,
    });
  }

  return {
    lead: enrichmentToBusinessLead(lead, enrichment),
    fromCache: enrichment.fromCache,
  };
}

function emailScrapePriority(lead: BusinessLead): number {
  const raw = (lead.website || "").trim().toLowerCase();
  if (!raw) return 100;

  let host = raw;
  try {
    host = new URL(raw.startsWith("http") ? raw : `https://${raw}`).hostname.toLowerCase();
  } catch {
    host = raw.replace(/^https?:\/\//, "").split("/")[0] ?? raw;
  }

  // Slow / low-yield hosts last so more real sites finish inside the Phase 2 budget.
  if (
    /(?:^|\.)(?:linktr\.ee|bit\.ly|facebook\.com|instagram\.com|wa\.me|whatsapp\.com|youtu\.be|youtube\.com|tiktok\.com)$/i.test(
      host
    )
  ) {
    return 90;
  }
  if (
    /(?:^|\.)(?:wixsite\.com|squarespace\.com|wordpress\.com|webflow\.io|godaddysites\.com|myshopify\.com|carrd\.co)$/i.test(
      host
    )
  ) {
    return 60;
  }
  if (/\.(edu|gov|ac\.[a-z]{2})$/i.test(host)) return 40;

  const labels = host.split(".").filter(Boolean);
  if (labels.length <= 3) return 10;
  return 25;
}

function sortLeadsForEmailScrape(leads: BusinessLead[]): BusinessLead[] {
  return [...leads].sort((a, b) => emailScrapePriority(a) - emailScrapePriority(b));
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

async function markBlockedPlatformDomains(searchId: string): Promise<void> {
  const blocked = (await getAllSearchLeads(searchId)).filter(
    (lead) => lead.website && !lead.emailScraped && isBlockedEmailScrapeDomain(lead.website)
  );

  for (const lead of blocked) {
    await markBusinessLeadEmailScraped(lead.id, []).catch(() => undefined);
  }
}

async function markRemainingUnscraped(searchId: string): Promise<void> {
  const remaining = (await getAllSearchLeads(searchId)).filter(
    (lead) =>
      lead.website &&
      !lead.emailScraped &&
      !leadHasEmail(lead) &&
      !isBlockedEmailScrapeDomain(lead.website)
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
  let cacheHits = 0;

  const ownsBrowser = !options.browser;
  let browser = options.browser ?? null;
  let browserContext: BrowserContext | null = null;

  logger.info("[search-diag] Starting batch email scrape", {
    searchId,
    tabConcurrency,
    totalResultCount: options.totalResultCount ?? null,
    perSiteTimeoutMs: 25000,
    websiteCap: "none",
    reusingBrowser: Boolean(options.browser),
  });

  try {
    if (!browser) {
      const { getBrowserPool } = await import("../scraper/browser/browser-pool");
      browser = await getBrowserPool().acquire(60_000);
    }

    browserContext = await createEmailBrowserContext(browser);
    await markBlockedPlatformDomains(searchId);

    while (Date.now() < deadline) {
      const pending = (await getAllSearchLeads(searchId)).filter(
        (lead) =>
          lead.website &&
          !lead.emailScraped &&
          !leadHasEmail(lead) &&
          !isBlockedEmailScrapeDomain(lead.website)
      );

      if (pending.length === 0) break;

      const ordered = sortLeadsForEmailScrape(pending);
      const context = browserContext;
      await runWithTabConcurrency(ordered, tabConcurrency, async (lead) => {
        if (Date.now() >= deadline) return;

        websitesAttempted++;
        emailsScraped++;

        try {
          const { lead: enriched, fromCache } = await scrapeOneLeadEmail(lead, context);
          if (fromCache) cacheHits++;
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
    cacheHits,
    tabConcurrency,
  });

  phase2FirstTabLogged.delete(searchId);

  return { emailsFound, emailsScraped };
}
