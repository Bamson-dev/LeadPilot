import { Router, type Request, type Response } from "express";
import { requireAdminAuth } from "../middleware/admin-auth";
import { logger } from "../utils/logger";
import { analyzeSeoOpportunities } from "./analysis";
import { optimizeOpportunity } from "./optimization";
import { evaluateMonitoringJobs } from "./monitoring";
import {
  getOpportunity,
  getOverviewStats,
  getPublishedBlogPostById,
  getSeoSettings,
  listOpportunities,
  listOptimizationJobs,
  getOptimizationJob,
  updateSeoSettings,
  restoreArticleFromVersion,
  getLatestVersionForJob,
} from "./repository";

export const seoIntelligenceRouter = Router();

seoIntelligenceRouter.get("/status", requireAdminAuth, async (_req, res) => {
  try {
    const [settings, overview] = await Promise.all([
      getSeoSettings(),
      getOverviewStats(),
    ]);
    res.json({
      settings: {
        seoOptimizationEnabled: settings.seo_optimization_enabled,
        maxOptimizationsPerDay: settings.max_optimizations_per_day,
        cooldownDays: settings.cooldown_days,
        firstRunCompleted: settings.first_run_completed,
        lastAnalysisAt: settings.last_analysis_at,
        lastOptimizationAt: settings.last_optimization_at,
        lastSchedulerRunAt: settings.last_scheduler_run_at,
        lastSchedulerResult: settings.last_scheduler_result,
        lastSchedulerError: settings.last_scheduler_error,
      },
      overview,
    });
  } catch (err) {
    res.status(500).json({
      error: err instanceof Error ? err.message : "status_failed",
    });
  }
});

seoIntelligenceRouter.get("/opportunities", requireAdminAuth, async (req, res) => {
  try {
    const status = typeof req.query.status === "string" ? req.query.status : undefined;
    const rows = await listOpportunities({
      status: status as never,
      limit: 100,
    });
    res.json({ opportunities: rows });
  } catch (err) {
    res.status(500).json({
      error: err instanceof Error ? err.message : "opportunities_failed",
    });
  }
});

seoIntelligenceRouter.get("/opportunities/:id", requireAdminAuth, async (req, res) => {
  try {
    const id = String(req.params.id);
    const opportunity = await getOpportunity(id);
    if (!opportunity) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    const post = opportunity.blog_post_id
      ? await getPublishedBlogPostById(opportunity.blog_post_id)
      : null;
    res.json({
      opportunity,
      article: post
        ? {
            id: post.id,
            title: post.title,
            slug: post.slug,
            url: `https://www.leadthur.com/blog/${post.slug}`,
            metaTitle: post.meta_title,
            metaDescription: post.meta_description,
          }
        : null,
    });
  } catch (err) {
    res.status(500).json({
      error: err instanceof Error ? err.message : "opportunity_failed",
    });
  }
});

seoIntelligenceRouter.get("/optimizations", requireAdminAuth, async (_req, res) => {
  try {
    const jobs = await listOptimizationJobs(50);
    res.json({ optimizations: jobs });
  } catch (err) {
    res.status(500).json({
      error: err instanceof Error ? err.message : "optimizations_failed",
    });
  }
});

seoIntelligenceRouter.get("/optimizations/:id", requireAdminAuth, async (req, res) => {
  try {
    const id = String(req.params.id);
    const job = await getOptimizationJob(id);
    if (!job) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    const version = await getLatestVersionForJob(job.id);
    res.json({ optimization: job, version });
  } catch (err) {
    res.status(500).json({
      error: err instanceof Error ? err.message : "optimization_failed",
    });
  }
});

seoIntelligenceRouter.post("/analyze", requireAdminAuth, async (_req, res) => {
  try {
    const result = await analyzeSeoOpportunities(28);
    await updateSeoSettings({ last_analysis_at: new Date().toISOString() });
    res.json({
      ok: true,
      created: result.created,
      opportunities: result.opportunities.slice(0, 50),
    });
  } catch (err) {
    logger.error("SEO analyze failed", {
      error: err instanceof Error ? err.message : "unknown",
    });
    res.status(500).json({
      error: err instanceof Error ? err.message : "analyze_failed",
    });
  }
});

seoIntelligenceRouter.post("/optimize/:id", requireAdminAuth, async (req, res) => {
  try {
    const result = await optimizeOpportunity(String(req.params.id), { force: true });
    res.status(result.ok ? 200 : 400).json(result);
  } catch (err) {
    res.status(500).json({
      error: err instanceof Error ? err.message : "optimize_failed",
    });
  }
});

seoIntelligenceRouter.post("/pause", requireAdminAuth, async (_req, res) => {
  try {
    const settings = await updateSeoSettings({ seo_optimization_enabled: false });
    res.json({ ok: true, enabled: settings.seo_optimization_enabled });
  } catch (err) {
    res.status(500).json({
      error: err instanceof Error ? err.message : "pause_failed",
    });
  }
});

seoIntelligenceRouter.post("/resume", requireAdminAuth, async (_req, res) => {
  try {
    const settings = await updateSeoSettings({ seo_optimization_enabled: true });
    res.json({ ok: true, enabled: settings.seo_optimization_enabled });
  } catch (err) {
    res.status(500).json({
      error: err instanceof Error ? err.message : "resume_failed",
    });
  }
});

seoIntelligenceRouter.get("/performance", requireAdminAuth, async (_req, res) => {
  try {
    const [jobs, overview, settings] = await Promise.all([
      listOptimizationJobs(50),
      getOverviewStats(),
      getSeoSettings(),
    ]);
    const evaluated = await evaluateMonitoringJobs();
    res.json({
      overview,
      settings: {
        enabled: settings.seo_optimization_enabled,
        maxPerDay: settings.max_optimizations_per_day,
        firstRunCompleted: settings.first_run_completed,
      },
      recentJobs: jobs,
      monitoringEvaluated: evaluated,
    });
  } catch (err) {
    res.status(500).json({
      error: err instanceof Error ? err.message : "performance_failed",
    });
  }
});

seoIntelligenceRouter.post(
  "/optimizations/:id/rollback",
  requireAdminAuth,
  async (req: Request, res: Response) => {
    try {
      const version = await getLatestVersionForJob(String(req.params.id));
      if (!version?.id) {
        res.status(404).json({ error: "version_not_found" });
        return;
      }
      await restoreArticleFromVersion(version.id);
      res.json({ ok: true, restoredVersionId: version.id });
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : "rollback_failed",
      });
    }
  }
);
