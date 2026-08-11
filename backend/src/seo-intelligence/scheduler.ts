import { logger } from "../utils/logger";
import { analyzeSeoOpportunities } from "./analysis";
import { optimizeOpportunity } from "./optimization";
import { evaluateMonitoringJobs } from "./monitoring";
import {
  getSeoSettings,
  listOpportunities,
  updateSeoSettings,
} from "./repository";

const HOUR_MS = 60 * 60 * 1000;
let interval: ReturnType<typeof setInterval> | null = null;
let tickRunning = false;

export async function processSeoIntelligenceTick(): Promise<void> {
  if (tickRunning) return;
  tickRunning = true;
  try {
    const settings = await getSeoSettings();
    await updateSeoSettings({
      last_scheduler_run_at: new Date().toISOString(),
    });

    // Always evaluate monitoring (read-only GSC comparison).
    const monitored = await evaluateMonitoringJobs();

    // Opportunity analysis (daily-ish via last_analysis_at).
    const lastAnalysis = settings.last_analysis_at
      ? new Date(settings.last_analysis_at).getTime()
      : 0;
    const analysisDue = Date.now() - lastAnalysis > 20 * 60 * 60 * 1000;
    let analyzed = 0;
    if (analysisDue) {
      const result = await analyzeSeoOpportunities(28);
      analyzed = result.created;
      await updateSeoSettings({ last_analysis_at: new Date().toISOString() });
    }

    let optimized = 0;
    if (settings.seo_optimization_enabled) {
      const candidates = (await listOpportunities({ status: "RECOMMENDED", limit: 20 }))
        .filter((o) => o.opportunity_type !== "rising_content" && o.blog_post_id)
        .sort((a, b) => Number(b.opportunity_score) - Number(a.opportunity_score));

      for (const opp of candidates.slice(0, 1)) {
        const res = await optimizeOpportunity(opp.id);
        if (res.ok) {
          optimized += 1;
          break; // at most one per tick; daily cap enforced inside optimizeOpportunity
        }
      }
    }

    const summary = `analyzed=${analyzed}; optimized=${optimized}; monitored=${monitored}`;
    await updateSeoSettings({
      last_scheduler_result: summary,
      last_scheduler_error: null,
    });
    logger.info("SEO Intelligence tick completed", { summary });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown";
    logger.error("SEO Intelligence tick failed", { error: message });
    try {
      await updateSeoSettings({ last_scheduler_error: message.slice(0, 500) });
    } catch {
      /* ignore */
    }
  } finally {
    tickRunning = false;
  }
}

export function startSeoIntelligenceScheduler(): void {
  if (interval) return;
  setTimeout(() => {
    void processSeoIntelligenceTick();
  }, 120_000);
  interval = setInterval(() => {
    void processSeoIntelligenceTick();
  }, HOUR_MS);
  logger.info("SEO Intelligence scheduler started (hourly due-check)");
}

export function stopSeoIntelligenceScheduler(): void {
  if (interval) {
    clearInterval(interval);
    interval = null;
  }
}
