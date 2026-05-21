import type { BusinessLead, StreamEvent } from "@leadpilot/shared";
import { getBrowserPool } from "../scraper/browser/browser-pool";
import { scrapeGoogleMaps } from "../scraper/googleMaps/maps-scraper";
import {
  insertBusinessLead,
  markSearchComplete,
  markSearchFailed,
  updateSearchJob,
} from "../database/search-repository";
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
  emit: ScrapeEmitter
): Promise<void> {
  const pool = getBrowserPool();

  if (!pool.isReady()) {
    emit({
      type: "phase",
      phase: "Starting scraper — this may take up to a minute on first search...",
    });
    const ready = await pool.waitUntilReady(90_000);
    if (!ready) {
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

    const onBusinessFound = (raw: RawLeadInput) => {
      const basic = rawLeadToBusinessLead(raw, searchId);
      progress++;
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

      void enrichLeadEmail(basic)
        .then((enriched) => {
          const changed =
            enriched.email !== basic.email ||
            enriched.emailSource !== basic.emailSource ||
            enriched.predictedEmails.length !== basic.predictedEmails.length ||
            enriched.verifiedEmails.length !== basic.verifiedEmails.length;
          if (!changed) return;
          emitLead(emit, enriched);
          void insertBusinessLead(enriched).catch(() => undefined);
        })
        .catch((err) => {
          logger.warn("Email enrich failed", {
            searchId,
            name: basic.name,
            error: err instanceof Error ? err.message : "unknown",
          });
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

    await updateSearchJob(searchId, { processed: progress, totalFound: total });
    await markSearchComplete(searchId, total);
    emit({
      type: "complete",
      total,
      message: `Search complete. Found ${total} businesses.`,
    });
  } catch (err) {
    const message = formatScraperError(err);
    logger.error("Scraper job failed", { searchId, message });
    await markSearchFailed(searchId, message);
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
