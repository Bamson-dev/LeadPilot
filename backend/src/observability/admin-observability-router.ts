import { Router, type Request, type Response } from "express";
import { requireAdminAuth } from "../middleware/admin-auth";
import { supabase } from "../database/client";
import { logger } from "../utils/logger";
import { FUNNEL_STEPS, EVENT_NAMES } from "./event-taxonomy";
import { ALERT_CATALOGUE, evaluateAlertsFromCounts } from "./alerts";
import { getApiLatencySnapshot } from "./latency-metrics";
import { registerObservabilityPolishRoutes } from "./admin-observability-polish";
import { getAdminQueueMetrics } from "../queue/search-queue";
import { getRedisUrl } from "../queue/redis-connection";
import { countAnalyticsEvents, listAnalyticsEvents } from "./analytics-data-source";
import { cached } from "./query-cache";

const router = Router();

function parseRange(req: Request): { from: string; to: string } {
  const to = typeof req.query.to === "string" ? req.query.to : new Date().toISOString();
  const from =
    typeof req.query.from === "string"
      ? req.query.from
      : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  return { from, to };
}

function parsePaging(req: Request): { limit: number; offset: number } {
  const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 200);
  const offset = Math.max(Number(req.query.offset) || 0, 0);
  return { limit, offset };
}

function applyEventDimensionFilters<T extends { eq: (col: string, val: string) => T }>(
  query: T,
  req: Request
): T {
  let q = query;
  const country = typeof req.query.country === "string" ? req.query.country : null;
  const device = typeof req.query.device === "string" ? req.query.device : null;
  const browser = typeof req.query.browser === "string" ? req.query.browser : null;
  const utmSource = typeof req.query.utmSource === "string" ? req.query.utmSource : null;
  const utmMedium = typeof req.query.utmMedium === "string" ? req.query.utmMedium : null;
  const utmCampaign = typeof req.query.utmCampaign === "string" ? req.query.utmCampaign : null;
  const referrer = typeof req.query.referrer === "string" ? req.query.referrer : null;
  if (country) q = q.eq("country", country);
  if (device) q = q.eq("device", device);
  if (browser) q = q.eq("browser", browser);
  if (utmSource) q = q.eq("utm_source", utmSource);
  if (utmMedium) q = q.eq("utm_medium", utmMedium);
  if (utmCampaign) q = q.eq("utm_campaign", utmCampaign);
  if (referrer) q = q.eq("referrer", referrer);
  return q;
}

router.get("/overview", requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const { from, to } = parseRange(req);
    const cacheKey = `obs:overview:${from}:${to}`;
    const payload = await cached(cacheKey, 120_000, async () => {
      const names = [
        EVENT_NAMES.LANDING_VIEWED,
        EVENT_NAMES.FREETRIAL_VIEWED,
        EVENT_NAMES.TRIAL_EMAIL_SUBMITTED,
        EVENT_NAMES.CHECKOUT_STARTED,
        EVENT_NAMES.PAYMENT_COMPLETED,
        EVENT_NAMES.LICENSE_ACTIVATED,
        EVENT_NAMES.SEARCH_STARTED,
        EVENT_NAMES.SEARCH_COMPLETED,
        EVENT_NAMES.SEARCH_FAILED,
        EVENT_NAMES.CSV_EXPORT,
        EVENT_NAMES.MAILBOX_CONNECTED,
        EVENT_NAMES.EMAIL_SENT,
      ];

      const counts: Record<string, number> = {};
      await Promise.all(
        names.map(async (name) => {
          counts[name] = await countAnalyticsEvents({ from, to, eventName: name });
        })
      );

      const { count: openAlerts } = await supabase
        .from("analytics_alerts")
        .select("id", { count: "exact", head: true })
        .eq("status", "open");

      return {
        from,
        to,
        counts,
        openAlerts: openAlerts ?? 0,
        note: "Counts are from server-local analytics (Supabase sync disabled by default).",
      };
    });
    res.json(payload);
  } catch (err) {
    logger.error("[observability] overview failed", {
      error: err instanceof Error ? err.message : "unknown",
    });
    res.status(500).json({ error: "Failed to load observability overview" });
  }
});

