import { supabase } from "../database/client";
import { getContentSettings } from "./repository";
import { getProviderStatus } from "./pipeline";
import { getLocalStorageStats } from "../storage/blog-cover-storage";
import { isDeepseekConfigured } from "../utils/deepseek-config";

export type HealthLevel = "healthy" | "degraded" | "failing" | "missing";

async function recentRunStats(
  stage: string,
  provider?: string
): Promise<{ ok: boolean; lastAt: string | null; failCount: number }> {
  let q = supabase
    .from("content_generation_runs")
    .select("success, created_at, provider")
    .eq("stage", stage)
    .order("created_at", { ascending: false })
    .limit(20);
  if (provider) q = q.eq("provider", provider);
  const { data } = await q;
  const rows = data || [];
  const last = rows[0];
  const failCount = rows.filter((r) => !r.success).length;
  return {
    ok: Boolean(last?.success),
    lastAt: last?.created_at ?? null,
    failCount,
  };
}

function levelFrom(ok: boolean, configured: boolean, failCount: number): HealthLevel {
  if (!configured) return "missing";
  if (!ok && failCount >= 3) return "failing";
  if (!ok || failCount >= 1) return "degraded";
  return "healthy";
}

export async function getAutomationHealth(): Promise<Record<string, unknown>> {
  const [
    settings,
    storage,
    deepseekRuns,
    openaiRuns,
    gscConn,
    gscSyncRun,
    seoSettings,
    lastPublished,
    nextScheduled,
  ] = await Promise.all([
    getContentSettings(),
    getLocalStorageStats(),
    recentRunStats("generation", "deepseek"),
    recentRunStats("image_generation", "openai"),
    supabase
      .from("google_search_console_connections")
      .select("status, last_sync_at")
      .limit(1)
      .maybeSingle(),
    supabase
      .from("google_search_console_sync_runs")
      .select("status, finished_at")
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("seo_optimization_settings")
      .select("seo_optimization_enabled, last_scheduler_run_at, last_scheduler_result")
      .eq("id", 1)
      .maybeSingle(),
    supabase
      .from("content_jobs")
      .select("published_at, meta")
      .eq("status", "PUBLISHED")
      .order("published_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("content_jobs")
      .select("scheduled_for, meta, status")
      .eq("status", "SCHEDULED")
      .order("scheduled_for", { ascending: true })
      .limit(1)
      .maybeSingle(),
  ]);

  const providers = getProviderStatus();

  return {
    contentAutomation: {
      status: settings.automation_enabled ? "RUNNING" : "PAUSED",
      lastSchedulerRun: settings.last_scheduler_run_at,
      lastPublication: settings.last_publication_at,
      nextScheduledPublication: settings.next_scheduled_publication_at,
      publishingIntervalHours: settings.publishing_interval_hours ?? 3,
    },
    seoIntelligence: {
      status: seoSettings.data?.seo_optimization_enabled ? "RUNNING" : "PAUSED",
      lastRun: seoSettings.data?.last_scheduler_run_at ?? null,
      lastResult: seoSettings.data?.last_scheduler_result ?? null,
    },
    gscSync: {
      status: gscConn.data?.status === "connected" ? "RUNNING" : "NOT_CONNECTED",
      lastSync: gscConn.data?.last_sync_at ?? null,
      lastRunStatus: gscSyncRun.data?.status ?? null,
      lastRunFinished: gscSyncRun.data?.finished_at ?? null,
    },
    publishingScheduler: {
      status: settings.automation_enabled && settings.auto_publishing ? "RUNNING" : "PAUSED",
      intervalHours: settings.publishing_interval_hours ?? 3,
      nextPublication: settings.next_scheduled_publication_at,
      lastPublication: settings.last_publication_at,
    },
    imageStorage: {
      provider: settings.image_storage_provider ?? "local",
      supabaseFallbackAvailable: true,
      ...storage,
    },
    queue: {
      status: "HEALTHY",
      mode: "hourly_scheduler",
    },
    providers: {
      deepseek: {
        level: levelFrom(deepseekRuns.ok, isDeepseekConfigured(), deepseekRuns.failCount),
        lastSuccess: deepseekRuns.lastAt,
        failCount: deepseekRuns.failCount,
        configured: providers.deepseek,
      },
      tavily: { level: providers.tavily === "connected" ? "healthy" : "missing" },
      serper: { level: providers.serper === "connected" ? "healthy" : "missing" },
      openai: {
        level: levelFrom(openaiRuns.ok, providers.openai === "connected", openaiRuns.failCount),
        lastSuccess: openaiRuns.lastAt,
        failCount: openaiRuns.failCount,
      },
      gsc: {
        level: gscConn.data?.status === "connected" ? "healthy" : "missing",
        lastSync: gscConn.data?.last_sync_at ?? null,
      },
      localStorage: {
        level: storage.healthy ? "healthy" : "degraded",
        imageCount: storage.imageCount,
      },
    },
    lastSuccessfulArticle: lastPublished.data
      ? {
          publishedAt: lastPublished.data.published_at,
          title: (lastPublished.data.meta as { title?: string })?.title ?? null,
        }
      : null,
    nextScheduledArticle: nextScheduled.data
      ? {
          scheduledFor: nextScheduled.data.scheduled_for,
          title: (nextScheduled.data.meta as { title?: string })?.title ?? null,
        }
      : null,
  };
}
