/**
 * Passive client analytics tracker.
 * Fire-and-forget batched posts to POST /public/events.
 * Never throws. Never blocks UX.
 *
 * Attribution model (Phase 2.2):
 * - First-touch UTM/fbclid/gclid is stored once and used on subsequent events.
 * - Last nurture email CTA click is stored separately and does not replace first-touch.
 */

import { getApiUrl } from "@/utils/env";

const SESSION_KEY = "lt_analytics_session";
const ANON_KEY = "lt_analytics_anon";
const LANDING_KEY = "lt_analytics_landing";
const ATTRIBUTION_KEY = "lt_analytics_attribution";
const LAST_NURTURE_CLICK_KEY = "lt_analytics_last_nurture_click";
const VISIT_COUNT_KEY = "lt_analytics_visit_count";
const CHECKOUT_STARTED_KEY = "lt_checkout_started_at";
const QUEUE_FLUSH_MS = 800;
const MAX_BATCH = 20;

const NURTURE_CAMPAIGN = "trial_nurture_v3";

type Props = Record<string, unknown>;

interface Attribution {
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  utmContent: string | null;
  utmTerm: string | null;
  fbclid: string | null;
  gclid: string | null;
  referrer: string | null;
  landingPage: string | null;
}

interface LastNurtureClick {
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  utmContent: string | null;
  utmTerm: string | null;
  clickedAt: string;
  sequenceStep: number | null;
  cta: string | null;
}

interface TrackPayload {
  eventName: string;
  occurredAt: string;
  sessionId: string;
  anonymousId: string;
  userEmail?: string | null;
  licenseId?: string | null;
  correlationId?: string | null;
  searchId?: string | null;
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
  device?: string | null;
  browser?: string | null;
  os?: string | null;
  durationMs?: number | null;
  idempotencyKey?: string | null;
  properties?: Props;
}

