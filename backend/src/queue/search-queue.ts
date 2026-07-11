import { Queue } from "bullmq";
import { listOrphanedPendingSearchJobs } from "../database/search-repository";
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
import { pruneStaleSearchQueueJobs } from "./search-queue-prune";
import {
  SEARCH_QUEUE_NAME,
  type AdminQueueMetrics,
  type SearchQueueJobData,
  type SearchQueueStatus,
} from "./search-queue-types";

let bullQueue: Queue<SearchQueueJobData> | null = null;
let initialized = false;
let reconcileTimer: ReturnType<typeof setInterval> | null = null;

const ORPHAN_PENDING_MIN_AGE_MINUTES = 1;
const ORPHAN_RECONCILE_INTERVAL_MS = 60_000;
const PENDING_JOB_WATCH_DELAYS_MS = [30_000, 90_000, 180_000] as const;

export { SEARCH_QUEUE_NAME, type SearchQueueJobData, type SearchQueueStatus };

async function addBullSearchJob(data: SearchQueueJobData): Promise<void> {
  if (!bullQueue) {
    throw new Error("BullMQ search queue is not initialized");
  }

  const existing = await bullQueue.getJob(data.searchId);
  if (existing) {
    const state = await existing.getState();
    if (
      state === "active" ||
      state === "waiting" ||
      state === "delayed" ||
      state === "prioritized"
    ) {
      return;
    }
    if (state === "completed" || state === "failed") {
      await existing.remove().catch(() => undefined);
    }
  }

  const job = await bullQueue.add("run-search", data, {
    jobId: data.searchId,
    priority: data.isTrial ? 1 : 5,
  });
  const state = await job.getState();
  logger.info("[search-queue] BullMQ job enqueued", {
    searchId: data.searchId,
    state,
    isTrial: data.isTrial ?? false,
  });
}

export async function reconcileOrphanedPendingSearchJobs(): Promise<{
  checked: number;
  requeued: number;
}> {
  const orphans = await listOrphanedPendingSearchJobs(ORPHAN_PENDING_MIN_AGE_MINUTES);
  let requeued = 0;

  for (const orphan of orphans) {
    if (orphan.isTrial) {
      const existing = bullQueue ? await bullQueue.getJob(orphan.searchId) : null;
      if (existing) {
        await existing.remove().catch(() => undefined);
      }
      inlineSearchQueue.schedule(orphan);
      requeued += 1;
      logger.warn("[search-queue] Re-queued orphaned trial job on inline queue", {
        searchId: orphan.searchId,
        query: orphan.query,
        location: orphan.location,
      });
      continue;
    }

    if (!bullQueue || !isRedisQueueEnabled()) {
      continue;
    }

    const existing = await bullQueue.getJob(orphan.searchId);
    const state = existing ? await existing.getState() : "missing";

    if (
      state === "active" ||
      state === "waiting" ||
      state === "delayed" ||
      state === "prioritized"
    ) {
      continue;
    }

    if (existing && (state === "completed" || state === "failed")) {
      await existing.remove().catch(() => undefined);
    }

    await addBullSearchJob(orphan);
    requeued += 1;
    logger.warn("[search-queue] Re-queued orphaned pending search job", {
      searchId: orphan.searchId,
      query: orphan.query,
      location: orphan.location,
      priorBullState: state,
    });
  }

  return { checked: orphans.length, requeued };
}

function schedulePendingJobWatch(data: SearchQueueJobData): void {
  if (data.isTrial) return;

  if (!bullQueue || !isRedisQueueEnabled()) return;

  for (const delayMs of PENDING_JOB_WATCH_DELAYS_MS) {
    setTimeout(() => {
      void (async () => {
        try {
          const { getSearchJob } = await import("../database/search-repository");
          const record = await getSearchJob(data.searchId);
          if (!record || record.status !== "pending") return;

          const bullJob = await bullQueue!.getJob(data.searchId);
          const state = bullJob ? await bullJob.getState() : "missing";
          if (
            state === "active" ||
            state === "waiting" ||
            state === "delayed" ||
            state === "prioritized"
          ) {
            return;
          }

          if (bullJob && (state === "completed" || state === "failed")) {
            await bullJob.remove().catch(() => undefined);
          }

          await addBullSearchJob(data);
          logger.warn("[search-queue] Pending job watch re-enqueued search", {
            searchId: data.searchId,
            delayMs,
            priorBullState: state,
          });
        } catch (err) {
          logger.error("[search-queue] Pending job watch failed", {
            searchId: data.searchId,
            delayMs,
            error: err instanceof Error ? err.message : "unknown",
          });
        }
      })();
    }, delayMs);
  }
}

