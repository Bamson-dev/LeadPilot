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

const HOUR_MS = 60 * 60 * 1000;
let interval: ReturnType<typeof setInterval> | null = null;
let tickRunning = false;

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

export async function processContentAutomationTick(): Promise<void> {
  if (tickRunning) return;
  tickRunning = true;
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

    const publishedToday = await countPublishedToday();
    const dailyCap = settings.daily_article_target;
    if (publishedToday >= dailyCap && launchRemaining <= 0) {
      logger.info("Daily article target already met", { publishedToday });
      await repairFailedJobImages(4);
      return;
    }

    // Publish due scheduled jobs — respects 3-hour interval (restart-safe)
    const scheduled = await listJobs("SCHEDULED", 20);
    const now = Date.now();
    for (const job of scheduled.sort((a, b) => {
      const ta = a.scheduled_for ? new Date(a.scheduled_for).getTime() : 0;
      const tb = b.scheduled_for ? new Date(b.scheduled_for).getTime() : 0;
      return ta - tb;
    })) {
      if ((await countPublishedToday()) >= dailyCap && launchRemaining <= 0) break;
      const freshSettings = await getContentSettings();
      if (!canPublishScheduledJob(freshSettings, job.scheduled_for, now)) {
        continue;
      }
      try {
        await publishReadyJob(job.id);
      } catch (err) {
        logger.error("ARTICLE_PUBLISH_FAILED", {
          jobId: job.id,
          error: err instanceof Error ? err.message : "unknown",
        });
      }
    }

    // Retry failed/retrying jobs carefully
    const retrying = await listJobs("RETRYING", 5);
    for (const job of retrying) {
      if (job.attempt_count >= settings.max_retries) {
        await updateJob(job.id, { status: "FAILED" });
        continue;
      }
      await runContentJob(job.id, { publish: false });
    }

    // Ensure topic/job supply
    const ready = await listJobs("READY", 10);
    const qualifiedJobs = await listJobs("QUALIFIED", 10);
    if (ready.length + qualifiedJobs.length < Math.max(dailyCap, launchRemaining)) {
      await discoverAndQueueTopics(Math.max(dailyCap, launchRemaining, 4));
    }

    // Launch batch: generate + schedule (never immediate publish)
    let remainingLaunch = launchRemaining;
    let launchAttempts = 0;
    while (remainingLaunch > 0 && launchAttempts < remainingLaunch + 6) {
      launchAttempts += 1;
      const nextQualified = (await listJobs("QUALIFIED", 1))[0];
      const nextReady = (await listJobs("READY", 1))[0];
      if (nextReady) {
        try {
          if (settings.auto_publishing) {
            await scheduleJobForNextSlot(nextReady.id);
          } else {
            await publishReadyJob(nextReady.id);
          }
          remainingLaunch -= 1;
          await updateContentSettings({ launch_batch_remaining: remainingLaunch });
        } catch (err) {
          logger.error("Launch batch schedule failed", {
            error: err instanceof Error ? err.message : "unknown",
          });
          break;
        }
        continue;
      }
      if (nextQualified) {
        const generated = await runContentJob(nextQualified.id, { publish: false });
        if (generated.status === "READY") {
          if (settings.auto_publishing) {
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

    // Steady-state: schedule existing READY drafts, then generate if the
    // pipeline does not already cover today's remaining target.
    if (settings.automation_enabled && remainingLaunch <= 0) {
      if ((await countPublishedToday()) < dailyCap) {
        if (settings.auto_publishing) {
          const readyJobs = await listJobs("READY", 10);
          for (const job of readyJobs) {
            if ((await countPublishedToday()) >= dailyCap) break;
            await scheduleJobForNextSlot(job.id);
          }
        }

        const scheduledCount = (await listJobs("SCHEDULED", 20)).length;
        const readyCount = (await listJobs("READY", 20)).length;
        const remainingToday = dailyCap - (await countPublishedToday());
        if (scheduledCount + readyCount < remainingToday) {
          const nextQualified = (await listJobs("QUALIFIED", 1))[0];
          if (nextQualified) {
            logger.info("CONTENT_GENERATION_STARTED", { jobId: nextQualified.id });
            const generated = await runContentJob(nextQualified.id, { publish: false });
            if (generated.status === "READY") {
              logger.info("CONTENT_GENERATION_COMPLETED", {
                jobId: generated.id,
                quality: generated.quality_score,
              });
              if (settings.auto_publishing) {
                await scheduleJobForNextSlot(generated.id);
              }
            } else if (generated.status === "FAILED") {
              logger.error("CONTENT_GENERATION_FAILED", {
                jobId: generated.id,
                error: generated.error_message,
              });
            }
          }
        }
      }
    }

    logger.info("Content automation scheduler completed", {
      publishedToday: await countPublishedToday(),
      target: dailyCap,
      launchRemaining: remainingLaunch,
    });

    await repairFailedJobImages(4);
  } catch (err) {
    tickResult = "FAILED";
    tickError = err instanceof Error ? err.message : "unknown";
    logger.error("Content automation tick failed", { error: tickError });
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
  interval = setInterval(() => {
    void processContentAutomationTick();
  }, HOUR_MS);
  logger.info("Content automation scheduler started (hourly)");
}

export function stopContentAutomationScheduler(): void {
  if (interval) {
    clearInterval(interval);
    interval = null;
  }
}

// Exported for tests
export { computeNextPublicationAfterPublish, computeNextPublicationAt };
