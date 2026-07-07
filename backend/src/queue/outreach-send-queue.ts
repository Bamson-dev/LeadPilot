import { Queue } from "bullmq";
import { logger } from "../utils/logger";
import {
  getRedisConnectionOptions,
  isRedisQueueEnabled,
} from "./redis-connection";
import {
  OUTREACH_BULLMQ_LOCK_DURATION_MS,
  OUTREACH_BULLMQ_MAX_STALLED_COUNT,
  OUTREACH_BULLMQ_STALLED_INTERVAL_MS,
  OUTREACH_SEND_QUEUE_NAME,
  type OutreachSendJobData,
} from "./outreach-send-queue-types";
import { startOutreachSendWorker, stopOutreachSendWorker } from "../workers/outreach-send-worker";
import { processOutreachSendJob } from "../services/outreach-send-service";

let bullQueue: Queue<OutreachSendJobData> | null = null;
let initialized = false;
const inlinePending: OutreachSendJobData[] = [];
let inlineProcessing = false;

export { OUTREACH_SEND_QUEUE_NAME, type OutreachSendJobData };

export async function initOutreachSendQueue(): Promise<void> {
  if (initialized) return;
  initialized = true;

  if (!isRedisQueueEnabled()) {
    logger.warn(
      "Outreach send queue using inline fallback. Set REDIS_URL to enable BullMQ outreach worker."
    );
    return;
  }

  const connection = getRedisConnectionOptions();
  if (!connection) return;

  bullQueue = new Queue<OutreachSendJobData>(OUTREACH_SEND_QUEUE_NAME, {
    connection,
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: "fixed", delay: 5_000 },
      removeOnComplete: { age: 86_400, count: 1000 },
      removeOnFail: { age: 86_400, count: 500 },
    },
  });

  startOutreachSendWorker(bullQueue);
  logger.info("BullMQ outreach send queue initialized", {
    name: OUTREACH_SEND_QUEUE_NAME,
    lockDurationMs: OUTREACH_BULLMQ_LOCK_DURATION_MS,
    stalledIntervalMs: OUTREACH_BULLMQ_STALLED_INTERVAL_MS,
    maxStalledCount: OUTREACH_BULLMQ_MAX_STALLED_COUNT,
  });
}

export function isBullOutreachSendQueueActive(): boolean {
  return isRedisQueueEnabled() && bullQueue !== null;
}

export async function shutdownOutreachSendQueue(): Promise<void> {
  await stopOutreachSendWorker();
  if (bullQueue) {
    await bullQueue.close();
    bullQueue = null;
  }
  initialized = false;
}

async function drainInlineQueue(): Promise<void> {
  if (inlineProcessing) return;
  inlineProcessing = true;
  try {
    while (inlinePending.length > 0) {
      const job = inlinePending.shift()!;
      let outcome = await processOutreachSendJob(job);
      while (outcome.action === "requeue") {
        const { delayMs } = outcome;
        await new Promise((r) => setTimeout(r, delayMs));
        outcome = await processOutreachSendJob(job);
      }
    }
  } finally {
    inlineProcessing = false;
  }
}

export async function enqueueOutreachSendJob(
  data: OutreachSendJobData,
  options?: { delayMs?: number }
): Promise<void> {
  if (bullQueue && isRedisQueueEnabled()) {
    await bullQueue.add("send-outreach-email", data, {
      jobId: `outreach-${data.sentEmailId}`,
      delay: Math.max(0, options?.delayMs ?? 0),
    });
    return;
  }

  if ((options?.delayMs ?? 0) > 0) {
    setTimeout(() => {
      inlinePending.push(data);
      void drainInlineQueue();
    }, options?.delayMs);
    return;
  }

  inlinePending.push(data);
  void drainInlineQueue();
}

/** Test helper: wait until inline queue finishes processing. */
export async function flushInlineOutreachSendQueue(): Promise<void> {
  while (inlinePending.length > 0 || inlineProcessing) {
    await drainInlineQueue();
    if (inlinePending.length === 0 && !inlineProcessing) break;
    await new Promise((r) => setTimeout(r, 50));
  }
}
