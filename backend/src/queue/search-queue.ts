import { Queue } from "bullmq";
import { logger } from "../utils/logger";
import {
  getRedisConnectionOptions,
  isRedisQueueEnabled,
  probeRedisConnection,
} from "./redis-connection";
import { inlineSearchQueue } from "./inline-search-fallback";
import { startSearchWorker, stopSearchWorker } from "../workers/search-worker";
import { logSearchLifecycle } from "../utils/search-job-lifecycle";
import {
  BULLMQ_LOCK_DURATION_MS,
} from "../scraper/utils/constants";
import {
  SEARCH_QUEUE_NAME,
  type AdminQueueMetrics,
  type SearchQueueJobData,
  type SearchQueueStatus,
} from "./search-queue-types";

let bullQueue: Queue<SearchQueueJobData> | null = null;
let initialized = false;

export { SEARCH_QUEUE_NAME, type SearchQueueJobData, type SearchQueueStatus };

export async function initSearchQueue(): Promise<void> {
  if (initialized) return;
  initialized = true;

  const redisOk = await probeRedisConnection();
  if (!redisOk) {
    logger.warn(
      "Using inline search queue fallback (concurrency 2). Set REDIS_URL to enable BullMQ."
    );
    return;
  }

  const connection = getRedisConnectionOptions();
  if (!connection) return;

  bullQueue = new Queue<SearchQueueJobData>(SEARCH_QUEUE_NAME, {
    connection,
    defaultJobOptions: {
      attempts: 2,
      backoff: { type: "fixed", delay: 10_000 },
      removeOnComplete: { age: 3600, count: 500 },
      removeOnFail: { age: 86_400, count: 200 },
    },
  });

  startSearchWorker();
  logger.info("BullMQ search queue initialized", {
    name: SEARCH_QUEUE_NAME,
    lockDurationMs: BULLMQ_LOCK_DURATION_MS,
  });
}

export function isBullSearchQueueActive(): boolean {
  return isRedisQueueEnabled() && bullQueue !== null;
}

export async function shutdownSearchQueue(): Promise<void> {
  await stopSearchWorker();
  if (bullQueue) {
    await bullQueue.close();
    bullQueue = null;
  }
  initialized = false;
}

export async function enqueueSearchJob(data: SearchQueueJobData): Promise<void> {
  logSearchLifecycle("job_enqueued", data.searchId, {
    query: data.query,
    location: data.location,
    queue: bullQueue && isRedisQueueEnabled() ? "bullmq" : "inline",
  });

  if (bullQueue && isRedisQueueEnabled()) {
    try {
      await bullQueue.add("run-search", data, {
        jobId: data.searchId,
      });
      return;
    } catch (err) {
      logger.error("Failed to enqueue BullMQ search job — using inline fallback", {
        searchId: data.searchId,
        error: err instanceof Error ? err.message : "unknown",
      });
    }
  }

  await inlineSearchQueue.add(data);
}

export async function getSearchQueuePosition(searchId: string): Promise<number> {
  if (bullQueue && isRedisQueueEnabled()) {
    try {
      const job = await bullQueue.getJob(searchId);
      if (!job) return 0;
      const state = await job.getState();
      if (state === "active" || state === "completed" || state === "failed") {
        return 0;
      }
      if (state === "waiting" || state === "delayed" || state === "prioritized") {
        const waiting = await bullQueue.getJobs(["waiting", "delayed", "prioritized"]);
        const idx = waiting.findIndex((j) => j.id === searchId);
        return idx >= 0 ? idx + 1 : 0;
      }
      return 0;
    } catch {
      return inlineSearchQueue.getQueuePositionForSearch(searchId) ?? 0;
    }
  }

  return inlineSearchQueue.getQueuePositionForSearch(searchId) ?? 0;
}

export function getSearchQueueStatus(): SearchQueueStatus {
  if (bullQueue && isRedisQueueEnabled()) {
    return {
      running: 0,
      queued: 0,
      maxConcurrent: 2,
      mode: "bullmq",
    };
  }
  const inline = inlineSearchQueue.getStatus();
  return {
    running: inline.running,
    queued: inline.queued,
    maxConcurrent: inline.maxConcurrent,
    mode: "inline",
  };
}

export async function refreshSearchQueueStatus(): Promise<SearchQueueStatus> {
  if (bullQueue && isRedisQueueEnabled()) {
    try {
      const counts = await bullQueue.getJobCounts(
        "active",
        "waiting",
        "delayed",
        "prioritized"
      );
      return {
        running: counts.active ?? 0,
        queued: (counts.waiting ?? 0) + (counts.delayed ?? 0) + (counts.prioritized ?? 0),
        maxConcurrent: 2,
        mode: "bullmq",
      };
    } catch {
      /* fall through */
    }
  }
  return getSearchQueueStatus();
}

export async function getAdminQueueMetrics(): Promise<AdminQueueMetrics> {
  if (bullQueue && isRedisQueueEnabled()) {
    try {
      const counts = await bullQueue.getJobCounts(
        "active",
        "waiting",
        "delayed",
        "prioritized",
        "failed"
      );
      const failedJobs = await bullQueue.getJobs(["failed"], 0, 200);
      const cutoff = Date.now() - 24 * 60 * 60 * 1000;
      const failedLast24h = failedJobs.filter((job) => {
        const ts = job.finishedOn ?? job.timestamp;
        return ts >= cutoff;
      }).length;

      return {
        active: counts.active ?? 0,
        waiting:
          (counts.waiting ?? 0) + (counts.delayed ?? 0) + (counts.prioritized ?? 0),
        failedLast24h,
        mode: "bullmq",
      };
    } catch (err) {
      logger.error("Failed to read BullMQ queue metrics", {
        error: err instanceof Error ? err.message : "unknown",
      });
    }
  }

  return inlineSearchQueue.getAdminMetrics();
}

/** @deprecated Use refreshSearchQueueStatus — kept for health endpoint sync shape */
export const searchQueue = {
  getStatus: getSearchQueueStatus,
};

export function enqueueSearch(
  searchId: string,
  query: string,
  location: string,
  options?: { licenseKey?: string; licenseEmail?: string; isTrial?: boolean }
): void {
  const data: SearchQueueJobData = {
    searchId,
    query,
    location,
    licenseKey: options?.licenseKey,
    licenseEmail: options?.licenseEmail,
    isTrial: options?.isTrial,
  };

  void enqueueSearchJob(data).catch((err) => {
    logger.error("Search enqueue failed", {
      searchId,
      error: err instanceof Error ? err.message : "unknown",
    });
  });
}

export function getQueuePosition(searchId: string): number | null {
  void searchId;
  return null;
}

export async function resolveQueuePosition(searchId: string): Promise<number> {
  return getSearchQueuePosition(searchId);
}
