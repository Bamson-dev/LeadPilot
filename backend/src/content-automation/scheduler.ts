import {
  countPublishedToday,
  getContentSettings,
  listJobs,
  updateContentSettings,
  updateJob,
} from "./repository";
import {
  discoverAndQueueTopics,
  publishReadyJob,
  repairFailedJobImages,
  runContentJob,
  scheduleReadyJob,
} from "./pipeline";
import {
  canPublishScheduledJob,
  computeNextPublicationAfterPublish,
  computeNextPublicationAt,
} from "./publish-schedule";
import { logger } from "../utils/logger";

const TICK_MS = 15 * 60 * 1000;
const TICK_WATCHDOG_MS = 20 * 60 * 1000;
const MAX_GENERATIONS_PER_TICK = 2;
let interval: ReturnType<typeof setInterval> | null = null;
let tickRunning = false;
let tickStartedAt = 0;

async function runIsolated(label: string, fn: () => Promise<void>): Promise<void> {
  try {
    await fn();
  } catch (err) {
    logger.error("Content automation phase failed; continuing", {
      phase: label,
      error: err instanceof Error ? err.message : "unknown",
    });
  }
}

async function scheduleJobForNextSlot(jobId: string): Promise<void> {
  const settings = await getContentSettings();
  const when = computeNextPublicationAt(settings);
  await scheduleReadyJob(jobId, when);
  await updateContentSettings({
    next_scheduled_publication_at: when.toISOString(),
  } as never);
  logger.info("ARTICLE_PUBLISH_SCHEDULED", {
    jobId,
    scheduledFor: when.toISOString(),
    intervalHours: settings.publishing_interval_hours ?? 3,
  });
}

async function publishDueJobs(dailyCap: number, launchRemaining: number): Promise<number> {
  let published = 0;
  const scheduled = await listJobs("SCHEDULED", 20);
  const now = Date.now();
  const ordered = [...scheduled].sort((a, b) => {
    const ta = a.scheduled_for ? new Date(a.scheduled_for).getTime() : 0;
    const tb = b.scheduled_for ? new Date(b.scheduled_for).getTime() : 0;
    return ta - tb;
  });

  for (const job of ordered) {
    if ((await countPublishedToday()) >= dailyCap && launchRemaining <= 0) break;
    const freshSettings = await getContentSettings();
    if (!canPublishScheduledJob(freshSettings, job.scheduled_for, now)) continue;
    try {
      await publishReadyJob(job.id);
      published += 1;
    } catch (err) {
      logger.error("ARTICLE_PUBLISH_FAILED", {
        jobId: job.id,
        error: err instanceof Error ? err.message : "unknown",
      });
    }
  }
  return published;
}

async function queueReadyDrafts(dailyCap: number): Promise<number> {
  const settings = await getContentSettings();
  if (!settings.auto_publishing) return 0;
  if ((await countPublishedToday()) >= dailyCap) return 0;
  const readyJobs = await listJobs("READY", 10);
  let queued = 0;
  for (const job of readyJobs) {
    if ((await countPublishedToday()) >= dailyCap) break;
    await scheduleJobForNextSlot(job.id);
    queued += 1;
  }
  return queued;
}

async function ensureTopicSupply(dailyCap: number, launchRemaining: number): Promise<void> {
  const ready = await listJobs("READY", 10);
  const scheduled = await listJobs("SCHEDULED", 10);
  const qualified = await listJobs("QUALIFIED", 10);
  const needed = Math.max(dailyCap, launchRemaining, 4);
  if (ready.length + scheduled.length + qualified.length < needed) {
    await discoverAndQueueTopics(needed);
  }
}

