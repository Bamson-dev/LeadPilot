import { supabase } from "../database/client";
import { logger } from "../utils/logger";
import { getEnvironment } from "./privacy";

export type AlertSeverity = "info" | "warning" | "critical";

export interface AlertDefinition {
  key: string;
  title: string;
  severity: AlertSeverity;
  description: string;
}

/** Alert catalogue — evaluated from real metrics only */
export const ALERT_CATALOGUE: AlertDefinition[] = [
  {
    key: "search_failure_spike",
    title: "Search failure spike",
    severity: "critical",
    description: "Elevated search_failed events in the last hour",
  },
  {
    key: "smtp_failure_spike",
    title: "SMTP failure spike",
    severity: "critical",
    description: "Elevated smtp_failure / email_failed events in the last hour",
  },
  {
    key: "redis_disconnected",
    title: "Redis disconnected",
    severity: "critical",
    description: "Queue mode fell back to inline or Redis probe failed",
  },
  {
    key: "queue_backlog",
    title: "Queue backlog",
    severity: "warning",
    description: "Search queue waiting jobs exceeded threshold",
  },
  {
    key: "browser_crash_loop",
    title: "Browser crash loop",
    severity: "critical",
    description: "Repeated browser_crash events",
  },
  {
    key: "webhook_failure",
    title: "Payment webhook failures",
    severity: "critical",
    description: "webhook_failure events detected",
  },
  {
    key: "activation_failure",
    title: "Activation failures",
    severity: "warning",
    description: "License activation error rate elevated",
  },
  {
    key: "search_duration_spike",
    title: "Search duration spike",
    severity: "warning",
    description: "Average search duration exceeded threshold",
  },
  {
    key: "worker_offline",
    title: "Worker offline",
    severity: "critical",
    description: "Search worker health check failed",
  },
  {
    key: "checkout_abandonment_high",
    title: "High checkout abandonment",
    severity: "warning",
    description: "checkout_abandoned vs checkout_started ratio elevated",
  },
  {
    key: "api_error_spike",
    title: "API error spike",
    severity: "critical",
    description: "Elevated api_error / exception events",
  },
];

export async function openOrRefreshAlert(input: {
  alertKey: string;
  severity: AlertSeverity;
  title: string;
  message: string;
  metricName?: string;
  metricValue?: number;
  thresholdValue?: number;
  context?: Record<string, unknown>;
}): Promise<void> {
  try {
    const now = new Date().toISOString();
    const { data: existing } = await supabase
      .from("analytics_alerts")
      .select("id")
      .eq("alert_key", input.alertKey)
      .eq("status", "open")
      .maybeSingle();

    if (existing?.id) {
      await supabase
        .from("analytics_alerts")
        .update({
          last_seen_at: now,
          message: input.message,
          metric_value: input.metricValue ?? null,
          context: input.context ?? {},
        })
        .eq("id", existing.id);
    } else {
      await supabase.from("analytics_alerts").insert({
        alert_key: input.alertKey,
        severity: input.severity,
        title: input.title,
        message: input.message,
        status: "open",
        metric_name: input.metricName ?? null,
        metric_value: input.metricValue ?? null,
        threshold_value: input.thresholdValue ?? null,
        environment: getEnvironment(),
        context: input.context ?? {},
        first_seen_at: now,
        last_seen_at: now,
      });
    }

    // Do not emit api_error here — that inflated api_error_spike and caused alert spam.
  } catch (err) {
    logger.warn("[observability] alert write failed", {
      error: err instanceof Error ? err.message : "unknown",
      alertKey: input.alertKey,
    });
  }
}

export async function updateAlertStatus(input: {
  alertId: string;
  status: "acknowledged" | "resolved" | "open";
}): Promise<boolean> {
  try {
    const now = new Date().toISOString();
    const patch: Record<string, unknown> = {
      status: input.status,
      last_seen_at: now,
    };
    if (input.status === "resolved") patch.resolved_at = now;
    if (input.status === "open") patch.resolved_at = null;

    const { error } = await supabase
      .from("analytics_alerts")
      .update(patch)
      .eq("id", input.alertId);

    return !error;
  } catch {
    return false;
  }
}