router.get("/events", requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const { from, to } = parseRange(req);
    const { limit, offset } = parsePaging(req);
    const eventName = typeof req.query.eventName === "string" ? req.query.eventName : null;
    const category = typeof req.query.category === "string" ? req.query.category : null;
    const search = typeof req.query.q === "string" ? req.query.q.trim() : "";
    const sort = req.query.sort === "asc";

    const { rows, total } = await listAnalyticsEvents(
      { from, to, eventName, category, search: search || undefined },
      { limit, offset, ascending: sort }
    );

    res.json({
      events: rows,
      total,
      limit,
      offset,
      from,
      to,
    });
  } catch (err) {
    logger.error("[observability] events query failed", {
      error: err instanceof Error ? err.message : "unknown",
    });
    res.status(500).json({ events: [], total: 0, error: "Failed to load events" });
  }
});

router.get("/funnels", requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const { from, to } = parseRange(req);
    const steps = await Promise.all(
      FUNNEL_STEPS.map(async (step) => {
        const count = await countAnalyticsEvents({ from, to, eventName: step });
        const { rows } = await listAnalyticsEvents(
          { from, to, eventName: step },
          { limit: 2000, offset: 0, ascending: true }
        );
        const durations = rows
          .map((r) => r.duration_ms)
          .filter((d): d is number => typeof d === "number" && d >= 0)
          .sort((a, b) => a - b);
        const avgDurationMs =
          durations.length > 0
            ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
            : null;
        const medianDurationMs =
          durations.length > 0 ? durations[Math.floor(durations.length / 2)] ?? null : null;

        return {
          step,
          count,
          avgDurationMs,
          medianDurationMs,
        };
      })
    );

    const withRates = steps.map((row, index) => {
      const prev = index === 0 ? row.count : steps[index - 1].count;
      const conversionFromPrev =
        prev > 0 ? Math.round((row.count / prev) * 1000) / 10 : row.count > 0 ? 100 : 0;
      const dropOffFromPrev =
        prev > 0 ? Math.round(((prev - row.count) / prev) * 1000) / 10 : 0;
      return { ...row, conversionFromPrev, dropOffFromPrev };
    });

    res.json({
      from,
      to,
      filters: {
        country: req.query.country || null,
        device: req.query.device || null,
        browser: req.query.browser || null,
        utmSource: req.query.utmSource || null,
        utmMedium: req.query.utmMedium || null,
        utmCampaign: req.query.utmCampaign || null,
        referrer: req.query.referrer || null,
      },
      steps: withRates,
    });
  } catch (err) {
    logger.error("[observability] funnels failed", {
      error: err instanceof Error ? err.message : "unknown",
    });
    res.status(500).json({ steps: [], error: "Failed to load funnel" });
  }
});

router.get("/searches", requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const { from, to } = parseRange(req);
    const { limit, offset } = parsePaging(req);

    const { rows, total } = await listAnalyticsEvents(
      { from, to, category: "search" },
      { limit, offset, ascending: false }
    );

    const [started, completed, failed] = await Promise.all([
      countAnalyticsEvents({ from, to, eventName: EVENT_NAMES.SEARCH_STARTED }),
      countAnalyticsEvents({ from, to, eventName: EVENT_NAMES.SEARCH_COMPLETED }),
      countAnalyticsEvents({ from, to, eventName: EVENT_NAMES.SEARCH_FAILED }),
    ]);

    res.json({
      from,
      to,
      summary: {
        started,
        completed,
        failed,
      },
      events: rows,
      total,
      limit,
      offset,
    });
  } catch (err) {
    logger.error("[observability] searches failed", {
      error: err instanceof Error ? err.message : "unknown",
    });
    res.status(500).json({ events: [], summary: { started: 0, completed: 0, failed: 0 } });
  }
});

router.get("/errors", requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const { from, to } = parseRange(req);
    const { limit, offset } = parsePaging(req);

    const errorNames = [
      EVENT_NAMES.EXCEPTION,
      EVENT_NAMES.API_ERROR,
      EVENT_NAMES.SEARCH_FAILED,
      EVENT_NAMES.EMAIL_FAILED,
      EVENT_NAMES.SMTP_FAILURE,
      EVENT_NAMES.WEBHOOK_FAILURE,
      EVENT_NAMES.BROWSER_CRASH,
    ];
    const { rows, total } = await listAnalyticsEvents(
      { from, to },
      { limit: 5000, offset: 0, ascending: false }
    );
    const events = rows
      .filter((r) => errorNames.includes(r.event_name as (typeof errorNames)[number]))
      .slice(offset, offset + limit);

    res.json({ events, total, limit, offset, from, to });
  } catch (err) {
    logger.error("[observability] errors failed", {
      error: err instanceof Error ? err.message : "unknown",
    });
    res.status(500).json({ events: [], total: 0 });
  }
});

