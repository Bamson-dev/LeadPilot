import { DelayedError, Worker, type Job, type Queue } from "bullmq";
import { logger } from "../utils/logger";
import { getRedisConnectionOptions } from "../queue/redis-connection";
import {
  OUTREACH_BULLMQ_LOCK_DURATION_MS,
  OUTREACH_BULLMQ_MAX_STALLED_COUNT,
  OUTREACH_BULLMQ_STALLED_INTERVAL_MS,
  OUTREACH_SEND_QUEUE_NAME,
  type OutreachSendJobData,
} from "../queue/outreach-send-queue-types";
import { processOutreachSendJob } from "../services/outreach-send-service";

let worker: Worker<OutreachSendJobData> | null = null;

export function startOutreachSendWorker(queue?: Queue<OutreachSendJobData>): Worker<OutreachSendJobData> | null {
  const connection = getRedisConnectionOptions();
  if (!connection) return null;
  if (worker) return worker;

  worker = new Worker<OutreachSendJobData>(
    OUTREACH_SEND_QUEUE_NAME,
    async (job: Job<OutreachSendJobData>) => {
      const outcome = await processOutreachSendJob(job.data);
      if (outcome.action === "requeue") {
        await job.moveToDelayed(Date.now() + outcome.delayMs);
        throw new DelayedError(outcome.reason);
      }
    },
    {
      connection,
      concurrency: 5,
      lockDuration: OUTREACH_BULLMQ_LOCK_DURATION_MS,
      stalledInterval: OUTREACH_BULLMQ_STALLED_INTERVAL_MS,
      maxStalledCount: OUTREACH_BULLMQ_MAX_STALLED_COUNT,
    }
  );

  worker.on("stalled", (jobId) => {
    logger.error("[outreach-send-worker] BullMQ job stalled — lock may have expired during spacing or SMTP", {
      bullJobId: jobId,
      lockDurationMs: OUTREACH_BULLMQ_LOCK_DURATION_MS,
    });
  });

  worker.on("failed", (job, err) => {
    if (err instanceof DelayedError) return;
    logger.error("Outreach send job failed", {
      sentEmailId: job?.data.sentEmailId,
      error: err instanceof Error ? err.message : "unknown",
    });
  });

  void queue;
  return worker;
}

export async function stopOutreachSendWorker(): Promise<void> {
  if (!worker) return;
  await worker.close();
  worker = null;
}
