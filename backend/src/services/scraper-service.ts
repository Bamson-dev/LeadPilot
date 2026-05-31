import type { BusinessLead, StreamEvent } from "@leadthur/shared";
import { getBrowserPool } from "../scraper/browser/browser-pool";
import { scrapeGoogleMaps } from "../scraper/googleMaps/maps-scraper";
import {
  getSearchJob,
  insertBusinessLead,
  markSearchComplete,
  markSearchFailed,
  updateBusinessLeadEmails,
  updateSearchJob,
} from "../database/search-repository";
import { saveUserSearch } from "../database/user-search-repository";
import { getLicenseEmailBySearchId } from "../database/license-repository";
import {
  sendSearchCompleteEmail,
  sendSearchFailedEmail,
  sendSearchRunningEmail,
} from "../services/brevo-service";
import { formatScraperError } from "../scraper/utils/scraper-errors";
import { logger } from "../utils/logger";
import {
  enrichLeadEmail,
  applyWebsiteEmailsToLead,
  applyPredictedEmailsToLead,
  rawLeadToBusinessLead,
} from "../utils/lead-mapper";
import { crawlEmailsFromWebsite } from "../scraper/emailCrawler/email-crawler";
import { formatSearchMessage } from "../utils/search-messages";
import { generateAreaSuggestions } from "./suggestion-service";
import type { RawLeadInput } from "../types/scraper";

export type ScrapeEmitter = (event: StreamEvent) => void;

function emitLead(emit: ScrapeEmitter, lead: BusinessLead): void {
  emit({ type: "lead", lead, data: lead });
}

function emitEmailUpdate(
  emit: ScrapeEmitter,
  lead: BusinessLead,
  emailSource: "website" | "predicted"
): void {
  const emails =
    lead.emails.length > 0
      ? lead.emails
      : emailSource === "predicted"
        ? lead.predictedEmails.map((p) => p.email)
        : lead.verifiedEmails;

  emit({
    type: "email_update",
    businessId: lead.id,
    email: lead.email,
    emails,
    emailSource,
    lead,
    data: lead,
  });
}

function hasVerifiedEmail(lead: BusinessLead): boolean {
  return (
    (lead.emails?.length ?? 0) > 0 ||
    (lead.verifiedEmails?.length ?? 0) > 0 ||
    Boolean(lead.email?.trim())
  );
}

function runBackgroundEmailEnrichment(
  basic: BusinessLead,
  emit: ScrapeEmitter,
  searchId: string,
  enrichedLeads: BusinessLead[],
  onComplete: () => void
): void {
  if (hasVerifiedEmail(basic)) {
    enrichedLeads.push(basic);
    onComplete();
    return;
  }

  if (basic.website) {
    crawlEmailsFromWebsite(basic.website)
      .then(async (crawlResult) => {
        const { emails, predicted } = crawlResult;

        if (emails.length > 0) {
          const enriched = predicted
            ? applyPredictedEmailsToLead(basic, emails)
            : applyWebsiteEmailsToLead(basic, emails);
          const source = predicted ? "predicted" : "website";

          enrichedLeads.push(enriched);
          emitEmailUpdate(emit, enriched, source);
          await updateBusinessLeadEmails(
            enriched.id,
            emails,
            predicted ? "predicted" : "extracted"
          ).catch((err) => {
            logger.warn("Failed to update crawled emails", {
              searchId,
              businessId: enriched.id,
              error: err instanceof Error ? err.message : "unknown",
            });
          });
          await insertBusinessLead(enriched).catch((err) => {
            logger.warn("Failed to upsert enriched lead", {
              searchId,
              name: enriched.name,
              error: err instanceof Error ? err.message : "unknown",
            });
          });

          logger.info("Email enrichment complete", {
            businessId: enriched.id,
            businessName: enriched.name,
            website: basic.website?.substring(0, 40),
            emailsFound: emails.length,
            source: predicted ? "predicted" : "crawled",
          });
          return;
        }

        enrichedLeads.push(basic);
      })
      .catch((err) => {
        logger.warn("Email enrich failed", {
          searchId,
          name: basic.name,
          error: err instanceof Error ? err.message : "unknown",
        });
      })
      .finally(() => {
        onComplete();
      });
    return;
  }

  enrichLeadEmail(basic, { skipWebsiteCrawl: true })
    .then(async (enriched) => {
      enrichedLeads.push(enriched);

      const verifiedEmails =
        enriched.emails?.length > 0
          ? enriched.emails
          : enriched.verifiedEmails?.length > 0
            ? enriched.verifiedEmails
            : enriched.predictedEmails.map((p) => p.email);

      if (verifiedEmails.length > 0) {
        const source =
          enriched.emailSource === "predicted" ? "predicted" : "website";
        emitEmailUpdate(emit, enriched, source);
      }

      await insertBusinessLead(enriched).catch((err) => {
        logger.warn("Failed to upsert enriched lead", {
          searchId,
          name: enriched.name,
          error: err instanceof Error ? err.message : "unknown",
        });
      });

      if (verifiedEmails.length > 0) {
        logger.info("Email enrichment complete", {
          businessId: enriched.id,
          businessName: enriched.name,
          website: basic.website?.substring(0, 40),
          emailsFound: verifiedEmails.length,
          source:
            enriched.emailSource === "predicted" ? "predicted" : "crawled",
        });
      }
    })
    .catch((err) => {
      logger.warn("Email enrich failed", {
        searchId,
        name: basic.name,
        error: err instanceof Error ? err.message : "unknown",
      });
    })
    .finally(() => {
      onComplete();
    });
}