router.get("/infrastructure", requireAdminAuth, async (_req: Request, res: Response) => {
  try {
    const mem = process.memoryUsage();
    let queue: { active: number; waiting: number; failedLast24h: number; mode: "bullmq" | "inline" } = {
      active: 0,
      waiting: 0,
      failedLast24h: 0,
      mode: "inline",
    };
    try {
      queue = await getAdminQueueMetrics();
    } catch {
      /* ignore */
    }

    const redisConnected = Boolean(getRedisUrl());
    const since1h = new Date(Date.now() - 60 * 60 * 1000).toISOString();

    const countNamed = async (name: string) =>
      countAnalyticsEvents({ from: since1h, to: new Date().toISOString(), eventName: name });

    const [searchFailures1h, smtpFailures1h, browserCrashes1h, webhookFailures1h, apiErrors1h, activationFailures1h] =
      await Promise.all([
        countNamed(EVENT_NAMES.SEARCH_FAILED),
        countNamed(EVENT_NAMES.SMTP_FAILURE),
        countNamed(EVENT_NAMES.BROWSER_CRASH),
        countNamed(EVENT_NAMES.WEBHOOK_FAILURE),
        countNamed(EVENT_NAMES.API_ERROR).then(async (n) => n + (await countNamed(EVENT_NAMES.EXCEPTION))),
        countNamed(EVENT_NAMES.LICENSE_ACTIVATION_FAILED),
      ]);

    const { rows: completedDurations } = await listAnalyticsEvents(
      { from: since1h, to: new Date().toISOString(), eventName: EVENT_NAMES.SEARCH_COMPLETED },
      { limit: 500, offset: 0, ascending: false }
    );
    const durationVals = completedDurations
      .map((r) => r.duration_ms)
      .filter((d): d is number => typeof d === "number");
    const avgSearchDurationMs1h =
      durationVals.length > 0
        ? Math.round(durationVals.reduce((a, b) => a + b, 0) / durationVals.length)
        : null;

    const workerHealthy = queue.mode === "bullmq" ? redisConnected : true;

    const snapshot = {
      captured_at: new Date().toISOString(),
      queue_active: queue.active,
      queue_waiting: queue.waiting,
      queue_failed_24h: queue.failedLast24h,
      queue_mode: queue.mode,
      memory_rss_mb: Math.round((mem.rss / 1024 / 1024) * 10) / 10,
      memory_heap_mb: Math.round((mem.heapUsed / 1024 / 1024) * 10) / 10,
      redis_connected: redisConnected,
      search_failures_1h: searchFailures1h,
      smtp_failures_1h: smtpFailures1h,
      browser_crashes_1h: browserCrashes1h,
      webhook_failures_1h: webhookFailures1h,
      api_errors_1h: apiErrors1h,
      activation_failures_1h: activationFailures1h,
      avg_search_duration_ms_1h: avgSearchDurationMs1h,
      worker_healthy: workerHealthy,
      api_latency: getApiLatencySnapshot(),
    };

    // Snapshots live in memory/latency ring buffer — skip Supabase writes on free tier.

    const checkoutStarted1h = await countNamed(EVENT_NAMES.CHECKOUT_STARTED);
    const checkoutAbandoned1h = await countNamed(EVENT_NAMES.CHECKOUT_ABANDONED);

    void evaluateAlertsFromCounts({
      searchFailures1h,
      smtpFailures1h,
      queueWaiting: queue.waiting,
      browserCrashes1h,
      webhookFailures1h,
      apiErrors1h,
      checkoutStarted1h,
      checkoutAbandoned1h,
      redisConnected,
      activationFailures1h,
      avgSearchDurationMs1h,
      workerHealthy,
    });

    res.json({ snapshot, catalogue: ALERT_CATALOGUE });
  } catch (err) {
    logger.error("[observability] infrastructure failed", {
      error: err instanceof Error ? err.message : "unknown",
    });
    res.status(500).json({ error: "Failed to load infrastructure metrics" });
  }
});

