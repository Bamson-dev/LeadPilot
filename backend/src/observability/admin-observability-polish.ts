import { Router, type Request, type Response } from "express";
import { requireAdminAuth } from "../middleware/admin-auth";
import { supabase } from "../database/client";
import { logger } from "../utils/logger";
import { NURTURE_EMAIL_CHANNEL } from "../services/email-nurture-attribution";
import { FUNNEL_STEPS, EVENT_NAMES } from "./event-taxonomy";
import { hashEmail } from "./privacy";
import { updateAlertStatus } from "./alerts";
import { buildEmailRevenueReport } from "./email-revenue-report";

/**
 * Phase 2.1 admin query extensions — timeline, cohorts, attribution, search quality.
 * Mounted under /admin/observability (same auth).
 */
export function registerObservabilityPolishRoutes(router: Router): void {
  router.patch("/alerts/:id", requireAdminAuth, async (req: Request, res: Response) => {
    try {
      const id = String(req.params.id || "");
      const status = String((req.body as { status?: string })?.status || "");
      if (!id || !["acknowledged", "resolved", "open"].includes(status)) {
        res.status(400).json({ error: "status must be acknowledged, resolved, or open" });
        return;
      }
      const ok = await updateAlertStatus({
        alertId: id,
        status: status as "acknowledged" | "resolved" | "open",
      });
      if (!ok) {
        res.status(500).json({ error: "Failed to update alert" });
        return;
      }
      res.json({ success: true, id, status });
    } catch (err) {
      logger.error("[observability] alert patch failed", {
        error: err instanceof Error ? err.message : "unknown",
      });
      res.status(500).json({ error: "Failed to update alert" });
    }
  });

  router.get("/timeline", requireAdminAuth, async (req: Request, res: Response) => {
    try {
      const email = typeof req.query.email === "string" ? req.query.email.trim() : "";
      const emailHash =
        typeof req.query.emailHash === "string"
          ? req.query.emailHash.trim()
          : hashEmail(email) || "";
      const licenseId = typeof req.query.licenseId === "string" ? req.query.licenseId.trim() : "";
      const sessionId = typeof req.query.sessionId === "string" ? req.query.sessionId.trim() : "";
      const limit = Math.min(Math.max(Number(req.query.limit) || 100, 1), 300);

      if (!emailHash && !licenseId && !sessionId) {
        res.status(400).json({ error: "Provide email, emailHash, licenseId, or sessionId" });
        return;
      }

      let query = supabase
        .from("analytics_events")
        .select(
          "id,event_name,event_category,occurred_at,source,page_path,utm_source,utm_medium,utm_campaign,utm_content,utm_term,fbclid,gclid,landing_page,referrer,device,browser,country,search_id,license_id,session_id,duration_ms,properties"
        )
        .order("occurred_at", { ascending: true })
        .limit(limit);

      if (emailHash) query = query.eq("user_email_hash", emailHash);
      else if (licenseId) query = query.eq("license_id", licenseId);
      else if (sessionId) query = query.eq("session_id", sessionId);

      const { data, error } = await query;
      if (error) throw error;

      res.json({
        emailHash: emailHash || null,
        licenseId: licenseId || null,
        sessionId: sessionId || null,
        events: data || [],
        total: data?.length ?? 0,
      });
    } catch (err) {
      logger.error("[observability] timeline failed", {
        error: err instanceof Error ? err.message : "unknown",
      });
      res.status(500).json({ events: [], error: "Failed to load timeline" });
    }
  });

  router.get("/cohorts", requireAdminAuth, async (req: Request, res: Response) => {
    try {
      const now = Date.now();
      const windows = {
        today: new Date(now - 24 * 60 * 60 * 1000).toISOString(),
        yesterday: new Date(now - 48 * 60 * 60 * 1000).toISOString(),
        d7: new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString(),
        d30: new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString(),
      };

      const distinctHashCount = async (eventName: string, from: string) => {
        const { data, error } = await supabase
          .from("analytics_events")
          .select("user_email_hash")
          .eq("event_name", eventName)
          .gte("occurred_at", from)
          .not("user_email_hash", "is", null)
          .limit(5000);
        if (error) throw error;
        return new Set((data || []).map((r) => r.user_email_hash).filter(Boolean)).size;
      };

      const eventCount = async (eventName: string, from: string) => {
        const { count } = await supabase
          .from("analytics_events")
          .select("id", { count: "exact", head: true })
          .eq("event_name", eventName)
          .gte("occurred_at", from);
        return count ?? 0;
      };

      const [
        trialToday,
        trial7,
        trial30,
        paidToday,
        paid7,
        paid30,
        activated7,
        activated30,
        search7,
        search30,
        returning7,
        outreach7,
      ] = await Promise.all([
        distinctHashCount(EVENT_NAMES.TRIAL_STARTED, windows.today),
        distinctHashCount(EVENT_NAMES.TRIAL_STARTED, windows.d7),
        distinctHashCount(EVENT_NAMES.TRIAL_STARTED, windows.d30),
        distinctHashCount(EVENT_NAMES.PAYMENT_COMPLETED, windows.today),
        distinctHashCount(EVENT_NAMES.PAYMENT_COMPLETED, windows.d7),
        distinctHashCount(EVENT_NAMES.PAYMENT_COMPLETED, windows.d30),
        distinctHashCount(EVENT_NAMES.LICENSE_ACTIVATED, windows.d7),
        distinctHashCount(EVENT_NAMES.LICENSE_ACTIVATED, windows.d30),
        eventCount(EVENT_NAMES.SEARCH_STARTED, windows.d7),
        eventCount(EVENT_NAMES.SEARCH_STARTED, windows.d30),
        distinctHashCount(EVENT_NAMES.RETURNING_CUSTOMER, windows.d7),
        distinctHashCount(EVENT_NAMES.FIRST_OUTREACH, windows.d7),
      ]);

      const powerUsers7 = Math.min(outreach7, activated7);

      res.json({
        note: "Cohorts derived from distinct email hashes in analytics_events (hashed only).",
        cohorts: {
          trialUsers: { today: trialToday, d7: trial7, d30: trial30 },
          payingUsers: { today: paidToday, d7: paid7, d30: paid30 },
          activatedUsers: { d7: activated7, d30: activated30 },
          returningUsers: { d7: returning7 },
          powerUsers: { d7: powerUsers7 },
          searchActivity: { d7: search7, d30: search30 },
        },
        retentionProxy: {
          trialToPaid7d:
            trial7 > 0 ? Math.round((paid7 / trial7) * 1000) / 10 : null,
          activatedToReturning7d:
            activated7 > 0 ? Math.round((returning7 / activated7) * 1000) / 10 : null,
          churnRiskProxy:
            activated7 > 0
              ? Math.round(((activated7 - returning7) / activated7) * 1000) / 10
              : null,
        },
      });
    } catch (err) {
      logger.error("[observability] cohorts failed", {
        error: err instanceof Error ? err.message : "unknown",
      });
      res.status(500).json({ error: "Failed to load cohorts" });
    }
  });

  router.get("/attribution", requireAdminAuth, async (req: Request, res: Response) => {
    try {
      const from =
        typeof req.query.from === "string"
          ? req.query.from
          : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const to = typeof req.query.to === "string" ? req.query.to : new Date().toISOString();

      const { data, error } = await supabase
        .from("analytics_events")
        .select(
          "event_name,utm_source,utm_medium,utm_campaign,utm_content,utm_term,fbclid,gclid,referrer,landing_page"
        )
        .eq("event_name", EVENT_NAMES.PAYMENT_COMPLETED)
        .gte("occurred_at", from)
        .lte("occurred_at", to)
        .limit(2000);

      if (error) throw error;

      const buckets = new Map<
        string,
        { source: string; medium: string; campaign: string; purchases: number }
      >();

      for (const row of data || []) {
        const source = row.utm_source || (row.fbclid ? "facebook" : row.gclid ? "google" : "direct");
        const medium = row.utm_medium || (row.fbclid || row.gclid ? "paid" : "none");
        const campaign = row.utm_campaign || "none";
        const key = `${source}|${medium}|${campaign}`;
        const existing = buckets.get(key) || { source, medium, campaign, purchases: 0 };
        existing.purchases += 1;
        buckets.set(key, existing);
      }

      res.json({
        from,
        to,
        purchases: data?.length ?? 0,
        attributed: Array.from(buckets.values()).sort((a, b) => b.purchases - a.purchases),
        note: "Attribution from payment_completed rows. Server webhooks may lack UTM unless client attribution was persisted earlier on the session.",
      });
    } catch (err) {
      logger.error("[observability] attribution failed", {
        error: err instanceof Error ? err.message : "unknown",
      });
      res.status(500).json({ attributed: [], error: "Failed to load attribution" });
    }
  });

  router.get("/search-quality", requireAdminAuth, async (req: Request, res: Response) => {
    try {
      const from =
        typeof req.query.from === "string"
          ? req.query.from
          : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const to = typeof req.query.to === "string" ? req.query.to : new Date().toISOString();

      const { data: completed, error } = await supabase
        .from("analytics_events")
        .select("id,search_id,duration_ms,properties,occurred_at,browser,country")
        .eq("event_name", EVENT_NAMES.SEARCH_COMPLETED)
        .gte("occurred_at", from)
        .lte("occurred_at", to)
        .limit(2000);
      if (error) throw error;

      const { count: failed } = await supabase
        .from("analytics_events")
        .select("id", { count: "exact", head: true })
        .eq("event_name", EVENT_NAMES.SEARCH_FAILED)
        .gte("occurred_at", from)
        .lte("occurred_at", to);

      const { count: started } = await supabase
        .from("analytics_events")
        .select("id", { count: "exact", head: true })
        .eq("event_name", EVENT_NAMES.SEARCH_STARTED)
        .gte("occurred_at", from)
        .lte("occurred_at", to);

      let zero = 0;
      let low = 0;
      let large = 0;
      let slow = 0;
      let durationSum = 0;
      let durationN = 0;
      let resultSum = 0;
      let resultN = 0;
      const failedReplay: Array<Record<string, unknown>> = [];

      for (const row of completed || []) {
        const props = (row.properties || {}) as Record<string, unknown>;
        const leadCount = Number(props.leadCount ?? props.leadsCollected ?? props.totalFound ?? NaN);
        const duration = typeof row.duration_ms === "number" ? row.duration_ms : null;
        if (Number.isFinite(leadCount)) {
          resultSum += leadCount;
          resultN += 1;
          if (leadCount === 0) zero += 1;
          else if (leadCount < 10) low += 1;
          else if (leadCount >= 200) large += 1;
        }
        if (duration != null) {
          durationSum += duration;
          durationN += 1;
          if (duration >= 120_000) slow += 1;
        }
      }

      const { data: failedRows } = await supabase
        .from("analytics_events")
        .select("search_id,occurred_at,properties,duration_ms,browser,country")
        .eq("event_name", EVENT_NAMES.SEARCH_FAILED)
        .gte("occurred_at", from)
        .lte("occurred_at", to)
        .order("occurred_at", { ascending: false })
        .limit(50);

      for (const row of failedRows || []) {
        failedReplay.push({
          searchId: row.search_id,
          occurredAt: row.occurred_at,
          durationMs: row.duration_ms,
          browser: row.browser,
          country: row.country,
          metadata: row.properties,
          replayNote: "Metadata only — do not auto-rerun.",
        });
      }

      res.json({
        from,
        to,
        summary: {
          started: started ?? 0,
          completed: completed?.length ?? 0,
          failed: failed ?? 0,
          zeroResult: zero,
          lowResult: low,
          largeResult: large,
          slowSearches: slow,
          avgResultCount: resultN ? Math.round((resultSum / resultN) * 10) / 10 : null,
          avgDurationMs: durationN ? Math.round(durationSum / durationN) : null,
        },
        failedReplayMetadata: failedReplay,
      });
    } catch (err) {
      logger.error("[observability] search-quality failed", {
        error: err instanceof Error ? err.message : "unknown",
      });
      res.status(500).json({ error: "Failed to load search quality" });
    }
  });

  router.get("/executive", requireAdminAuth, async (req: Request, res: Response) => {
    try {
      const todayFrom = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const to = new Date().toISOString();
      const count = async (name: string, from = todayFrom) => {
        const { count: c } = await supabase
          .from("analytics_events")
          .select("id", { count: "exact", head: true })
          .eq("event_name", name)
          .gte("occurred_at", from)
          .lte("occurred_at", to);
        return c ?? 0;
      };

      const [
        revenueEvents,
        searches,
        trialUsers,
        paying,
        activated,
        errors,
        emailSent,
        emailFailed,
        smtpFailed,
      ] = await Promise.all([
        count(EVENT_NAMES.PAYMENT_COMPLETED),
        count(EVENT_NAMES.SEARCH_STARTED),
        count(EVENT_NAMES.TRIAL_STARTED),
        count(EVENT_NAMES.PAYMENT_COMPLETED),
        count(EVENT_NAMES.LICENSE_ACTIVATED),
        count(EVENT_NAMES.EXCEPTION).then(async (n) => n + (await count(EVENT_NAMES.API_ERROR))),
        count(EVENT_NAMES.EMAIL_SENT),
        count(EVENT_NAMES.EMAIL_FAILED),
        count(EVENT_NAMES.SMTP_FAILURE),
      ]);

      const { count: openAlerts } = await supabase
        .from("analytics_alerts")
        .select("id", { count: "exact", head: true })
        .eq("status", "open");

      const conversion =
        trialUsers > 0 ? Math.round((paying / trialUsers) * 1000) / 10 : null;

      res.json({
        from: todayFrom,
        to,
        executive: {
          todaysRevenueEvents: revenueEvents,
          todaysSearches: searches,
          trialUsers,
          payingUsers: paying,
          activatedUsers: activated,
          conversionRate: conversion,
          openAlerts: openAlerts ?? 0,
          errors,
          smtpHealth: {
            sent: emailSent,
            failed: emailFailed + smtpFailed,
          },
        },
        funnelSteps: FUNNEL_STEPS,
      });
    } catch (err) {
      logger.error("[observability] executive failed", {
        error: err instanceof Error ? err.message : "unknown",
      });
      res.status(500).json({ error: "Failed to load executive overview" });
    }
  });

  router.get("/license-health", requireAdminAuth, async (req: Request, res: Response) => {
    try {
      const from =
        typeof req.query.from === "string"
          ? req.query.from
          : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const to = typeof req.query.to === "string" ? req.query.to : new Date().toISOString();
      const names = [
        EVENT_NAMES.LICENSE_ACTIVATED,
        EVENT_NAMES.LICENSE_ACTIVATION_FAILED,
        EVENT_NAMES.LICENSE_INVALID,
        EVENT_NAMES.LICENSE_DEVICE_DENIED,
        EVENT_NAMES.DUPLICATE_ACTIVATION,
        EVENT_NAMES.LICENSE_EXPIRED,
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
      res.json({ from, to, counts });
    } catch (err) {
      logger.error("[observability] license-health failed", {
        error: err instanceof Error ? err.message : "unknown",
      });
      res.status(500).json({ counts: {} });
    }
  });

  router.get("/outreach-health", requireAdminAuth, async (req: Request, res: Response) => {
    try {
      const from =
        typeof req.query.from === "string"
          ? req.query.from
          : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const to = typeof req.query.to === "string" ? req.query.to : new Date().toISOString();
      const names = [
        EVENT_NAMES.EMAIL_QUEUED,
        EVENT_NAMES.EMAIL_SENT,
        EVENT_NAMES.EMAIL_FAILED,
        EVENT_NAMES.EMAIL_OPENED,
        EVENT_NAMES.EMAIL_CLICKED,
        EVENT_NAMES.REPLY_RECEIVED,
        EVENT_NAMES.SMTP_FAILURE,
        EVENT_NAMES.MAILBOX_CONNECTED,
        EVENT_NAMES.FIRST_OUTREACH,
      ];
      const counts: Record<string, number> = {};
      await Promise.all(
        names.map(async (name) => {
          // Exclude Trial Nurture analytics from customer outreach health.
          let query = supabase
            .from("analytics_events")
            .select("id", { count: "exact", head: true })
            .eq("event_name", name)
            .gte("occurred_at", from)
            .lte("occurred_at", to);
          if (
            name === EVENT_NAMES.EMAIL_SENT ||
            name === EVENT_NAMES.EMAIL_OPENED ||
            name === EVENT_NAMES.EMAIL_CLICKED
          ) {
            query = query.or(
              `properties->>email_channel.is.null,properties->>email_channel.neq.${NURTURE_EMAIL_CHANNEL}`
            );
          }
          const { count } = await query;
          counts[name] = count ?? 0;
        })
      );
      const sent = counts[EVENT_NAMES.EMAIL_SENT] || 0;
      const failed = counts[EVENT_NAMES.EMAIL_FAILED] || 0;
      const opened = counts[EVENT_NAMES.EMAIL_OPENED] || 0;
      res.json({
        from,
        to,
        counts,
        rates: {
          failureRate: sent + failed > 0 ? Math.round((failed / (sent + failed)) * 1000) / 10 : null,
          openRate: sent > 0 ? Math.round((opened / sent) * 1000) / 10 : null,
        },
        note: "Nurture email_channel=trial_nurture excluded from outreach email_sent/open/click counts.",
      });
    } catch (err) {
      logger.error("[observability] outreach-health failed", {
        error: err instanceof Error ? err.message : "unknown",
      });
      res.status(500).json({ counts: {} });
    }
  });

  router.get("/email-revenue", requireAdminAuth, async (req: Request, res: Response) => {
    try {
      const from =
        typeof req.query.from === "string"
          ? req.query.from
          : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const to = typeof req.query.to === "string" ? req.query.to : new Date().toISOString();
      const sequenceVersion =
        typeof req.query.sequenceVersion === "string" && req.query.sequenceVersion
          ? Number(req.query.sequenceVersion)
          : undefined;
      const sequenceStep =
        typeof req.query.sequenceStep === "string" && req.query.sequenceStep
          ? Number(req.query.sequenceStep)
          : undefined;

      const report = await buildEmailRevenueReport({
        from,
        to,
        sequenceVersion: Number.isFinite(sequenceVersion) ? sequenceVersion : undefined,
        sequenceStep: Number.isFinite(sequenceStep) ? sequenceStep : undefined,
      });
      res.json(report);
    } catch (err) {
      logger.error("[observability] email-revenue failed", {
        error: err instanceof Error ? err.message : "unknown",
      });
      res.status(500).json({ rows: [], error: "Failed to load email revenue" });
    }
  });
}
