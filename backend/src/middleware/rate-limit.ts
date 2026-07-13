import type { Request, Response, NextFunction } from "express";

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

const WINDOW_MS = Number(process.env.RATE_LIMIT_WINDOW_MS) || 60_000;
const MAX_REQUESTS = Number(process.env.RATE_LIMIT_MAX) || 30;
const SENDS_MAX_REQUESTS = Number(process.env.RATE_LIMIT_SENDS_MAX) || 60;
const CHECKOUT_BALANCE_MAX_REQUESTS =
  Number(process.env.RATE_LIMIT_CHECKOUT_BALANCE_MAX) || 120;
/** Dashboard polls status/results every few seconds for minutes during Phase 2. */
const SEARCH_POLL_MAX_REQUESTS =
  Number(process.env.RATE_LIMIT_SEARCH_POLL_MAX) || 180;

function headerIp(value: string | string[] | undefined): string | null {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed || null;
  }
  if (Array.isArray(value)) {
    const trimmed = value[0]?.trim();
    return trimmed || null;
  }
  return null;
}

/** Resolve the client IP behind Cloudflare / reverse proxies. */
export function clientIp(req: Request): string {
  const cfConnectingIp = headerIp(req.headers["cf-connecting-ip"]);
  if (cfConnectingIp) return cfConnectingIp;

  const trueClientIp = headerIp(req.headers["true-client-ip"]);
  if (trueClientIp) return trueClientIp;

  const realIp = headerIp(req.headers["x-real-ip"]);
  if (realIp) return realIp;

  const forwarded = headerIp(req.headers["x-forwarded-for"]);
  if (forwarded) {
    const parts = forwarded.split(",").map((part) => part.trim()).filter(Boolean);
    if (parts.length > 0) {
      return parts[0];
    }
  }

  return req.ip ?? "unknown";
}

export interface ClientIpDiagnostics {
  resolvedIp: string;
  allowlisted: boolean;
  allowlistConfigured: boolean;
  headers: {
    "cf-connecting-ip": string | null;
    "true-client-ip": string | null;
    "x-real-ip": string | null;
    "x-forwarded-for": string | null;
  };
  expressReqIp: string | null;
  socketRemoteAddress: string | null;
}

export function getClientIpDiagnostics(req: Request): ClientIpDiagnostics {
  const resolvedIp = clientIp(req);
  const allowlist = parseIpAllowlist();
  return {
    resolvedIp,
    allowlisted: allowlist.has(resolvedIp),
    allowlistConfigured: allowlist.size > 0,
    headers: {
      "cf-connecting-ip": headerIp(req.headers["cf-connecting-ip"]),
      "true-client-ip": headerIp(req.headers["true-client-ip"]),
      "x-real-ip": headerIp(req.headers["x-real-ip"]),
      "x-forwarded-for": headerIp(req.headers["x-forwarded-for"]),
    },
    expressReqIp: req.ip ?? null,
    socketRemoteAddress: req.socket?.remoteAddress ?? null,
  };
}

function parseIpAllowlist(): Set<string> {
  const raw = process.env.RATE_LIMIT_IP_ALLOWLIST?.trim();
  if (!raw) return new Set();
  return new Set(
    raw
      .split(",")
      .map((ip) => ip.trim())
      .filter(Boolean)
  );
}

export function isRateLimitAllowlisted(ip: string): boolean {
  return parseIpAllowlist().has(ip);
}

export function rateLimit(req: Request, res: Response, next: NextFunction): void {
  const ip = clientIp(req);
  if (isRateLimitAllowlisted(ip)) {
    next();
    return;
  }

  const scope = requestScope(req);
  const key = `${scope}:${ip}`;
  const now = Date.now();
  let bucket = buckets.get(key);

  if (!bucket || now >= bucket.resetAt) {
    bucket = { count: 0, resetAt: now + WINDOW_MS };
    buckets.set(key, bucket);
  }

  bucket.count++;

  if (bucket.count > maxRequestsForScope(scope)) {
    res.status(429).json({
      error: "Too many requests. Please wait a minute and try again.",
      code: "RATE_LIMITED",
    });
    return;
  }

  next();
}

function requestScope(
  req: Request
): "default" | "sends" | "checkout-balance" | "search-poll" {
  const url = req.originalUrl || req.path;
  if (url.startsWith("/sends")) return "sends";
  if (url.startsWith("/checkout") || url.startsWith("/balance")) {
    return "checkout-balance";
  }
  if (isSearchPollRequest(req)) return "search-poll";
  return "default";
}

function isSearchPollRequest(req: Request): boolean {
  if (req.method !== "GET") return false;
  const path = (req.originalUrl || req.path || "").split("?")[0];
  if (!path.startsWith("/search/")) return false;
  if (path.startsWith("/search/results/")) return true;
  if (/\/search\/[^/]+\/results$/.test(path)) return true;
  if (/\/search\/[^/]+\/stream$/.test(path)) return true;
  // Job status: GET /search/:uuid
  if (/^\/search\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(path)) {
    return true;
  }
  return false;
}

function maxRequestsForScope(
  scope: "default" | "sends" | "checkout-balance" | "search-poll"
): number {
  if (scope === "sends") return SENDS_MAX_REQUESTS;
  if (scope === "checkout-balance") return CHECKOUT_BALANCE_MAX_REQUESTS;
  if (scope === "search-poll") return SEARCH_POLL_MAX_REQUESTS;
  return MAX_REQUESTS;
}