router.get("/alerts", requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const status = typeof req.query.status === "string" ? req.query.status : "open";
    const { limit, offset } = parsePaging(req);

    let query = supabase
      .from("analytics_alerts")
      .select("*", { count: "exact" })
      .order("last_seen_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (status !== "all") query = query.eq("status", status);

    const { data, error, count } = await query;
    if (error) throw error;

    res.json({
      alerts: data || [],
      total: count ?? 0,
      catalogue: ALERT_CATALOGUE,
      limit,
      offset,
    });
  } catch (err) {
    logger.error("[observability] alerts failed", {
      error: err instanceof Error ? err.message : "unknown",
    });
    res.status(500).json({ alerts: [], catalogue: ALERT_CATALOGUE, total: 0 });
  }
});

router.get("/kpis", requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const { from, to } = parseRange(req);
    const cacheKey = `obs:kpis:${from}:${to}`;
    const payload = await cached(cacheKey, 120_000, async () => {
      const count = async (name: string) =>
        countAnalyticsEvents({ from, to, eventName: name });

      const [
        trialStarted,
        paid,
        activated,
        firstSearch,
        secondSearch,
        outreach,
        checkoutStarted,
        checkoutAbandoned,
        paymentSuccess,
        paymentFailed,
        csvExport,
        mailboxConnected,
        emailSent,
      ] = await Promise.all([
        count(EVENT_NAMES.TRIAL_STARTED),
        count(EVENT_NAMES.PAYMENT_COMPLETED),
        count(EVENT_NAMES.LICENSE_ACTIVATED),
        count(EVENT_NAMES.FIRST_SEARCH),
        count(EVENT_NAMES.SECOND_SEARCH),
        count(EVENT_NAMES.FIRST_OUTREACH),
        count(EVENT_NAMES.CHECKOUT_STARTED),
        count(EVENT_NAMES.CHECKOUT_ABANDONED),
        count(EVENT_NAMES.PAYMENT_COMPLETED),
        count(EVENT_NAMES.PAYMENT_FAILED),
        count(EVENT_NAMES.CSV_EXPORT),
        count(EVENT_NAMES.MAILBOX_CONNECTED),
        count(EVENT_NAMES.EMAIL_SENT),
      ]);

      const rate = (num: number, den: number) =>
        den > 0 ? Math.round((num / den) * 1000) / 10 : null;

      return {
        from,
        to,
        kpis: {
          trialToPaidRate: rate(paid, trialStarted),
          paidToActivationRate: rate(activated, paid),
          activationToFirstSearchRate: rate(firstSearch, activated),
          firstToSecondSearchRate: rate(secondSearch, firstSearch),
          secondSearchToOutreachRate: rate(outreach, secondSearch),
          checkoutAbandonRate: rate(checkoutAbandoned, checkoutStarted),
          paymentSuccessRate: rate(paymentSuccess, paymentSuccess + paymentFailed),
          mailboxAdoptionRate: rate(mailboxConnected, activated),
          counts: {
            trialStarted,
            paid,
            activated,
            firstSearch,
            secondSearch,
            outreach,
            checkoutStarted,
            checkoutAbandoned,
            paymentSuccess,
            paymentFailed,
            csvExport,
            mailboxConnected,
            emailSent,
          },
        },
      };
    });
    res.json(payload);
  } catch (err) {
    logger.error("[observability] kpis failed", {
      error: err instanceof Error ? err.message : "unknown",
    });
    res.status(500).json({ error: "Failed to load KPIs" });
  }
});

router.get("/events.csv", requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const { from, to } = parseRange(req);
    const { rows } = await listAnalyticsEvents({ from, to }, { limit: 2000, offset: 0, ascending: false });
    const data = rows;

    const headers = [
      "occurred_at",
      "event_name",
      "event_category",
      "source",
      "page_path",
      "utm_source",
      "utm_medium",
      "utm_campaign",
      "device",
      "browser",
      "country",
      "search_id",
      "correlation_id",
      "duration_ms",
    ];

    const escape = (v: unknown) => {
      const s = v == null ? "" : String(v);
      if (s.includes(",") || s.includes('"') || s.includes("\n")) {
        return `"${s.replace(/"/g, '""')}"`;
      }
      return s;
    };

    const lines = [headers.join(",")];
    for (const row of data || []) {
      lines.push(headers.map((h) => escape((row as Record<string, unknown>)[h])).join(","));
    }

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", "attachment; filename=analytics-events.csv");
    res.send(lines.join("\n"));
  } catch (err) {
    logger.error("[observability] csv export failed", {
      error: err instanceof Error ? err.message : "unknown",
    });
    res.status(500).json({ error: "Failed to export CSV" });
  }
});

registerObservabilityPolishRoutes(router);

export default router;
