import { Router, type Request, type Response } from "express";
import { requireAdminAuth } from "../middleware/admin-auth";
import { logger } from "../utils/logger";
import {
  createJobForTopic,
  discoverAndQueueTopics,
  generateOneArticleDraft,
  getProviderStatus,
  publishReadyJob,
  runContentJob,
} from "./pipeline";
import {
  getContentSettings,
  getDashboardCounts,
  getJobById,
  listJobs,
  listTopics,
  updateContentSettings,
  updateJob,
} from "./repository";
import { processContentAutomationTick } from "./scheduler";

export const contentAutomationRouter = Router();

contentAutomationRouter.use(requireAdminAuth);

contentAutomationRouter.get("/status", async (_req: Request, res: Response) => {
  try {
    const [settings, counts, providers, recentJobs, recentFailed] = await Promise.all([
      getContentSettings(),
      getDashboardCounts(),
      Promise.resolve(getProviderStatus()),
      listJobs(undefined, 8),
      listJobs("FAILED", 5),
    ]);

    res.json({
      automation: settings.automation_enabled ? "running" : "paused",
      settings,
      today: {
        target: settings.daily_article_target,
        generated: counts.generatedToday,
        published: counts.publishedToday,
        failed: counts.failed,
        remaining: Math.max(
          0,
          settings.daily_article_target - counts.publishedToday
        ),
      },
      scheduler: {
        status:
          settings.automation_enabled || Number(settings.launch_batch_remaining || 0) > 0
            ? "RUNNING"
            : "PAUSED",
        process: "production-backend:startContentAutomationScheduler",
        frequency: "hourly (+45s after boot)",
        lastRun: settings.last_scheduler_run_at || null,
        lastResult: settings.last_scheduler_result || null,
        lastError: settings.last_scheduler_error || null,
        nextRun: settings.last_scheduler_run_at
          ? new Date(
              new Date(settings.last_scheduler_run_at).getTime() + 60 * 60 * 1000
            ).toISOString()
          : null,
        dailyTarget: settings.daily_article_target,
        launchBatchRemaining: settings.launch_batch_remaining || 0,
        serverSide: true,
        requiresAdminOpen: false,
        requiresBrowser: false,
      },
      queue: {
        topicsWaiting: counts.topicsWaiting,
        drafts: counts.drafts,
        scheduled: counts.scheduled,
        published: counts.published,
        failed: counts.failed,
      },
      seo: {
        searchConsole: "NOT CONNECTED",
        note: "Search Console metrics appear here when credentials are configured. Indexing is not claimed without evidence.",
      },
      recent: {
        jobs: recentJobs,
        failures: recentFailed,
      },
      providers,
    });
  } catch (err) {
    logger.error("Content automation status failed", {
      error: err instanceof Error ? err.message : "unknown",
    });
    res.status(500).json({ error: "Failed to load content automation status" });
  }
});

contentAutomationRouter.get("/settings", async (_req: Request, res: Response) => {
  try {
    res.json({ settings: await getContentSettings() });
  } catch (err) {
    res.status(500).json({ error: "Failed to load settings" });
  }
});

contentAutomationRouter.put("/settings", async (req: Request, res: Response) => {
  try {
    const settings = await updateContentSettings(req.body || {});
    res.json({ success: true, settings });
  } catch (err) {
    res.status(500).json({
      error: err instanceof Error ? err.message : "Failed to update settings",
    });
  }
});

contentAutomationRouter.post("/pause", async (_req: Request, res: Response) => {
  try {
    const settings = await updateContentSettings({ automation_enabled: false });
    res.json({ success: true, settings });
  } catch (err) {
    res.status(500).json({ error: "Failed to pause automation" });
  }
});

contentAutomationRouter.post("/resume", async (_req: Request, res: Response) => {
  try {
    const settings = await updateContentSettings({
      automation_enabled: true,
      auto_publishing: true,
    });
    res.json({ success: true, settings });
  } catch (err) {
    res.status(500).json({ error: "Failed to resume automation" });
  }
});

contentAutomationRouter.post("/discover-topics", async (req: Request, res: Response) => {
  try {
    const limit = Number((req.body as { limit?: number })?.limit) || 6;
    const result = await discoverAndQueueTopics(limit);
    res.json({ success: true, ...result, topics: await listTopics(undefined, 20) });
  } catch (err) {
    logger.error("Topic discovery failed", {
      error: err instanceof Error ? err.message : "unknown",
    });
    res.status(500).json({
      error: err instanceof Error ? err.message : "Topic discovery failed",
    });
  }
});

contentAutomationRouter.post("/generate-article", async (req: Request, res: Response) => {
  try {
    const body = req.body as { topicId?: string; title?: string; publish?: boolean };
    let job;
    if (body.topicId) {
      job = await createJobForTopic(body.topicId);
      job = await runContentJob(job.id, { publish: Boolean(body.publish) });
    } else {
      job = await generateOneArticleDraft(body.title);
      if (body.publish && job.status === "READY") {
        job = await publishReadyJob(job.id);
      }
    }
    res.json({ success: true, job });
  } catch (err) {
    logger.error("Generate article failed", {
      error: err instanceof Error ? err.message : "unknown",
    });
    res.status(500).json({
      error: err instanceof Error ? err.message : "Generate article failed",
    });
  }
});

contentAutomationRouter.post("/jobs/:id/publish", async (req: Request, res: Response) => {
  try {
    const job = await publishReadyJob(String(req.params.id));
    res.json({ success: true, job });
  } catch (err) {
    res.status(500).json({
      error: err instanceof Error ? err.message : "Publish failed",
    });
  }
});

contentAutomationRouter.post("/jobs/:id/retry", async (req: Request, res: Response) => {
  try {
    const existing = await getJobById(String(req.params.id));
    if (!existing) {
      res.status(404).json({ error: "Job not found" });
      return;
    }
    await updateJob(existing.id, { status: "RETRYING", error_message: null });
    const job = await runContentJob(existing.id, { publish: false });
    res.json({ success: true, job });
  } catch (err) {
    res.status(500).json({
      error: err instanceof Error ? err.message : "Retry failed",
    });
  }
});

contentAutomationRouter.get("/jobs", async (req: Request, res: Response) => {
  try {
    const status = typeof req.query.status === "string" ? req.query.status : undefined;
    const jobs = await listJobs(status as never, 50);
    res.json({ jobs });
  } catch (err) {
    res.status(500).json({ error: "Failed to list jobs" });
  }
});

contentAutomationRouter.get("/topics", async (req: Request, res: Response) => {
  try {
    const status = typeof req.query.status === "string" ? req.query.status : undefined;
    res.json({ topics: await listTopics(status, 50) });
  } catch (err) {
    res.status(500).json({ error: "Failed to list topics" });
  }
});

contentAutomationRouter.post("/tick", async (_req: Request, res: Response) => {
  try {
    await processContentAutomationTick();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Tick failed" });
  }
});
