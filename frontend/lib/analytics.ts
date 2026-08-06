/**
 * Passive client analytics tracker.
 * Fire-and-forget batched posts to POST /public/events.
 * Never throws. Never blocks UX.
 */

import { getApiUrl } from "@/utils/env";

const SESSION_KEY = "lt_analytics_session";
const ANON_KEY = "lt_analytics_anon";
const LANDING_KEY = "lt_analytics_landing";
const QUEUE_FLUSH_MS = 800;
const MAX_BATCH = 20;

type Props = Record<string, unknown>;

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
  landingPage?: string | null;
  device?: string | null;
  browser?: string | null;
  os?: string | null;
  durationMs?: number | null;
  idempotencyKey?: string | null;
  properties?: Props;
}

let queue: TrackPayload[] = [];
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

function getLandingPage(): string {
  let landing = storageGet(LANDING_KEY);
  if (!landing && typeof window !== "undefined") {
    landing = `${window.location.pathname}${window.location.search}`;
    storageSet(LANDING_KEY, landing);
  }
  return landing || "/";
}

function parseUtm(): { source: string | null; medium: string | null; campaign: string | null } {
  if (typeof window === "undefined") {
    return { source: null, medium: null, campaign: null };
  }
  const params = new URLSearchParams(window.location.search);
  return {
    source: params.get("utm_source"),
    medium: params.get("utm_medium"),
    campaign: params.get("utm_campaign"),
  };
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

    const utm = parseUtm();
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
      referrer: document.referrer || null,
      utmSource: utm.source,
      utmMedium: utm.medium,
      utmCampaign: utm.campaign,
      landingPage: getLandingPage(),
      device: detectDevice(),
      browser: detectBrowser(),
      os: detectOs(),
      durationMs: options?.durationMs ?? null,
      idempotencyKey: key ?? null,
      properties: options?.properties ?? {},
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
  track("page_view", {
    properties: { path: path || (typeof window !== "undefined" ? window.location.pathname : null) },
    idempotencyKey: `page_view:${typeof window !== "undefined" ? window.location.pathname : path}:${Math.floor(Date.now() / 5000)}`,
  });
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
  window.addEventListener("pagehide", () => flushAnalytics());
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flushAnalytics();
  });
}
