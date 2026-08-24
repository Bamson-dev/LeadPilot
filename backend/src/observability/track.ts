import { logger } from "../utils/logger";
import { categoryForEvent, type EventCategory } from "./event-taxonomy";
import {
  getEnvironment,
  hashEmail,
  sanitizeProperties,
} from "./privacy";
import { persistAnalyticsBatch, type AnalyticsEventRow } from "./analytics-data-source";

export interface AnalyticsEventInput {
  eventName: string;
  eventCategory?: EventCategory;
  occurredAt?: string | Date;
  sessionId?: string | null;
  anonymousId?: string | null;
  userEmail?: string | null;
  userEmailHash?: string | null;
  licenseId?: string | null;
  correlationId?: string | null;
  searchId?: string | null;
  jobId?: string | null;
  source?: "client" | "server" | "worker" | "webhook";
  pagePath?: string | null;
  referrer?: string | null;
  utmSource?: string | null;
  utmMedium?: string | null;
  utmCampaign?: string | null;
  utmContent?: string | null;
  utmTerm?: string | null;
  fbclid?: string | null;
  gclid?: string | null;
  landingPage?: string | null;
  country?: string | null;
  device?: string | null;
  browser?: string | null;
  os?: string | null;
  properties?: Record<string, unknown>;
  durationMs?: number | null;
  idempotencyKey?: string | null;
}

const MAX_BATCH = 50;
let queue: AnalyticsEventRow[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let flushing = false;

function toRow(input: AnalyticsEventInput): AnalyticsEventRow {
  const occurred =
    input.occurredAt instanceof Date
      ? input.occurredAt.toISOString()
      : input.occurredAt || new Date().toISOString();

  return {
    event_name: input.eventName,
    event_category: input.eventCategory || categoryForEvent(input.eventName),
    occurred_at: occurred,
    session_id: input.sessionId || null,
    anonymous_id: input.anonymousId || null,
    user_email_hash: input.userEmailHash || hashEmail(input.userEmail) || null,
    license_id: input.licenseId || null,
    correlation_id: input.correlationId || null,
    search_id: input.searchId || null,
    job_id: input.jobId || null,
    source: input.source || "server",
    environment: getEnvironment(),
    page_path: input.pagePath || null,
    referrer: input.referrer || null,
    utm_source: input.utmSource || null,
    utm_medium: input.utmMedium || null,
    utm_campaign: input.utmCampaign || null,
    utm_content: input.utmContent || null,
    utm_term: input.utmTerm || null,
    fbclid: input.fbclid || null,
    gclid: input.gclid || null,
    landing_page: input.landingPage || null,
    country: input.country || null,
    device: input.device || null,
    browser: input.browser || null,
    os: input.os || null,
    properties: sanitizeProperties(input.properties),
    duration_ms: input.durationMs ?? null,
    idempotency_key: input.idempotencyKey || null,
  };
}

async function flushQueue(): Promise<void> {
  if (flushing || queue.length === 0) return;
  flushing = true;
  const batch = queue.splice(0, MAX_BATCH);
  try {
    await persistAnalyticsBatch(batch);
  } catch (err) {
    logger.warn("[observability] event flush failed", {
      error: err instanceof Error ? err.message : "unknown",
      count: batch.length,
    });
    for (const row of batch) {
      logger.info("[analytics-event]", {
        event: row.event_name,
        category: row.event_category,
        correlationId: row.correlation_id,
        searchId: row.search_id,
      });
    }
  } finally {
    flushing = false;
    if (queue.length > 0) scheduleFlush(50);
  }
}

function scheduleFlush(delayMs = 250): void {
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    void flushQueue();
  }, delayMs);
}

/** Fire-and-forget. Never throws to callers. */
export function trackEvent(input: AnalyticsEventInput): void {
  try {
    if (!input.eventName || typeof input.eventName !== "string") return;
    queue.push(toRow(input));
    if (queue.length >= MAX_BATCH) {
      void flushQueue();
    } else {
      scheduleFlush();
    }
  } catch (err) {
    logger.debug("[observability] trackEvent swallowed", {
      error: err instanceof Error ? err.message : "unknown",
    });
  }
}

export function trackEvents(inputs: AnalyticsEventInput[]): void {
  for (const input of inputs) trackEvent(input);
}

export async function flushAnalyticsEvents(): Promise<void> {
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
  while (queue.length > 0) {
    await flushQueue();
  }
}
