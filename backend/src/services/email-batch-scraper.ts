import type { BusinessLead, PredictedEmail, StreamEvent } from "@leadthur/shared";
import { discoverBusinessEmailsCombined } from "../scraper/emailCrawler/email-crawler";
import {
  EMAIL_SCRAPE_BATCH_SIZE,
  EMAIL_SCRAPE_BATCH_SIZE_LARGE,
  EMAIL_SCRAPE_MAX_MS,
  LARGE_CITY_RESULT_THRESHOLD,
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
  batchSize?: number;
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

async function scrapeOneLeadEmail(lead: BusinessLead): Promise<BusinessLead> {
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
    { category: lead.category, businessName: lead.name }
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

function resolveBatchSize(totalResultCount?: number, override?: number): number {
  if (override && override > 0) return override;
  const count = totalResultCount ?? 0;
  if (count > LARGE_CITY_RESULT_THRESHOLD) return EMAIL_SCRAPE_BATCH_SIZE_LARGE;
  if (count < MEDIUM_CITY_RESULT_THRESHOLD) return EMAIL_SCRAPE_BATCH_SIZE;
  return 5;
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
  const batchSize = resolveBatchSize(options.totalResultCount, options.batchSize);
  let emailsFound = 0;
  let emailsScraped = 0;
  let websitesAttempted = 0;

  logger.info("[search-diag] Starting batch email scrape", {
    searchId,
    batchSize,
    totalResultCount: options.totalResultCount ?? null,
    perSiteTimeoutMs: 15000,
    websiteCap: "none",
  });

  while (Date.now() < deadline) {
    const pending = (await getAllSearchLeads(searchId)).filter(
      (lead) => lead.website && !lead.emailScraped && !leadHasEmail(lead)
    );

    if (pending.length === 0) break;

    for (let i = 0; i < pending.length; i += batchSize) {
      if (Date.now() >= deadline) break;

      const batch = pending.slice(i, i + batchSize);
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
          await markBusinessLeadEmailScraped(original.id, []).catch(() => undefined);
        }
      }
    }
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
