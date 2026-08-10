import {
  countPublishedToday,
  getContentSettings,
  listJobs,
  updateContentSettings,
  updateJob,
} from "./repository";
import { discoverAndQueueTopics, publishReadyJob, repairFailedJobImages, runContentJob } from "./pipeline";
import { logger } from "../utils/logger";

const HOUR_MS = 60 * 60 * 1000;
let interval: ReturnType<typeof setInterval> | null = null;
let tickRunning = false;

function nextSlotDate(slotHours: number[]): Date {
  const now = new Date();
  const sorted = [...slotHours].sort((a, b) => a - b);
  for (const hour of sorted) {
    const candidate = new Date(now);
    candidate.setUTCMinutes(0, 0, 0);
    candidate.setUTCHours(hour);
    if (candidate.getTime() > now.getTime() + 5 * 60 * 1000) return candidate;
  }
  const tomorrow = new Date(now);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  tomorrow.setUTCMinutes(0, 0, 0);
  tomorrow.setUTCHours(sorted[0] ?? 8);
  return tomorrow;
}

export async function processContentAutomationTick(): Promise<void> {
  if (tickRunning) return;
  tickRunning = true;
  let tickResult: "SUCCESS" | "FAILED" = "SUCCESS";
  let tickError: string | null = null;
  try {
    logger.info("Content automation scheduler tick");
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
      // Still attempt cover repairs for published jobs with failed images.
      await repairFailedJobImages(2);
      return;
    }

    // Publish due scheduled jobs first
    const scheduled = await listJobs("SCHEDULED", 20);
    const now = Date.now();
    for (const job of scheduled) {
      if (!job.scheduled_for) continue;
      if (new Date(job.scheduled_for).getTime() > now) continue;
      if ((await countPublishedToday()) >= dailyCap && launchRemaining <= 0) break;
      try {
        await publishReadyJob(job.id);
      } catch (err) {
        logger.error("Scheduled publish failed", {
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

    // Launch batch: generate + publish immediately until remaining hits 0
    let remainingLaunch = launchRemaining;
    let launchAttempts = 0;
    while (remainingLaunch > 0 && launchAttempts < remainingLaunch + 6) {
      launchAttempts += 1;
      const nextQualified = (await listJobs("QUALIFIED", 1))[0];
      const nextReady = (await listJobs("READY", 1))[0];
      if (nextReady) {
        try {
          await publishReadyJob(nextReady.id);
          remainingLaunch -= 1;
          await updateContentSettings({ launch_batch_remaining: remainingLaunch });
          logger.info("Launch batch published ready job", { remainingLaunch });
        } catch (err) {
          logger.error("Launch batch publish failed", {
            error: err instanceof Error ? err.message : "unknown",
          });
          break;
        }
        continue;
      }
      if (nextQualified) {
        const generated = await runContentJob(nextQualified.id, { publish: true });
        if (generated.status === "PUBLISHED") {
          remainingLaunch -= 1;
          await updateContentSettings({ launch_batch_remaining: remainingLaunch });
          logger.info("Launch batch progress", { remainingLaunch });
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

    // Steady-state: advance one qualified job per tick when automation enabled
    if (settings.automation_enabled && remainingLaunch <= 0) {
      if ((await countPublishedToday()) < dailyCap) {
        const nextQualified = (await listJobs("QUALIFIED", 1))[0];
        if (nextQualified) {
          const generated = await runContentJob(nextQualified.id, { publish: false });
          if (generated.status === "READY" && settings.auto_publishing) {
            const slot = nextSlotDate(settings.publish_slot_hours);
            await updateJob(generated.id, {
              status: "SCHEDULED",
              scheduled_for: slot.toISOString(),
            });
          }
        }
      }
    }

    logger.info("Content automation scheduler completed", {
      publishedToday: await countPublishedToday(),
      target: dailyCap,
      launchRemaining: remainingLaunch,
    });

    // Opportunistic cover repair (does not create new articles).
    await repairFailedJobImages(2);
  } catch (err) {
    tickResult = "FAILED";
    tickError = err instanceof Error ? err.message : "unknown";
    logger.error("Content automation tick failed", {
      error: tickError,
    });
  } finally {
    try {
      const next = new Date(Date.now() + HOUR_MS).toISOString();
      await updateContentSettings({
        last_scheduler_run_at: new Date().toISOString(),
        last_scheduler_result: tickResult,
        last_scheduler_error: tickError,
      } as never);
      void next;
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