async function fillGenerationPipeline(dailyCap: number): Promise<void> {
  const settings = await getContentSettings();
  let attempts = 0;
  while (attempts < MAX_GENERATIONS_PER_TICK) {
    if ((await countPublishedToday()) >= dailyCap) return;
    const remainingToday = dailyCap - (await countPublishedToday());
    const scheduledCount = (await listJobs("SCHEDULED", 20)).length;
    const readyCount = (await listJobs("READY", 20)).length;
    if (scheduledCount + readyCount >= remainingToday) return;

    let nextQualified = (await listJobs("QUALIFIED", 1))[0];
    if (!nextQualified) {
      await discoverAndQueueTopics(4);
      nextQualified = (await listJobs("QUALIFIED", 1))[0];
      if (!nextQualified) return;
    }

    attempts += 1;
    logger.info("CONTENT_GENERATION_STARTED", { jobId: nextQualified.id });
    try {
      const generated = await runContentJob(nextQualified.id, { publish: false });
      if (generated.status === "READY") {
        logger.info("CONTENT_GENERATION_COMPLETED", {
          jobId: generated.id,
          quality: generated.quality_score,
        });
        if (settings.auto_publishing) {
          await scheduleJobForNextSlot(generated.id);
        }
      } else {
        logger.error("CONTENT_GENERATION_FAILED", {
          jobId: generated.id,
          status: generated.status,
          error: generated.error_message,
        });
      }
    } catch (err) {
      logger.error("CONTENT_GENERATION_FAILED", {
        jobId: nextQualified.id,
        error: err instanceof Error ? err.message : "unknown",
      });
    }
  }
}

async function retryTransientJobs(): Promise<void> {
  const settings = await getContentSettings();
  const retrying = await listJobs("RETRYING", 5);
  for (const job of retrying) {
    try {
      if (job.attempt_count >= settings.max_retries) {
        await updateJob(job.id, { status: "FAILED" });
        continue;
      }
      await runContentJob(job.id, { publish: false });
    } catch (err) {
      logger.error("Content job retry failed; continuing", {
        jobId: job.id,
        error: err instanceof Error ? err.message : "unknown",
      });
    }
  }
}

export async function processContentAutomationTick(): Promise<void> {
  if (tickRunning) {
    if (Date.now() - tickStartedAt < TICK_WATCHDOG_MS) return;
    logger.error("Content automation tick watchdog reset stuck run");
    tickRunning = false;
  }
  tickRunning = true;
  tickStartedAt = Date.now();
  let tickResult: "SUCCESS" | "FAILED" = "SUCCESS";
  let tickError: string | null = null;
  try {
    logger.info("SCHEDULER_TICK", { module: "content_automation" });
    const settings = await getContentSettings();
    const launchRemaining = Number(settings.launch_batch_remaining || 0);
    const active = settings.automation_enabled || launchRemaining > 0;
    if (!active) {
      logger.info("Content automation paused");
      return;
    }

    const dailyCap = settings.daily_article_target;

    // 1. Always publish due work first. Generation failures must never block this.
    await runIsolated("publish_due", async () => {
      await publishDueJobs(dailyCap, launchRemaining);
    });

    const publishedToday = await countPublishedToday();
    if (publishedToday >= dailyCap && launchRemaining <= 0) {
      logger.info("Daily article target already met", { publishedToday });
      await runIsolated("repair_images", async () => {
        await repairFailedJobImages(4);
      });
      return;
    }

    // 2. Move every READY draft onto the 3-hour calendar, then publish if due now.
    await runIsolated("queue_ready", async () => {
      await queueReadyDrafts(dailyCap);
    });
    await runIsolated("publish_due_after_queue", async () => {
      await publishDueJobs(dailyCap, launchRemaining);
    });

    // 3. Retry transient jobs without stopping the publisher.
    await runIsolated("retry_jobs", async () => {
      await retryTransientJobs();
    });

    // 4. Keep topic supply full so a failed article never empties the queue.
    await runIsolated("topic_supply", async () => {
      await ensureTopicSupply(dailyCap, launchRemaining);
    });

    // Launch batch: generate + schedule (never immediate publish)
    let remainingLaunch = launchRemaining;
    await runIsolated("launch_batch", async () => {
      let launchAttempts = 0;
      while (remainingLaunch > 0 && launchAttempts < remainingLaunch + 6) {
        launchAttempts += 1;
        const nextQualified = (await listJobs("QUALIFIED", 1))[0];
        const nextReady = (await listJobs("READY", 1))[0];
        if (nextReady) {
          const current = await getContentSettings();
          if (current.auto_publishing) {
            await scheduleJobForNextSlot(nextReady.id);
          } else {
            await publishReadyJob(nextReady.id);
          }
          remainingLaunch -= 1;
          await updateContentSettings({ launch_batch_remaining: remainingLaunch });
          continue;
        }
        if (nextQualified) {
          const generated = await runContentJob(nextQualified.id, { publish: false });
          if (generated.status === "READY") {
            const current = await getContentSettings();
            if (current.auto_publishing) {
              await scheduleJobForNextSlot(generated.id);
            } else {
              await publishReadyJob(generated.id);
            }
            remainingLaunch -= 1;
            await updateContentSettings({ launch_batch_remaining: remainingLaunch });
          } else {
            logger.error("Launch batch item failed; continuing with next topic", {
              status: generated.status,
              error: generated.error_message,
            });
            await discoverAndQueueTopics(3);
          }
          continue;
        }
        await discoverAndQueueTopics(4);
        const created = (await listJobs("QUALIFIED", 1))[0];
        if (!created) break;
      }
    });

    // 5. Fill today's remaining slots. A failed generation tries the next topic.
    if (settings.automation_enabled && remainingLaunch <= 0) {
      await runIsolated("generate_pipeline", async () => {
        await fillGenerationPipeline(dailyCap);
      });
      await runIsolated("publish_due_after_generate", async () => {
        await publishDueJobs(dailyCap, remainingLaunch);
      });
    }

    logger.info("Content automation scheduler completed", {
      publishedToday: await countPublishedToday(),
      target: dailyCap,
      launchRemaining: remainingLaunch,
    });

    await runIsolated("repair_images", async () => {
      await repairFailedJobImages(4);
    });
  } catch (err) {
    tickResult = "FAILED";
    tickError = err instanceof Error ? err.message : "unknown";
    logger.error("Content automation tick failed", { error: tickError });
    await runIsolated("publish_due_after_error", async () => {
      const settings = await getContentSettings();
      await publishDueJobs(
        settings.daily_article_target,
        Number(settings.launch_batch_remaining || 0)
      );
    });
  } finally {
    try {
      await updateContentSettings({
        last_scheduler_run_at: new Date().toISOString(),
        last_scheduler_result: tickResult,
        last_scheduler_error: tickError,
      } as never);
    } catch {
      /* ignore heartbeat write failures */
    }
    tickRunning = false;
  }
}