export async function evaluateAlertsFromCounts(input: {
  searchFailures1h: number;
  smtpFailures1h: number;
  queueWaiting: number;
  browserCrashes1h: number;
  webhookFailures1h: number;
  apiErrors1h: number;
  checkoutStarted1h: number;
  checkoutAbandoned1h: number;
  redisConnected: boolean;
  activationFailures1h?: number;
  avgSearchDurationMs1h?: number | null;
  workerHealthy?: boolean;
}): Promise<void> {
  if (input.searchFailures1h >= 10) {
    await openOrRefreshAlert({
      alertKey: "search_failure_spike",
      severity: "critical",
      title: "Search failure spike",
      message: `${input.searchFailures1h} search failures in the last hour`,
      metricName: "search_failures_1h",
      metricValue: input.searchFailures1h,
      thresholdValue: 10,
      context: { service: "search" },
    });
  }

  if (input.smtpFailures1h >= 5) {
    await openOrRefreshAlert({
      alertKey: "smtp_failure_spike",
      severity: "critical",
      title: "SMTP failure spike",
      message: `${input.smtpFailures1h} SMTP/email failures in the last hour`,
      metricName: "smtp_failures_1h",
      metricValue: input.smtpFailures1h,
      thresholdValue: 5,
      context: { service: "smtp" },
    });
  }

  if (!input.redisConnected) {
    await openOrRefreshAlert({
      alertKey: "redis_disconnected",
      severity: "critical",
      title: "Redis disconnected",
      message: "Redis is not connected; queue may be inline fallback",
      metricName: "redis_connected",
      metricValue: 0,
      thresholdValue: 1,
      context: { service: "redis" },
    });
  }

  if (input.queueWaiting >= 25) {
    await openOrRefreshAlert({
      alertKey: "queue_backlog",
      severity: "warning",
      title: "Queue backlog",
      message: `${input.queueWaiting} jobs waiting in search queue`,
      metricName: "queue_waiting",
      metricValue: input.queueWaiting,
      thresholdValue: 25,
      context: { service: "queue" },
    });
  }

  if (input.browserCrashes1h >= 3) {
    await openOrRefreshAlert({
      alertKey: "browser_crash_loop",
      severity: "critical",
      title: "Browser crash loop",
      message: `${input.browserCrashes1h} browser crashes in the last hour`,
      metricName: "browser_crashes_1h",
      metricValue: input.browserCrashes1h,
      thresholdValue: 3,
      context: { service: "browser" },
    });
  }

  if (input.webhookFailures1h >= 1) {
    await openOrRefreshAlert({
      alertKey: "webhook_failure",
      severity: "critical",
      title: "Payment webhook failures",
      message: `${input.webhookFailures1h} webhook failures in the last hour`,
      metricName: "webhook_failures_1h",
      metricValue: input.webhookFailures1h,
      thresholdValue: 1,
      context: { service: "webhooks" },
    });
  }

  if (input.apiErrors1h >= 20) {
    await openOrRefreshAlert({
      alertKey: "api_error_spike",
      severity: "critical",
      title: "API error spike",
      message: `${input.apiErrors1h} API errors/exceptions in the last hour`,
      metricName: "api_errors_1h",
      metricValue: input.apiErrors1h,
      thresholdValue: 20,
      context: { service: "api" },
    });
  }

  if (
    input.checkoutStarted1h >= 5 &&
    input.checkoutAbandoned1h / Math.max(input.checkoutStarted1h, 1) >= 0.7
  ) {
    await openOrRefreshAlert({
      alertKey: "checkout_abandonment_high",
      severity: "warning",
      title: "High checkout abandonment",
      message: `${input.checkoutAbandoned1h}/${input.checkoutStarted1h} checkouts abandoned in the last hour`,
      metricName: "checkout_abandon_rate_1h",
      metricValue: input.checkoutAbandoned1h / input.checkoutStarted1h,
      thresholdValue: 0.7,
      context: { service: "checkout" },
    });
  }

  if ((input.activationFailures1h ?? 0) >= 5) {
    await openOrRefreshAlert({
      alertKey: "activation_failure",
      severity: "warning",
      title: "Activation failures",
      message: `${input.activationFailures1h} activation failures in the last hour`,
      metricName: "activation_failures_1h",
      metricValue: input.activationFailures1h,
      thresholdValue: 5,
      context: { service: "licensing" },
    });
  }

  if (
    typeof input.avgSearchDurationMs1h === "number" &&
    input.avgSearchDurationMs1h >= 180_000
  ) {
    await openOrRefreshAlert({
      alertKey: "search_duration_spike",
      severity: "warning",
      title: "Search duration spike",
      message: `Average search duration ${Math.round(input.avgSearchDurationMs1h / 1000)}s in the last hour`,
      metricName: "avg_search_duration_ms_1h",
      metricValue: input.avgSearchDurationMs1h,
      thresholdValue: 180_000,
      context: { service: "search" },
    });
  }

  if (input.workerHealthy === false) {
    await openOrRefreshAlert({
      alertKey: "worker_offline",
      severity: "critical",
      title: "Worker offline",
      message: "Search worker appears offline or queue mode degraded without active workers",
      metricName: "worker_healthy",
      metricValue: 0,
      thresholdValue: 1,
      context: { service: "worker" },
    });
  }
}