function scheduleOrphanReconciliation(): void {
  if (reconcileTimer) return;
  reconcileTimer = setInterval(() => {
    void (async () => {
      if (bullQueue) {
        try {
          const pruned = await pruneStaleSearchQueueJobs(bullQueue);
          if (pruned.removed > 0) {
            logger.info("[search-queue] Interval stale job prune", pruned);
          }
        } catch (err) {
          logger.error("[search-queue] Interval stale job prune failed", {
            error: err instanceof Error ? err.message : "unknown",
          });
        }
      }
      const result = await reconcileOrphanedPendingSearchJobs();
      if (result.requeued > 0) {
        logger.info("[search-queue] Orphan reconcile interval", result);
      }
    })();
  }, ORPHAN_RECONCILE_INTERVAL_MS);
}

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

  try {
    const { checked, removed } = await pruneStaleSearchQueueJobs(bullQueue);
    if (checked > 0 || removed > 0) {
      logger.info("Search queue startup prune", {
        queue: SEARCH_QUEUE_NAME,
        checked,
        removed,
      });
    }
  } catch (err) {
    logger.error("Search queue startup prune failed — worker will still start", {
      error: err instanceof Error ? err.message : "unknown",
    });
  }

  startSearchWorker();
  scheduleOrphanReconciliation();
  void reconcileOrphanedPendingSearchJobs().then((result) => {
    if (result.checked > 0 || result.requeued > 0) {
      logger.info("[search-queue] Orphan reconcile on startup", result);
    }
  });
  logger.info("BullMQ search queue initialized", {
    name: SEARCH_QUEUE_NAME,
    lockDurationMs: BULLMQ_LOCK_DURATION_MS,
  });
}

export function isBullSearchQueueActive(): boolean {
  return isRedisQueueEnabled() && bullQueue !== null;
}

export async function shutdownSearchQueue(): Promise<void> {
  if (reconcileTimer) {
    clearInterval(reconcileTimer);
    reconcileTimer = null;
  }
  await stopSearchWorker();
  if (bullQueue) {
    await bullQueue.close();
    bullQueue = null;
  }
  initialized = false;
}

export function recoverStuckTrialSearch(job: {
  id: string;
  query: string;
  location: string;
  status: string;
  isTrial?: boolean;
}): void {
  if (!job.isTrial || job.status !== "pending") return;
  if (inlineSearchQueue.isTracked(job.id)) return;

  logger.warn("[search-queue] Recovering stuck trial search on inline queue", {
    searchId: job.id,
    query: job.query,
    location: job.location,
  });
  inlineSearchQueue.schedule({
    searchId: job.id,
    query: job.query,
    location: job.location,
    isTrial: true,
  });
}

export async function enqueueSearchJob(data: SearchQueueJobData): Promise<void> {
  if (data.isTrial) {
    logSearchLifecycle("job_enqueued", data.searchId, {
      query: data.query,
      location: data.location,
      queue: "inline-trial",
    });
    inlineSearchQueue.schedule(data);
    return;
  }

  logSearchLifecycle("job_enqueued", data.searchId, {
    query: data.query,
    location: data.location,
    queue: bullQueue && isRedisQueueEnabled() ? "bullmq" : "inline",
  });

  if (bullQueue && isRedisQueueEnabled()) {
    try {
      await addBullSearchJob(data);
      schedulePendingJobWatch(data);
      return;
    } catch (err) {
      logger.error("Failed to enqueue BullMQ search job — using inline fallback", {
        searchId: data.searchId,
        error: err instanceof Error ? err.message : "unknown",
      });
    }
  }

  inlineSearchQueue.schedule(data);
}

export async function getSearchQueuePosition(searchId: string): Promise<number> {
  const inlinePos = inlineSearchQueue.getQueuePositionForSearch(searchId);
  if (inlinePos) return inlinePos;

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
      const inline = inlineSearchQueue.getStatus();
      return {
        running: (counts.active ?? 0) + inline.running,
        queued:
          (counts.waiting ?? 0) +
          (counts.delayed ?? 0) +
          (counts.prioritized ?? 0) +
          inline.queued,
        maxConcurrent: 2,
        inline,
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