function leadDedupeKey(lead: BusinessLead): string {
  return `${lead.name?.toLowerCase().trim()}-${lead.phone?.replace(/\s/g, "") || "nophone"}`;
}

function deduplicateLeads(leads: BusinessLead[]): BusinessLead[] {
  const seen = new Set<string>();
  return leads.filter((lead) => {
    const key = `${lead.name?.toLowerCase().trim()}-${lead.phone?.replace(/\s/g, "") || "nophone"}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export async function runScraperJob(
  searchId: string,
  query: string,
  location: string,
  emit: ScrapeEmitter,
  options?: { licenseKey?: string; licenseEmail?: string; isTrial?: boolean }
): Promise<void> {
  const pool = getBrowserPool();
  let searchComplete = false;
  let leadsFoundSoFar = 0;
  let runningEmailSent = false;

  const jobRecord = await getSearchJob(searchId);
  const isTrial = options?.isTrial ?? jobRecord?.isTrial ?? false;

  const resolveLicenseEmail = async (): Promise<string | null> => {
    if (options?.licenseEmail) return options.licenseEmail;
    return getLicenseEmailBySearchId(searchId);
  };

  const runningEmailTimer = setTimeout(() => {
    void (async () => {
      if (isTrial || searchComplete || leadsFoundSoFar >= 5 || runningEmailSent) {
        return;
      }
      runningEmailSent = true;
      const licenseEmail = await resolveLicenseEmail();
      if (licenseEmail) {
        void sendSearchRunningEmail(licenseEmail, query, location).catch((err) =>
          logger.error("Failed to send running email", {
            error: err instanceof Error ? err.message : "unknown",
          })
        );
      }
    })();
  }, 2 * 60 * 1000);

  if (!pool.isReady()) {
    emit({
      type: "phase",
      phase: "Starting scraper — this may take up to a minute on first search...",
    });
    const ready = await pool.waitUntilReady(90_000);
    if (!ready) {
      clearTimeout(runningEmailTimer);
      throw new Error("Scraper is not ready yet. Please try again in one minute.");
    }
  }

  const browser = await pool.acquire(90_000);
  let progress = 0;
  let progressMax = 100;
  const seenLeadKeys = new Set<string>();
  const collectedLeads: BusinessLead[] = [];

  logger.info("Search started", {
    searchId,
    query,
    location,
    isTrial,
    strategiesUsed: isTrial ? 2 : undefined,
  });

  try {
    await updateSearchJob(searchId, { status: "running" });

    const startMessage = formatSearchMessage(query, location);
    if (!isTrial) {
      emit({ type: "phase", phase: startMessage });
      emit({
        type: "progress",
        message: startMessage,
        processed: 0,
        count: 0,
        max: 0,
      });
    }

    let pendingEnrich = 0;

    const onBusinessFound = (raw: RawLeadInput) => {
      const basic = rawLeadToBusinessLead(raw, searchId);
      const key = leadDedupeKey(basic);
      if (seenLeadKeys.has(key)) return;
      seenLeadKeys.add(key);

      progress++;
      leadsFoundSoFar = progress;
      collectedLeads.push(basic);
      emitLead(emit, basic);
      emit({
        type: "progress",
        ...(isTrial
          ? { processed: progress, count: progress }
          : {
              message: `Found ${progress} businesses so far...`,
              processed: progress,
              count: progress,
              max: progressMax,
            }),
      });

      void insertBusinessLead(basic).catch((err) => {
        logger.error("Failed to insert business lead", {
          searchId,
          error: err instanceof Error ? err.message : "unknown",
        });
      });

      if (isTrial) {
        if (progress % 3 === 0) {
          void updateSearchJob(searchId, {
            processed: progress,
            totalFound: progress,
          }).catch(() => undefined);
        }
        return;
      }

      pendingEnrich++;
      runBackgroundEmailEnrichment(
        basic,
        emit,
        searchId,
        enrichedLeads,
        () => {
          pendingEnrich--;
        }
      );

      if (progress % 3 === 0) {
        void updateSearchJob(searchId, {
          processed: progress,
          totalFound: progress,
        }).catch(() => undefined);
      }
    };

    const enrichedLeads: BusinessLead[] = [];

    const total = await scrapeGoogleMaps(browser, {
      query,
      location,
      isTrial,
      onPhase: (phase) => {
        if (!isTrial) emit({ type: "phase", phase });
      },
      onProgress: (count, max) => {
        progressMax = max;
        if (isTrial) {
          emit({ type: "progress", processed: count, count });
        } else {
          emit({
            type: "progress",
            message: `Found ${count} of ${max} businesses...`,
            processed: count,
            count,
            max,
          });
        }
      },
      onLead: (raw) => {
        onBusinessFound(raw);
      },
    });

    searchComplete = true;
    clearTimeout(runningEmailTimer);

    if (!isTrial) {
      const enrichDeadline = Date.now() + 120_000;
      while (pendingEnrich > 0 && Date.now() < enrichDeadline) {
        await new Promise((r) => setTimeout(r, 400));
      }
    }

    const uniqueCount = deduplicateLeads(collectedLeads).length;
    const totalFound = uniqueCount > 0 ? uniqueCount : total;

    await updateSearchJob(searchId, { processed: totalFound, totalFound });
    await markSearchComplete(searchId, totalFound);

    const statsLeads = isTrial ? collectedLeads : enrichedLeads;
    const withPhone = statsLeads.filter((l) => l.phone).length;
    const withEmail = statsLeads.filter(
      (l) => (l.emails?.length ?? 0) > 0 || (l.verifiedEmails?.length ?? 0) > 0
    ).length;
    const withWebsite = statsLeads.filter((l) => l.website).length;

    logger.info("Search completion stats", {
      searchId,
      totalFound,
      withPhone,
      withEmail,
      withWebsite,
      phoneRate:
        totalFound > 0 ? `${Math.round((withPhone / totalFound) * 100)}%` : "0%",
      emailRate:
        totalFound > 0 ? `${Math.round((withEmail / totalFound) * 100)}%` : "0%",
    });

    logger.info("Search completion stats with email breakdown", {
      searchId,
      totalFound,
      withCrawledEmail: statsLeads.filter((l) => l.emailSource === "website")
        .length,
      withPredictedEmail: statsLeads.filter(
        (l) => l.emailSource === "predicted"
      ).length,
      withNoEmail: statsLeads.filter(
        (l) =>
          !l.email?.trim() &&
          (l.emails?.length ?? 0) === 0 &&
          (l.verifiedEmails?.length ?? 0) === 0 &&
          (l.predictedEmails?.length ?? 0) === 0
      ).length,
    });

    if (options?.licenseKey) {
      await saveUserSearch({
        licenseKey: options.licenseKey,
        searchId,
        query,
        location,
        totalFound,
      });
    }

    const licenseEmail = await resolveLicenseEmail();
    if (licenseEmail) {
      if (totalFound > 0) {
        void sendSearchCompleteEmail(licenseEmail, query, location, totalFound).catch(
          (err) =>
            logger.error("Failed to send complete email", {
              error: err instanceof Error ? err.message : "unknown",
            })
        );
      } else {
        void sendSearchFailedEmail(licenseEmail, query, location).catch((err) =>
          logger.error("Failed to send failed email", {
            error: err instanceof Error ? err.message : "unknown",
          })
        );
      }
    }

    emit({
      type: "complete",
      total: totalFound,
      message: `Search complete. Found ${totalFound} businesses in ${location}.`,
    });

    if (!isTrial) {
      void generateAreaSuggestions(query, location, totalFound)
        .then((suggestions) => {
          if (suggestions.length > 0) {
            emit({ type: "suggestions", suggestions });
          }
        })
        .catch(() => undefined);
    }
  } catch (err) {
    searchComplete = true;
    clearTimeout(runningEmailTimer);

    const message = formatScraperError(err);
    logger.error("Scraper job failed", { searchId, message });
    await markSearchFailed(searchId, message);

    const licenseEmail = await resolveLicenseEmail();
    if (licenseEmail) {
      void sendSearchFailedEmail(licenseEmail, query, location).catch((emailErr) =>
        logger.error("Failed to send failed email", {
          error: emailErr instanceof Error ? emailErr.message : "unknown",
        })
      );
    }

    emit({
      type: "error",
      message,
    });
    throw err;
  } finally {
    pool.release(browser);
  }
}

export const runSearch = runScraperJob;
