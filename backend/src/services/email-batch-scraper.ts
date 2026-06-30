import type { BusinessLead, StreamEvent } from "@leadthur/shared";
import { discoverBusinessEmails } from "../scraper/emailCrawler/email-crawler";
import {
  EMAIL_SCRAPE_BATCH_SIZE,
  EMAIL_SCRAPE_BATCH_SIZE_LARGE,
  EMAIL_SCRAPE_BATCH_SIZE_MEDIUM,
  EMAIL_SCRAPE_MAX_MS,
  EMAIL_SCRAPE_MAX_WEBSITES,
  LARGE_CITY_RESULT_THRESHOLD,
} from "../scraper/utils/constants";
import {
  getAllSearchLeads,
  markBusinessLeadEmailScraped,
  updateBusinessLeadEmails,
} from "../database/search-repository";
import {
  applyPredictedEmailsToLead,
  applyWebsiteEmailsToLead,
} from "../utils/lead-mapper";
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
      (lead.verifiedEmails?.length ?? 0) > 0 ||
      (lead.predictedEmails?.length ?? 0) > 0
  );
}

async function scrapeOneLeadEmail(lead: BusinessLead): Promise<BusinessLead> {
  if (!lead.website || leadHasVerifiedEmail(lead) || lead.emailScraped) {
    return lead;
  }

  const { emails, predicted } = await discoverBusinessEmails(
    lead.website,
    lead.category
  );

  if (emails.length > 0) {
    return predicted
      ? applyPredictedEmailsToLead(lead, emails)
      : applyWebsiteEmailsToLead(lead, emails);
  }

  return { ...lead, email: lead.email ?? "", emails: [], emailScraped: true };
}

function resolveBatchSize(totalResultCount?: number, override?: number): number {
  if (override && override > 0) return override;
  const total = totalResultCount ?? 0;
  if (total > LARGE_CITY_RESULT_THRESHOLD) return EMAIL_SCRAPE_BATCH_SIZE_LARGE;
  if (total < 200) return EMAIL_SCRAPE_BATCH_SIZE;
  return EMAIL_SCRAPE_BATCH_SIZE_MEDIUM;
}

function emitEmailScrapeProgress(
  emit: ScrapeEmitter,
  processed: number,
  total: number,
  emailsFound: number,
  startedAt: number
): void {
  const pct =
    total > 0 ? Math.min(99, Math.round((processed / total) * 100)) : 0;
  const elapsedSec = Math.max(1, Math.round((Date.now() - startedAt) / 1000));
  const rate = processed > 0 ? processed / elapsedSec : 0;
  const remaining = total - processed;
  const etaSec = rate > 0 ? Math.round(remaining / rate) : 0;
  const etaMin = Math.max(1, Math.ceil(etaSec / 60));

  emit({
    type: "progress",
    message:
      total > 0
        ? `Finding email addresses... ${processed} of ${total} websites (${pct}%). About ${etaMin} min remaining.`
        : "Finding email addresses for these businesses...",
    processed,
    max: total,
    count: emailsFound,
  });
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
): Promise<{ emailsFound: number; emailsScraped: number; timedOut: boolean }> {
  const deadline = Date.now() + deadlineMs;
  const maxWebsites = options.maxWebsites ?? EMAIL_SCRAPE_MAX_WEBSITES;
  const batchSize = resolveBatchSize(options.totalResultCount, options.batchSize);
  const startedAt = Date.now();
  let emailsFound = 0;
  let emailsScraped = 0;
  let websitesAttempted = 0;
  let timedOut = false;

  const countPending = async () =>
    (await getAllSearchLeads(searchId)).filter(
      (lead) =>
        lead.website &&
        !lead.emailScraped &&
        !leadHasVerifiedEmail(lead)
    ).length;

  const initialPending = await countPending();
  const scrapeTarget = Math.min(initialPending, maxWebsites);

  logger.info("[search-diag] Starting batch email scrape", {
    searchId,
    batchSize,
    maxWebsites,
    scrapeTarget,
    totalResultCount: options.totalResultCount ?? null,
    deadlineMs,
  });

  emitEmailScrapeProgress(emit, 0, scrapeTarget, 0, startedAt);

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
      if (Date.now() >= deadline || websitesAttempted >= maxWebsites) {
        timedOut = true;
        break;
      }

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
              : enriched.predictedEmails?.length > 0
                ? enriched.predictedEmails.map((p) => p.email)
                : [];

        if (foundEmails.length > 0) {
          emailsFound++;
          const source =
            enriched.emailSource === "predicted" ? "predicted" : "extracted";
          await updateBusinessLeadEmails(enriched.id, foundEmails, source).catch(
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
            emailSource:
              enriched.emailSource === "predicted" ? "predicted" : "website",
            lead: enriched,
            data: enriched,
          });
        } else {
          await markBusinessLeadEmailScraped(original.id, []).catch(() => undefined);
        }
      }

      emitEmailScrapeProgress(
        emit,
        emailsScraped,
        scrapeTarget,
        emailsFound,
        startedAt
      );
    }

    if (timedOut) break;
  }

  if (Date.now() >= deadline) {
    timedOut = true;
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
    timedOut,
    durationMs: Date.now() - startedAt,
  });

  emitEmailScrapeProgress(
    emit,
    emailsScraped,
    scrapeTarget,
    emailsFound,
    startedAt
  );

  return { emailsFound, emailsScraped, timedOut };
}
