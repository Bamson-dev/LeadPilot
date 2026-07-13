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
  recoverSearchJobEmailScraping,
  runScraperJob,
} from "../services/scraper-service";
import { clearStreamBuffer, emitToStream } from "../services/stream-registry";
import { sendSearchQueueFailureEmail } from "../services/email";
import { logger } from "../utils/logger";
import { logSearchLifecycle } from "../utils/search-job-lifecycle";
import {
  BULLMQ_LOCK_DURATION_MS,
  BULLMQ_MAX_STALLED_COUNT,
  BULLMQ_STALLED_INTERVAL_MS,
  SEARCH_JOB_TIMEOUT_MS,
} from "../scraper/utils/constants";
import { SEARCH_QUEUE_NAME, type SearchQueueJobData } from "../queue/search-queue-types";
import { getRedisConnectionOptions } from "../queue/redis-connection";
import { getBrowserPool } from "../scraper/browser/browser-pool";

const WORKER_CONCURRENCY = 2;

async function runScraperJobWithHardTimeout(
  ...args: Parameters<typeof runScraperJob>
): Promise<void> {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  try {
    await Promise.race([
      runScraperJob(...args),
      new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => {
          reject(
            new Error(
              `Search exceeded the ${Math.round(SEARCH_JOB_TIMEOUT_MS / 60_000)} minute limit. Please try again.`
            )
          );
        }, SEARCH_JOB_TIMEOUT_MS);
      }),
    ]);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes("exceeded the") && message.includes("minute limit")) {
      // Hung Playwright sessions keep holding pool slots after the race rejects.
      // Reset the pool so the rest of the queue can proceed.
      try {
        await getBrowserPool().resetAfterDeadlock();
      } catch (resetErr) {
        logger.error("[search-worker] Browser pool reset after timeout failed", {
          error: resetErr instanceof Error ? resetErr.message : "unknown",
        });
      }
    }
    throw err;
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

let worker: Worker<SearchQueueJobData> | null = null;

async function getSearchJobWithRetry(searchId: string) {
  const delays = [0, 500, 1500, 3000];
  for (const delayMs of delays) {
    if (delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
    const record = await getSearchJob(searchId);
    if (record) return record;
  }
  return null;
}

async function resolveJobEmail(
  searchId: string,
  licenseEmail?: string | null
): Promise<string | null> {
  if (licenseEmail?.trim()) return licenseEmail.toLowerCase().trim();
  return getLicenseEmailBySearchId(searchId);
}

async function processSearchJob(job: Job<SearchQueueJobData>): Promise<void> {
  const { searchId, query, location, licenseKey, licenseEmail, isTrial } = job.data;
  const jobStartedAt = Date.now();

  const emit = (event: StreamEvent) => {
    emitToStream(searchId, event);
    if (event.type === "complete" || event.type === "error") {
      clearStreamBuffer(searchId);
    }
  };

  const jobRecord = await getSearchJobWithRetry(searchId);
  if (!jobRecord) {
    throw new Error(`search_jobs row missing for ${searchId}`);
  }

  const trial = isTrial ?? jobRecord.isTrial ?? false;

  logSearchLifecycle("job_dequeued", searchId, {
    queue: "bullmq",
    bullJobId: job.id,
    attemptsMade: job.attemptsMade,
  });
  logSearchLifecycle("job_processing_start", searchId, {
    queue: "bullmq",
    query,
    location,
    lockDurationMs: BULLMQ_LOCK_DURATION_MS,
  });

  logger.info("[search-worker] Job starting", {
    searchId,
    query,
    location,
    isTrial: trial,
    bullJobId: job.id,
  });

  await updateSearchJob(searchId, {
    status: "running",
    scrapingInProgress: !trial,
  });

  try {
    await runScraperJobWithHardTimeout(searchId, query, location, emit, {
      licenseKey,
      licenseEmail,
      isTrial: trial,
      jobStartedAt,
    });
    logSearchLifecycle("job_processing_end", searchId, {
      queue: "bullmq",
      elapsedMs: Date.now() - jobStartedAt,
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
      emailScrapingComplete: existing?.emailScrapingComplete,
      error: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
    });

    if (leadsCollected > 0 && !existing?.emailScrapingComplete) {
      await recoverSearchJobEmailScraping(searchId, query, location, emit, {
        licenseEmail,
        jobStartedAt,
        licenseKey,
      });
      return;
    }

    if (existing?.status === "completed" && existing?.emailScrapingComplete) {
      logger.info("[search-worker] Job already fully completed — skipping failure", {
        searchId,
        leadsCollected,
      });
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
    lockDuration: BULLMQ_LOCK_DURATION_MS,
    stalledInterval: BULLMQ_STALLED_INTERVAL_MS,
    maxStalledCount: BULLMQ_MAX_STALLED_COUNT,
  });

  worker.on("active", (job) => {
    logger.info("Search queue job started", { searchId: job.data.searchId, bullJobId: job.id });
  });

  worker.on("completed", (job) => {
    logger.info("Search queue job completed", { searchId: job.data.searchId, bullJobId: job.id });
  });

  worker.on("stalled", (jobId) => {
    logger.error("[search-worker] BullMQ job stalled — lock may have expired during long Phase 1", {
      bullJobId: jobId,
      lockDurationMs: BULLMQ_LOCK_DURATION_MS,
    });
  });

  worker.on("failed", async (job, err) => {
    if (!job) return;
    const { searchId, query, location, licenseEmail, licenseKey } = job.data;
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
      emailScrapingComplete: existing?.emailScrapingComplete,
      error: err.message,
      stack: err.stack,
    });

    if (!isFinalFailure) return;

    const emit = (event: StreamEvent) => {
      emitToStream(searchId, event);
      if (event.type === "complete" || event.type === "error") {
        clearStreamBuffer(searchId);
      }
    };

    if (leadsCollected > 0 && !existing?.emailScrapingComplete) {
      await recoverSearchJobEmailScraping(searchId, query, location, emit, {
        licenseEmail,
        licenseKey,
      }).catch((recoverErr) =>
        logger.error("[search-worker] Phase 2 recovery in failed handler failed", {
          searchId,
          error: recoverErr instanceof Error ? recoverErr.message : "unknown",
        })
      );
      return;
    }

    if (existing?.emailScrapingComplete) {
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
    lockDurationMs: BULLMQ_LOCK_DURATION_MS,
    stalledIntervalMs: BULLMQ_STALLED_INTERVAL_MS,
    maxStalledCount: BULLMQ_MAX_STALLED_COUNT,
  });

  return worker;
}

export async function stopSearchWorker(): Promise<void> {
  if (!worker) return;
  await worker.close();
  worker = null;
  logger.info("BullMQ search worker stopped");
}