export function startContentAutomationScheduler(): void {
  if (interval) return;
  setTimeout(() => {
    void processContentAutomationTick();
  }, 45_000);
  setTimeout(() => {
    void publishMissedBlogBacklog().catch((err) => {
      logger.error("Startup blog backlog catch-up failed", {
        error: err instanceof Error ? err.message : "unknown",
      });
    });
  }, 90_000);
  interval = setInterval(() => {
    void processContentAutomationTick();
  }, TICK_MS);
  logger.info("Content automation scheduler started (15-minute publish-first ticks)");
}

export function stopContentAutomationScheduler(): void {
  if (interval) {
    clearInterval(interval);
    interval = null;
  }
}

/** Publish all READY and overdue SCHEDULED blog jobs (catch-up after outage). */
export async function publishMissedBlogBacklog(maxPosts = 40): Promise<{
  published: number;
  skipped: number;
  errors: string[];
}> {
  const errors: string[] = [];
  let published = 0;
  let skipped = 0;
  const now = Date.now();

  const ready = await listJobs("READY", maxPosts);
  const scheduled = await listJobs("SCHEDULED", maxPosts);
  const dueScheduled = scheduled.filter((job) => {
    if (!job.scheduled_for) return true;
    return new Date(job.scheduled_for).getTime() <= now;
  });

  const queue = [...ready, ...dueScheduled];
  logger.info("Blog backlog catch-up starting", { ready: ready.length, dueScheduled: dueScheduled.length });

  for (const job of queue) {
    if (published >= maxPosts) break;
    if (!job.blog_post_id) {
      skipped += 1;
      continue;
    }
    try {
      await publishReadyJob(job.id, { bypassDailyCap: true });
      published += 1;
    } catch (err) {
      const message = err instanceof Error ? err.message : "unknown";
      if (message.includes("not publishable") || message.includes("no blog post")) {
        skipped += 1;
        continue;
      }
      errors.push(`${job.id}: ${message}`);
    }
  }

  logger.info("Blog backlog catch-up finished", { published, skipped, errors: errors.length });
  return { published, skipped, errors };
}

// Exported for tests
export { computeNextPublicationAfterPublish, computeNextPublicationAt };
