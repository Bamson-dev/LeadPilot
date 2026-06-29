import type { Job } from "bullmq";
import { Worker } from "bullmq";
import type { StreamEvent } from "@leadthur/shared";
import { getSearchJob, markSearchFailed, updateSearchJob } from "../database/search-repository";
import { getLicenseEmailBySearchId } from "../database/license-repository";
import { runScraperJob, forceFinalizeSearchJob } from "../services/scraper-service";
import { clearStreamBuffer, emitToStream } from "../services/stream-registry";
import { sendSearchQueueFailureEmail } from "../services/email";
import { logger } from "../utils/logger";
import { SEARCH_QUEUE_NAME, type SearchQueueJobData } from "../queue/search-queue-types";
import { getRedisConnectionOptions } from "../queue/redis-connection";

const WORKER_CONCURRENCY = 2;
const JOB_TIMEOUT_MS = 5 * 60 * 1000;

let worker: Worker<SearchQueueJobData> | null = null;

async function runWithTimeout<T>(
  work: Promise<T>,
  ms: number,
  onTimeout: () => Promise<void>
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      work,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => {
          void onTimeout().finally(() => {
            reject(new Error("Search job timed out after 5 minutes"));
          });
        }, ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
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

  await updateSearchJob(searchId, {
    status: "running",
    scrapingInProgress: !trial,
  });

  const resolveEmail = async (): Promise<string | null> => {
    if (licenseEmail?.trim()) return licenseEmail.toLowerCase().trim();
    return getLicenseEmailBySearchId(searchId);
  };

  const timeoutFinalize = async () => {
    logger.warn("Search job hit 5-minute worker timeout — finalizing partial results", {
      searchId,
    });
    const email = await resolveEmail();
    await forceFinalizeSearchJob(searchId, query, location, email, true);
    emit({
      type: "complete",
      total: (await getSearchJob(searchId))?.totalFound ?? 0,
      message: `Search complete. Partial results saved for ${location}.`,
    });
  };

  await runWithTimeout(
    runScraperJob(searchId, query, location, emit, {
      licenseKey,
      licenseEmail,
      isTrial: trial,
    }),
    JOB_TIMEOUT_MS,
    timeoutFinalize
  );
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

    logger.error("Search queue job failed", {
      searchId,
      attemptsMade: job.attemptsMade,
      final: isFinalFailure,
      error: err.message,
    });

    if (!isFinalFailure) return;

    const message = err.message || "Search did not complete. Please try again.";
    await markSearchFailed(searchId, message);
    await updateSearchJob(searchId, { scrapingInProgress: false });
    emitToStream(searchId, { type: "error", message });
    clearStreamBuffer(searchId);

    const email =
      licenseEmail?.trim() || (await getLicenseEmailBySearchId(searchId));
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
