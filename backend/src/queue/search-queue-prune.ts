import type { Queue } from "bullmq";
import { getSearchJob } from "../database/search-repository";
import { logger } from "../utils/logger";
import { SEARCH_QUEUE_NAME } from "./search-queue-types";

const PRUNE_STATES = [
  "active",
  "waiting",
  "delayed",
  "prioritized",
  "failed",
] as const;

/**
 * Remove BullMQ search jobs whose searchId no longer exists in search_jobs
 * (e.g. after a Supabase DB recreate while Redis still holds old queue entries).
 * Only touches leadthur-search-queue — never the outreach send queue.
 */
export async function pruneStaleSearchQueueJobs(
  queue: Queue
): Promise<{ checked: number; removed: number }> {
  let checked = 0;
  let removed = 0;

  for (const state of PRUNE_STATES) {
    const jobs = await queue.getJobs([state], 0, 499).catch(() => []);
    for (const job of jobs) {
      checked += 1;
      const searchId = job.data?.searchId?.trim();
      if (!searchId) {
        await job.remove().catch(() => undefined);
        removed += 1;
        continue;
      }

      const record = await getSearchJob(searchId).catch(() => null);
      if (!record) {
        await job.remove().catch(() => undefined);
        removed += 1;
        logger.warn("[search-queue] Pruned BullMQ job with missing search_jobs row", {
          queue: SEARCH_QUEUE_NAME,
          searchId,
          bullJobId: job.id,
          state,
        });
        continue;
      }

      if (
        (state === "waiting" || state === "delayed" || state === "prioritized") &&
        (record.status === "completed" || record.status === "failed")
      ) {
        await job.remove().catch(() => undefined);
        removed += 1;
        logger.warn("[search-queue] Pruned BullMQ job already terminal in DB", {
          queue: SEARCH_QUEUE_NAME,
          searchId,
          bullJobId: job.id,
          state,
          dbStatus: record.status,
        });
      }
    }
  }

  if (removed > 0) {
    logger.info("[search-queue] Stale job prune complete", {
      queue: SEARCH_QUEUE_NAME,
      checked,
      removed,
    });
  }

  return { checked, removed };
}