const queue: TrackPayload[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;
const sentKeys = new Set<string>();
let nurtureClickCapturedThisLoad = false;

function uuid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `lt_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function storageGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function storageSet(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* ignore */
  }
}

function getSessionId(): string {
  let id = storageGet(SESSION_KEY);
  if (!id) {
    id = uuid();
    storageSet(SESSION_KEY, id);
  }
  return id;
}

function getAnonymousId(): string {
  let id = storageGet(ANON_KEY);
  if (!id) {
    id = uuid();
    storageSet(ANON_KEY, id);
  }
  return id;
}

function parseAttributionFromUrl(): Attribution {
  if (typeof window === "undefined") {
    return {
      utmSource: null,
      utmMedium: null,
      utmCampaign: null,
      utmContent: null,
      utmTerm: null,
      fbclid: null,
      gclid: null,
      referrer: null,
      landingPage: null,
    };
  }
  const params = new URLSearchParams(window.location.search);
  return {
    utmSource: params.get("utm_source"),
    utmMedium: params.get("utm_medium"),
    utmCampaign: params.get("utm_campaign"),
    utmContent: params.get("utm_content"),
    utmTerm: params.get("utm_term"),
    fbclid: params.get("fbclid"),
    gclid: params.get("gclid"),
    referrer: document.referrer || null,
    landingPage: `${window.location.pathname}${window.location.search}`,
  };
}

function parseStepFromContent(utmContent: string | null): number | null {
  if (!utmContent) return null;
  const match = /^trial_v(\d+)_step_(\d+)$/i.exec(utmContent.trim());
  if (!match) return null;
  return Number(match[2]);
}

function readStoredAttribution(): Attribution | null {
  try {
    const raw = storageGet(ATTRIBUTION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Attribution;
    if (parsed && typeof parsed === "object") return parsed;
  } catch {
    /* ignore */
  }
  return null;
}

function hasAcquisitionSignal(attr: Attribution): boolean {
  return Boolean(
    attr.utmSource ||
      attr.utmMedium ||
      attr.utmCampaign ||
      attr.fbclid ||
      attr.gclid ||
      attr.referrer
  );
}

/**
 * First-touch attribution persisted for Landing → Revenue continuity.
 * Never overwritten by later nurture email UTMs once set.
 */
export function getPersistedAttribution(): Attribution {
  const existing = readStoredAttribution();
  if (existing && hasAcquisitionSignal(existing)) {
    return existing;
  }

  const fresh = parseAttributionFromUrl();
  let landing = storageGet(LANDING_KEY);
  if (!landing) {
    landing = fresh.landingPage || "/";
    storageSet(LANDING_KEY, landing);
  }
  fresh.landingPage = landing;

  // Prefer keeping a prior empty shell only if URL has no signal either
  if (existing && !hasAcquisitionSignal(fresh)) {
    return existing;
  }

  if (hasAcquisitionSignal(fresh) || !existing) {
    storageSet(ATTRIBUTION_KEY, JSON.stringify(fresh));
  }

  return fresh;
}

export function getLastNurtureClick(): LastNurtureClick | null {
  try {
    const raw = storageGet(LAST_NURTURE_CLICK_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as LastNurtureClick;
    if (parsed && typeof parsed === "object") return parsed;
  } catch {
    /* ignore */
  }
  return null;
}

/**
 * Capture nurture CTA landings as email_clicked without replacing first-touch.
 * Safe to call on every page load; deduped per load + idempotency key.
 */
export function captureNurtureEmailClick(): void {
  try {
    if (typeof window === "undefined") return;
    if (nurtureClickCapturedThisLoad) return;

    const fresh = parseAttributionFromUrl();
    if (fresh.utmCampaign !== NURTURE_CAMPAIGN) return;

    nurtureClickCapturedThisLoad = true;

    const step = parseStepFromContent(fresh.utmContent);
    const clickedAt = new Date().toISOString();
    const lastClick: LastNurtureClick = {
      utmSource: fresh.utmSource,
      utmMedium: fresh.utmMedium,
      utmCampaign: fresh.utmCampaign,
      utmContent: fresh.utmContent,
      utmTerm: fresh.utmTerm,
      clickedAt,
      sequenceStep: step,
      cta: fresh.utmTerm,
    };
    storageSet(LAST_NURTURE_CLICK_KEY, JSON.stringify(lastClick));

    // Ensure first-touch exists without overwriting a prior acquisition source
    const first = readStoredAttribution();
    if (!first || !hasAcquisitionSignal(first)) {
      getPersistedAttribution();
    }

    const sessionId = getSessionId();
    const content = fresh.utmContent || "unknown";
    const term = fresh.utmTerm || "cta";
    track("email_clicked", {
      properties: {
        email_channel: "trial_nurture",
        sequence_version: 3,
        sequence_step: step,
        campaign: NURTURE_CAMPAIGN,
        cta: term,
        attribution_model: "last_email_click",
      },
      idempotencyKey: `nurture_click:${sessionId}:${content}:${term}`,
    });
  } catch {
    /* ignore */
  }
}

function detectDevice(): string {
  if (typeof navigator === "undefined") return "unknown";
  const ua = navigator.userAgent;
  if (/Mobi|Android/i.test(ua)) return "mobile";
  if (/Tablet|iPad/i.test(ua)) return "tablet";
  return "desktop";
}

function detectBrowser(): string {
  if (typeof navigator === "undefined") return "unknown";
  const ua = navigator.userAgent;
  if (ua.includes("Firefox")) return "firefox";
  if (ua.includes("Edg")) return "edge";
  if (ua.includes("Chrome")) return "chrome";
  if (ua.includes("Safari")) return "safari";
  return "other";
}

function detectOs(): string {
  if (typeof navigator === "undefined") return "unknown";
  const ua = navigator.userAgent;
  if (/Windows/i.test(ua)) return "windows";
  if (/Mac OS/i.test(ua)) return "macos";
  if (/Android/i.test(ua)) return "android";
  if (/iPhone|iPad/i.test(ua)) return "ios";
  if (/Linux/i.test(ua)) return "linux";
  return "other";
}

async function flush(): Promise<void> {
  if (queue.length === 0) return;
  const batch = queue.splice(0, MAX_BATCH);
  const apiUrl = getApiUrl();
  if (!apiUrl) return;

  try {
    const body = JSON.stringify({
      sessionId: getSessionId(),
      anonymousId: getAnonymousId(),
      events: batch,
    });

    if (typeof navigator !== "undefined" && "sendBeacon" in navigator) {
      const blob = new Blob([body], { type: "application/json" });
      navigator.sendBeacon(`${apiUrl}/public/events`, blob);
      return;
    }

    void fetch(`${apiUrl}/public/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
    }).catch(() => undefined);
  } catch {
    /* never surface */
  }
}

function scheduleFlush(): void {
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    void flush();
  }, QUEUE_FLUSH_MS);
}

