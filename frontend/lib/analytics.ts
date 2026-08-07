/**
 * Passive client analytics tracker.
 * Fire-and-forget batched posts to POST /public/events.
 * Never throws. Never blocks UX.
 */

import { getApiUrl } from "@/utils/env";

const SESSION_KEY = "lt_analytics_session";
const ANON_KEY = "lt_analytics_anon";
const LANDING_KEY = "lt_analytics_landing";
const ATTRIBUTION_KEY = "lt_analytics_attribution";
const VISIT_COUNT_KEY = "lt_analytics_visit_count";
const CHECKOUT_STARTED_KEY = "lt_checkout_started_at";
const QUEUE_FLUSH_MS = 800;
const MAX_BATCH = 20;

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

/** First-touch attribution persisted for Landing → Revenue continuity. */
export function getPersistedAttribution(): Attribution {
  try {
    const raw = storageGet(ATTRIBUTION_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Attribution;
      if (parsed && typeof parsed === "object") return parsed;
    }
  } catch {
    /* ignore */
  }

  const fresh = parseAttributionFromUrl();
  let landing = storageGet(LANDING_KEY);
  if (!landing) {
    landing = fresh.landingPage || "/";
    storageSet(LANDING_KEY, landing);
  }
  fresh.landingPage = landing;

  const hasTouch =
    Boolean(fresh.utmSource) ||
    Boolean(fresh.utmMedium) ||
    Boolean(fresh.utmCampaign) ||
    Boolean(fresh.fbclid) ||
    Boolean(fresh.gclid) ||
    Boolean(fresh.referrer);

  if (hasTouch || !storageGet(ATTRIBUTION_KEY)) {
    storageSet(ATTRIBUTION_KEY, JSON.stringify(fresh));
  }

  return fresh;
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

    const attr = getPersistedAttribution();
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
      utmSource: attr.utmSource,
      utmMedium: attr.utmMedium,
      utmCampaign: attr.utmCampaign,
      utmContent: attr.utmContent,
      utmTerm: attr.utmTerm,
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
        campaign: attr.utmCampaign,
        adCreative: attr.utmContent,
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
