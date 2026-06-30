import type { Job } from "bullmq";
import { Worker } from "bullmq";
import type { StreamEvent } from "@leadthur/shared";
import {
  countSearchLeads,
  getSearchJob,
  updateSearchJob,
} from "../database/search-repository";
import { getLicenseEmailBySearchId } from "../database/license-repository";
import {
  commitPartialSearchResults,
  runScraperJob,
} from "../services/scraper-service";
import { clearStreamBuffer, emitToStream } from "../services/stream-registry";
import { sendSearchQueueFailureEmail } from "../services/email";
import { logger } from "../utils/logger";
import { SEARCH_QUEUE_NAME, type SearchQueueJobData } from "../queue/search-queue-types";
import { getRedisConnectionOptions } from "../queue/redis-connection";

const WORKER_CONCURRENCY = 2;

let worker: Worker<SearchQueueJobData> | null = null;

async function resolveJobEmail(
  searchId: string,
  licenseEmail?: string | null
): Promise<string | null> {
  if (licenseEmail?.trim()) return licenseEmail.toLowerCase().trim();
  return getLicenseEmailBySearchId(searchId);
}

async function finalizePartialJob(
  searchId: string,
  query: string,
  location: string,
  licenseEmail: string | null,
  reason: string
): Promise<number> {
  const count = await commitPartialSearchResults(
    searchId,
    query,
    location,
    licenseEmail,
    { emailTimedOut: true }
  );

  if (count > 0) {
    logger.warn("[search-worker] Committed partial results instead of failing", {
      searchId,
      reason,
      leadsCollected: count,
    });
    emitToStream(searchId, {
      type: "complete",
      total: count,
      message: `We found ${count.toLocaleString()} potential clients for you.`,
    });
    clearStreamBuffer(searchId);
  }

  return count;
}

async function processSearchJob(job: Job<SearchQueueJobData>): Promise<void> {
  const { searchId, query, location, licenseKey, licenseEmail, isTrial } = job.data;

  const emit = (event: StreamEvent) => {
    emitToStream(searchId, event);
    if (event.type === "complete" || event.type === "error") {
      clearStreamBuffer(searchId);
    }
  };

  const jobRecord = await getSearchJob(searchId);
  const trial = isTrial ?? jobRecord?.isTrial ?? false;

  logger.info("[search-worker] Job starting", {
    searchId,
    query,
    location,
    isTrial: trial,
  });

  await updateSearchJob(searchId, {
    status: "running",
    scrapingInProgress: !trial,
  });

  try {
    await runScraperJob(searchId, query, location, emit, {
      licenseKey,
      licenseEmail,
      isTrial: trial,
    });
  } catch (err) {
    const leadsCollected = await countSearchLeads(searchId);
    const existing = await getSearchJob(searchId);

    logger.error("[search-worker] Job error in processSearchJob", {
      searchId,
      query,
      location,
      leadsCollected,
      jobStatus: existing?.status,
      error: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
    });

    if (existing?.status === "completed" && leadsCollected > 0) {
      logger.info("[search-worker] Job already completed with results — skipping failure", {
        searchId,
        leadsCollected,
      });
      return;
    }

    if (leadsCollected > 0) {
      const email = await resolveJobEmail(searchId, licenseEmail);
      await finalizePartialJob(searchId, query, location, email, "process_error");
      return;
    }

    throw err;
  }
}

export function startSearchWorker(): Worker<SearchQueueJobData> | null {
  const connection = getRedisConnectionOptions();
  if (!connection) return null;
  if (worker) return worker;

  worker = new Worker<SearchQueueJobData>(SEARCH_QUEUE_NAME, processSearchJob, {
    connection,
    concurrency: WORKER_CONCURRENCY,
  });

  worker.on("active", (job) => {
    logger.info("Search queue job started", { searchId: job.data.searchId });
  });

  worker.on("completed", (job) => {
    logger.info("Search queue job completed", { searchId: job.data.searchId });
  });

  worker.on("failed", async (job, err) => {
    if (!job) return;
    const { searchId, query, location, licenseEmail } = job.data;
    const attempts = job.opts.attempts ?? 1;
    const isFinalFailure = job.attemptsMade >= attempts;

    const leadsCollected = await countSearchLeads(searchId).catch(() => 0);
    const existing = await getSearchJob(searchId).catch(() => null);

    logger.error("[search-worker] Search queue job failed", {
      searchId,
      query,
      location,
      attemptsMade: job.attemptsMade,
      final: isFinalFailure,
      leadsCollected,
      jobStatus: existing?.status,
      error: err.message,
      stack: err.stack,
    });

    if (!isFinalFailure) return;

    if (leadsCollected > 0 || existing?.status === "completed") {
      if (existing?.status !== "completed") {
        const email = await resolveJobEmail(searchId, licenseEmail);
        await finalizePartialJob(
          searchId,
          query,
          location,
          email,
          "queue_failed_handler"
        ).catch((finalizeErr) =>
          logger.error("[search-worker] Partial finalize in failed handler failed", {
            searchId,
            error:
              finalizeErr instanceof Error ? finalizeErr.message : "unknown",
          })
        );
      }
      return;
    }

    const message = err.message || "Search did not complete. Please try again.";
    await updateSearchJob(searchId, {
      status: "failed",
      error: message,
      scrapingInProgress: false,
    });
    emitToStream(searchId, { type: "error", message });
    clearStreamBuffer(searchId);

    const email = await resolveJobEmail(searchId, licenseEmail);
    if (email) {
      void sendSearchQueueFailureEmail(email, query, location).catch((emailErr) =>
        logger.error("Failed to send queue failure email", {
          searchId,
          error: emailErr instanceof Error ? emailErr.message : "unknown",
        })
      );
    }
  });

  worker.on("error", (err) => {
    logger.error("Search worker error", {
      error: err instanceof Error ? err.message : "unknown",
      stack: err instanceof Error ? err.stack : undefined,
    });
  });

  logger.info("BullMQ search worker started", {
    queue: SEARCH_QUEUE_NAME,
    concurrency: WORKER_CONCURRENCY,
  });

  return worker;
}

export async function stopSearchWorker(): Promise<void> {
  if (!worker) return;
  await worker.close();
  worker = null;
  logger.info("BullMQ search worker stopped");
}