export function track(
  eventName: string,
  options?: {
    properties?: Props;
    userEmail?: string | null;
    licenseId?: string | null;
    searchId?: string | null;
    correlationId?: string | null;
    durationMs?: number | null;
    idempotencyKey?: string | null;
  }
): void {
  try {
    if (typeof window === "undefined") return;
    if (!eventName) return;

    const key = options?.idempotencyKey;
    if (key) {
      if (sentKeys.has(key)) return;
      sentKeys.add(key);
      if (sentKeys.size > 500) {
        const first = sentKeys.values().next().value;
        if (first) sentKeys.delete(first);
      }
    }

    // Capture nurture click before reading first-touch so landing sessions are attributed
    if (eventName !== "email_clicked") {
      captureNurtureEmailClick();
    }

    const attr = getPersistedAttribution();
    const lastNurture = getLastNurtureClick();
    const urlAttr = parseAttributionFromUrl();
    const isNurtureClick = eventName === "email_clicked" && urlAttr.utmCampaign === NURTURE_CAMPAIGN;
    const eventAttr = isNurtureClick
      ? {
          utmSource: urlAttr.utmSource || lastNurture?.utmSource || null,
          utmMedium: urlAttr.utmMedium || lastNurture?.utmMedium || null,
          utmCampaign: urlAttr.utmCampaign || lastNurture?.utmCampaign || null,
          utmContent: urlAttr.utmContent || lastNurture?.utmContent || null,
          utmTerm: urlAttr.utmTerm || lastNurture?.utmTerm || null,
        }
      : {
          utmSource: attr.utmSource,
          utmMedium: attr.utmMedium,
          utmCampaign: attr.utmCampaign,
          utmContent: attr.utmContent,
          utmTerm: attr.utmTerm,
        };

    queue.push({
      eventName,
      occurredAt: new Date().toISOString(),
      sessionId: getSessionId(),
      anonymousId: getAnonymousId(),
      userEmail: options?.userEmail ?? null,
      licenseId: options?.licenseId ?? null,
      correlationId: options?.correlationId ?? null,
      searchId: options?.searchId ?? null,
      pagePath: `${window.location.pathname}${window.location.search}`,
      referrer: attr.referrer || document.referrer || null,
      // First-touch on product events; nurture UTMs on email_clicked
      utmSource: eventAttr.utmSource,
      utmMedium: eventAttr.utmMedium,
      utmCampaign: eventAttr.utmCampaign,
      utmContent: eventAttr.utmContent,
      utmTerm: eventAttr.utmTerm,
      fbclid: attr.fbclid,
      gclid: attr.gclid,
      landingPage: attr.landingPage,
      device: detectDevice(),
      browser: detectBrowser(),
      os: detectOs(),
      durationMs: options?.durationMs ?? null,
      idempotencyKey: key ?? null,
      properties: {
        ...(options?.properties ?? {}),
        campaign: eventAttr.utmCampaign,
        adCreative: eventAttr.utmContent,
        ...(lastNurture && !isNurtureClick
          ? {
              last_nurture_campaign: lastNurture.utmCampaign,
              last_nurture_content: lastNurture.utmContent,
              last_nurture_term: lastNurture.utmTerm,
              last_nurture_step: lastNurture.sequenceStep,
              last_nurture_clicked_at: lastNurture.clickedAt,
            }
          : {}),
      },
    });

    if (queue.length >= MAX_BATCH) {
      void flush();
    } else {
      scheduleFlush();
    }
  } catch {
    /* ignore */
  }
}

export function trackPageView(path?: string): void {
  captureNurtureEmailClick();

  const pathname =
    path || (typeof window !== "undefined" ? window.location.pathname : "/");

  track("page_view", {
    properties: { path: pathname },
    idempotencyKey: `page_view:${pathname}:${Math.floor(Date.now() / 5000)}`,
  });

  try {
    const visits = Number(storageGet(VISIT_COUNT_KEY) || "0") + 1;
    storageSet(VISIT_COUNT_KEY, String(visits));
    if (visits === 2) {
      track("second_visit", {
        idempotencyKey: `second_visit:${getAnonymousId()}`,
      });
    }
    if (visits >= 3) {
      track("returning_customer", {
        idempotencyKey: `returning_customer:${getAnonymousId()}`,
      });
    }
  } catch {
    /* ignore */
  }
}

export function markCheckoutStarted(): void {
  storageSet(CHECKOUT_STARTED_KEY, String(Date.now()));
}

export function markCheckoutPaid(): void {
  try {
    localStorage.removeItem(CHECKOUT_STARTED_KEY);
  } catch {
    /* ignore */
  }
}

export function maybeTrackCheckoutAbandoned(): void {
  const startedAt = storageGet(CHECKOUT_STARTED_KEY);
  if (!startedAt) return;
  track("checkout_abandoned", {
    durationMs: Date.now() - Number(startedAt),
    idempotencyKey: `checkout_abandoned:${getSessionId()}`,
  });
  try {
    localStorage.removeItem(CHECKOUT_STARTED_KEY);
  } catch {
    /* ignore */
  }
}

/** Flush pending events (e.g. on pagehide). */
export function flushAnalytics(): void {
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
  void flush();
}

if (typeof window !== "undefined") {
  window.addEventListener("pagehide", () => {
    maybeTrackCheckoutAbandoned();
    flushAnalytics();
  });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flushAnalytics();
  });
}
