import type { BusinessLead, StreamEvent } from "@leadpilot/shared";
import { getBrowserPool } from "../scraper/browser/browser-pool";
import { scrapeGoogleMaps } from "../scraper/googleMaps/maps-scraper";
import {
  insertBusinessLead,
  markSearchComplete,
  markSearchFailed,
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
import { enrichLeadEmail, rawLeadToBusinessLead } from "../utils/lead-mapper";
import { formatSearchMessage } from "../utils/search-messages";
import type { RawLeadInput } from "../types/scraper";

export type ScrapeEmitter = (event: StreamEvent) => void;

function emitLead(emit: ScrapeEmitter, lead: BusinessLead): void {
  emit({ type: "lead", lead, data: lead });
}

export async function runScraperJob(
  searchId: string,
  query: string,
  location: string,
  emit: ScrapeEmitter,
  options?: { licenseKey?: string; licenseEmail?: string }
): Promise<void> {
  const pool = getBrowserPool();
  let searchComplete = false;
  let leadsFoundSoFar = 0;
  let runningEmailSent = false;

  const resolveLicenseEmail = async (): Promise<string | null> => {
    if (options?.licenseEmail) return options.licenseEmail;
    return getLicenseEmailBySearchId(searchId);
  };

  const runningEmailTimer = setTimeout(() => {
    void (async () => {
      if (searchComplete || leadsFoundSoFar >= 5 || runningEmailSent) return;
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

  try {
    await updateSearchJob(searchId, { status: "running" });

    const startMessage = formatSearchMessage(query, location);
    emit({ type: "phase", phase: startMessage });
    emit({
      type: "progress",
      message: startMessage,
      processed: 0,
      count: 0,
      max: 0,
    });

    let pendingEnrich = 0;

    const onBusinessFound = (raw: RawLeadInput) => {
      const basic = rawLeadToBusinessLead(raw, searchId);
      progress++;
      leadsFoundSoFar = progress;
      emitLead(emit, basic);
      emit({
        type: "progress",
        message: `Found ${progress} businesses so far...`,
        processed: progress,
        count: progress,
        max: progressMax,
      });

      void insertBusinessLead(basic).catch((err) => {
        logger.error("Failed to insert business lead", {
          searchId,
          error: err instanceof Error ? err.message : "unknown",
        });
      });

      pendingEnrich++;
      void enrichLeadEmail(basic)
        .then((enriched) => {
          emitLead(emit, enriched);
          void insertBusinessLead(enriched).catch((err) => {
            logger.warn("Failed to upsert enriched lead", {
              searchId,
              name: enriched.name,
              error: err instanceof Error ? err.message : "unknown",
            });
          });
        })
        .catch((err) => {
          logger.warn("Email enrich failed", {
            searchId,
            name: basic.name,
            error: err instanceof Error ? err.message : "unknown",
          });
        })
        .finally(() => {
          pendingEnrich--;
        });

      if (progress % 3 === 0) {
        void updateSearchJob(searchId, {
          processed: progress,
          totalFound: progress,
        }).catch(() => undefined);
      }
    };

    const total = await scrapeGoogleMaps(browser, {
      query,
      location,
      onPhase: (phase) => emit({ type: "phase", phase }),
      onProgress: (count, max) => {
        progressMax = max;
        emit({
          type: "progress",
          message: `Found ${count} of ${max} businesses...`,
          processed: count,
          count,
          max,
        });
      },
      onLead: (raw) => {
        onBusinessFound(raw);
      },
    });

    searchComplete = true;
    clearTimeout(runningEmailTimer);

    const enrichDeadline = Date.now() + 120_000;
    while (pendingEnrich > 0 && Date.now() < enrichDeadline) {
      await new Promise((r) => setTimeout(r, 400));
    }

    await updateSearchJob(searchId, { processed: progress, totalFound: total });
    await markSearchComplete(searchId, total);

    if (options?.licenseKey) {
      await saveUserSearch({
        licenseKey: options.licenseKey,
        searchId,
        query,
        location,
        totalFound: total,
      });
    }

    const licenseEmail = await resolveLicenseEmail();
    if (licenseEmail) {
      if (total > 0) {
        void sendSearchCompleteEmail(licenseEmail, query, location, total).catch(
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
      total,
      message: `Search complete. Found ${total} businesses in ${location}.`,
    });
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
