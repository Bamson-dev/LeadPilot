import { Router, type Request, type Response } from "express";
import { requireAdminAuth } from "../middleware/admin-auth";
import { supabase } from "../database/client";
import { logger } from "../utils/logger";
import { FUNNEL_STEPS, EVENT_NAMES } from "./event-taxonomy";
import { ALERT_CATALOGUE, evaluateAlertsFromCounts } from "./alerts";
import { getApiLatencySnapshot } from "./latency-metrics";
import { getAdminQueueMetrics } from "../queue/search-queue";
import { getRedisUrl } from "../queue/redis-connection";

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

router.get("/overview", requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const { from, to } = parseRange(req);
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
        const { count } = await supabase
          .from("analytics_events")
          .select("id", { count: "exact", head: true })
          .eq("event_name", name)
          .gte("occurred_at", from)
          .lte("occurred_at", to);
        counts[name] = count ?? 0;
      })
    );

    const { count: openAlerts } = await supabase
      .from("analytics_alerts")
      .select("id", { count: "exact", head: true })
      .eq("status", "open");

    res.json({
      from,
      to,
      counts,
      openAlerts: openAlerts ?? 0,
      note: "Counts are from analytics_events only. Zero means no events tracked yet in range.",
    });
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
    const sort = req.query.sort === "asc" ? true : false;

    let query = supabase
      .from("analytics_events")
      .select("*", { count: "exact" })
      .gte("occurred_at", from)
      .lte("occurred_at", to)
      .order("occurred_at", { ascending: sort })
      .range(offset, offset + limit - 1);

    if (eventName) query = query.eq("event_name", eventName);
    if (category) query = query.eq("event_category", category);
    if (search) {
      query = query.or(
        `event_name.ilike.%${search}%,page_path.ilike.%${search}%,correlation_id.ilike.%${search}%,search_id.ilike.%${search}%`
      );
    }

    const { data, error, count } = await query;
    if (error) throw error;

    res.json({
      events: data || [],
      total: count ?? 0,
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
        const { count } = await supabase
          .from("analytics_events")
          .select("id", { count: "exact", head: true })
          .eq("event_name", step)
          .gte("occurred_at", from)
          .lte("occurred_at", to);
        return { step, count: count ?? 0 };
      })
    );

    const withRates = steps.map((row, index) => {
      const prev = index === 0 ? row.count : steps[index - 1].count;
      const conversionFromPrev =
        prev > 0 ? Math.round((row.count / prev) * 1000) / 10 : row.count > 0 ? 100 : 0;
      return { ...row, conversionFromPrev };
    });

    res.json({ from, to, steps: withRates });
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

    const { data, error, count } = await supabase
      .from("analytics_events")
      .select("*", { count: "exact" })
      .eq("event_category", "search")
      .gte("occurred_at", from)
      .lte("occurred_at", to)
      .order("occurred_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;

    const { count: started } = await supabase
      .from("analytics_events")
      .select("id", { count: "exact", head: true })
      .eq("event_name", EVENT_NAMES.SEARCH_STARTED)
      .gte("occurred_at", from)
      .lte("occurred_at", to);

    const { count: completed } = await supabase
      .from("analytics_events")
      .select("id", { count: "exact", head: true })
      .eq("event_name", EVENT_NAMES.SEARCH_COMPLETED)
      .gte("occurred_at", from)
      .lte("occurred_at", to);

    const { count: failed } = await supabase
      .from("analytics_events")
      .select("id", { count: "exact", head: true })
      .eq("event_name", EVENT_NAMES.SEARCH_FAILED)
      .gte("occurred_at", from)
      .lte("occurred_at", to);

    res.json({
      from,
      to,
      summary: {
        started: started ?? 0,
        completed: completed ?? 0,
        failed: failed ?? 0,
      },
      events: data || [],
      total: count ?? 0,
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

    const { data, error, count } = await supabase
      .from("analytics_events")
      .select("*", { count: "exact" })
      .in("event_name", [
        EVENT_NAMES.EXCEPTION,
        EVENT_NAMES.API_ERROR,
        EVENT_NAMES.SEARCH_FAILED,
        EVENT_NAMES.EMAIL_FAILED,
        EVENT_NAMES.SMTP_FAILURE,
        EVENT_NAMES.WEBHOOK_FAILURE,
        EVENT_NAMES.BROWSER_CRASH,
      ])
      .gte("occurred_at", from)
      .lte("occurred_at", to)
      .order("occurred_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;
    res.json({ events: data || [], total: count ?? 0, limit, offset, from, to });
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

    const countNamed = async (name: string) => {
      const { count } = await supabase
        .from("analytics_events")
        .select("id", { count: "exact", head: true })
        .eq("event_name", name)
        .gte("occurred_at", since1h);
      return count ?? 0;
    };

    const [searchFailures1h, smtpFailures1h, browserCrashes1h, webhookFailures1h, apiErrors1h] =
      await Promise.all([
        countNamed(EVENT_NAMES.SEARCH_FAILED),
        countNamed(EVENT_NAMES.SMTP_FAILURE).then(async (n) => n + (await countNamed(EVENT_NAMES.EMAIL_FAILED))),
        countNamed(EVENT_NAMES.BROWSER_CRASH),
        countNamed(EVENT_NAMES.WEBHOOK_FAILURE),
        countNamed(EVENT_NAMES.API_ERROR).then(async (n) => n + (await countNamed(EVENT_NAMES.EXCEPTION))),
      ]);

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
      api_latency: getApiLatencySnapshot(),
    };

    void supabase.from("analytics_tech_snapshots").insert({
      captured_at: snapshot.captured_at,
      queue_active: snapshot.queue_active,
      queue_waiting: snapshot.queue_waiting,
      queue_failed_24h: snapshot.queue_failed_24h,
      queue_mode: snapshot.queue_mode,
      memory_rss_mb: snapshot.memory_rss_mb,
      memory_heap_mb: snapshot.memory_heap_mb,
      redis_connected: snapshot.redis_connected,
      search_failures_1h: snapshot.search_failures_1h,
      smtp_failures_1h: snapshot.smtp_failures_1h,
      api_latency_p50_ms: snapshot.api_latency.p50Ms,
      api_latency_p95_ms: snapshot.api_latency.p95Ms,
      properties: {
        browser_crashes_1h: browserCrashes1h,
        webhook_failures_1h: webhookFailures1h,
        api_errors_1h: apiErrors1h,
        api_latency_p99_ms: snapshot.api_latency.p99Ms,
        api_latency_samples: snapshot.api_latency.sampleCount,
      },
    });

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
    const count = async (name: string) => {
      const { count: c } = await supabase
        .from("analytics_events")
        .select("id", { count: "exact", head: true })
        .eq("event_name", name)
        .gte("occurred_at", from)
        .lte("occurred_at", to);
      return c ?? 0;
    };

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

    res.json({
      from,
      to,
      kpis: {
        trialToPaidRate: rate(paid, trialStarted),
        paidToActivationRate: rate(activated, paid),
        activationToFirstSearchRate: rate(firstSearch, activated),
        firstToSecondSearchRate: rate(secondSearch, firstSearch),
        secondSearchToOutreachRate: rate(outreach, secondSearch),
        checkoutAbandonRate: rate(checkoutAbandoned, checkoutStarted),
        paymentSuccessRate: rate(
          paymentSuccess,
          paymentSuccess + paymentFailed
        ),
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
    });
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
    const { data, error } = await supabase
      .from("analytics_events")
      .select(
        "occurred_at,event_name,event_category,source,page_path,utm_source,utm_medium,utm_campaign,device,browser,country,search_id,correlation_id,duration_ms"
      )
      .gte("occurred_at", from)
      .lte("occurred_at", to)
      .order("occurred_at", { ascending: false })
      .limit(2000);

    if (error) throw error;

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

export default router;
