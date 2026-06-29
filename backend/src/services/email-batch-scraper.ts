import type { BusinessLead, StreamEvent } from "@leadthur/shared";
import { scrapeBusinessEmailStrict } from "../scraper/emailCrawler/email-crawler";
import {
  EMAIL_SCRAPE_BATCH_SIZE,
  EMAIL_SCRAPE_BATCH_SIZE_LARGE,
  EMAIL_SCRAPE_MAX_MS,
  EMAIL_SCRAPE_MAX_WEBSITES,
  LARGE_CITY_RESULT_THRESHOLD,
} from "../scraper/utils/constants";
import {
  getAllSearchLeads,
  markBusinessLeadEmailScraped,
  updateBusinessLeadEmails,
} from "../database/search-repository";
import { applyWebsiteEmailsToLead } from "../utils/lead-mapper";
import { logger } from "../utils/logger";

export type ScrapeEmitter = (event: StreamEvent) => void;

export interface BatchEmailScrapeOptions {
  totalResultCount?: number;
  maxWebsites?: number;
  batchSize?: number;
}

function leadHasVerifiedEmail(lead: BusinessLead): boolean {
  return Boolean(
    lead.email?.trim() ||
      (lead.emails?.length ?? 0) > 0 ||
      (lead.verifiedEmails?.length ?? 0) > 0
  );
}

async function scrapeOneLeadEmail(lead: BusinessLead): Promise<BusinessLead> {
  if (!lead.website || leadHasVerifiedEmail(lead) || lead.emailScraped) {
    return lead;
  }

  const emails = await scrapeBusinessEmailStrict(lead.website);
  if (emails.length > 0) {
    return applyWebsiteEmailsToLead(lead, emails);
  }

  return { ...lead, email: lead.email ?? "", emails: [], emailScraped: true };
}

function resolveBatchSize(totalResultCount?: number, override?: number): number {
  if (override && override > 0) return override;
  if ((totalResultCount ?? 0) > LARGE_CITY_RESULT_THRESHOLD) {
    return EMAIL_SCRAPE_BATCH_SIZE_LARGE;
  }
  return EMAIL_SCRAPE_BATCH_SIZE;
}

async function markRemainingUnscraped(searchId: string): Promise<void> {
  const remaining = (await getAllSearchLeads(searchId)).filter(
    (lead) =>
      lead.website && !lead.emailScraped && !leadHasVerifiedEmail(lead)
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
  const maxWebsites = options.maxWebsites ?? EMAIL_SCRAPE_MAX_WEBSITES;
  const batchSize = resolveBatchSize(options.totalResultCount, options.batchSize);
  let emailsFound = 0;
  let emailsScraped = 0;
  let websitesAttempted = 0;

  logger.info("[search-diag] Starting batch email scrape", {
    searchId,
    batchSize,
    maxWebsites,
    totalResultCount: options.totalResultCount ?? null,
  });

  while (Date.now() < deadline && websitesAttempted < maxWebsites) {
    const pending = (await getAllSearchLeads(searchId)).filter(
      (lead) =>
        lead.website &&
        !lead.emailScraped &&
        !leadHasVerifiedEmail(lead)
    );

    if (pending.length === 0) break;

    const remainingBudget = maxWebsites - websitesAttempted;
    const toProcess = pending.slice(0, remainingBudget);

    for (let i = 0; i < toProcess.length; i += batchSize) {
      if (Date.now() >= deadline || websitesAttempted >= maxWebsites) break;

      const batch = toProcess.slice(i, i + batchSize);
      const results = await Promise.allSettled(
        batch.map((lead) => scrapeOneLeadEmail(lead))
      );

      for (let j = 0; j < results.length; j++) {
        const result = results[j];
        const original = batch[j];
        websitesAttempted++;
        emailsScraped++;

        if (result.status !== "fulfilled") {
          logger.warn("[email-diag] Website scrape rejected", {
            searchId,
            businessId: original.id,
            website: original.website?.substring(0, 80),
            error:
              result.reason instanceof Error
                ? result.reason.message
                : "unknown",
          });
          await markBusinessLeadEmailScraped(original.id, []).catch(() => undefined);
          continue;
        }

        const enriched = result.value;
        const foundEmails =
          enriched.emails?.length > 0
            ? enriched.emails
            : enriched.verifiedEmails?.length > 0
              ? enriched.verifiedEmails
              : [];

        if (foundEmails.length > 0) {
          emailsFound++;
          await updateBusinessLeadEmails(enriched.id, foundEmails, "extracted").catch(
            (err) =>
              logger.warn("Failed to persist scraped email", {
                searchId,
                businessId: enriched.id,
                error: err instanceof Error ? err.message : "unknown",
              })
          );

          emit({
            type: "email_update",
            businessId: enriched.id,
            email: enriched.email,
            emails: foundEmails,
            emailSource: "website",
            lead: enriched,
            data: enriched,
          });
        } else {
          await markBusinessLeadEmailScraped(original.id, []).catch(() => undefined);
        }
      }
    }
  }

  if (websitesAttempted >= maxWebsites) {
    logger.warn("[search-diag] Email scrape capped at website limit", {
      searchId,
      maxWebsites,
      emailsFound,
      emailsScraped,
    });
  }

  await markRemainingUnscraped(searchId);

  logger.info("[search-diag] Batch email scrape complete", {
    searchId,
    emailsFound,
    emailsScraped,
    websitesAttempted,
  });

  return { emailsFound, emailsScraped };
}
