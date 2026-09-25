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

/** Set by the Next.js /backend rewrite so the real visitor IP survives the second Cloudflare hop. */
export const VISITOR_IP_HEADER = "x-leadthur-client-ip";

const DEFAULT_ORIGIN_IPS = new Set(["167.86.106.198"]);

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

function parseIpList(raw: string | undefined): Set<string> {
  if (!raw?.trim()) return new Set();
  return new Set(
    raw
      .split(",")
      .map((ip) => ip.trim())
      .filter(Boolean)
  );
}

function originIps(): Set<string> {
  return new Set([
    ...DEFAULT_ORIGIN_IPS,
    ...parseIpList(process.env.ORIGIN_IPS),
    ...parseIpList(process.env.TRUSTED_PROXY_IPS),
  ]);
}

function stripIpv4Mapped(ip: string): string {
  return ip.replace(/^::ffff:/i, "").trim();
}

/** Loopback, RFC1918, link-local, and our own origin/proxy addresses. */
export function isInfrastructureIp(ip: string | null | undefined): boolean {
  if (!ip) return true;
  const value = stripIpv4Mapped(ip);
  if (!value || value === "unknown" || value === "*" || value === "::1") return true;
  if (originIps().has(value)) return true;

  const parts = value.split(".");
  if (parts.length === 4 && parts.every((part) => /^\d+$/.test(part))) {
    const a = Number(parts[0]);
    const b = Number(parts[1]);
    if (a === 10 || a === 127) return true;
    if (a === 192 && b === 168) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 169 && b === 254) return true;
    if (a === 0) return true;
  }

  const lower = value.toLowerCase();
  if (lower.startsWith("fc") || lower.startsWith("fd") || lower.startsWith("fe80:")) {
    return true;
  }
  return false;
}

function forwardedIps(req: Request): string[] {
  const raw = headerIp(req.headers["x-forwarded-for"]);
  if (!raw) return [];
  return raw
    .split(",")
    .map((part) => stripIpv4Mapped(part.trim()))
    .filter(Boolean);
}

function connectingHopIp(req: Request): string {
  return (
    headerIp(req.headers["cf-connecting-ip"]) ||
    req.ip ||
    req.socket?.remoteAddress ||
    "unknown"
  );
}

/**
 * Resolve the client IP behind Cloudflare / reverse proxies.
 * When the frontend same-origin proxy hits backend.leadthur.com, Cloudflare
 * overwrites cf-connecting-ip with the VPS origin. Prefer the visitor header
 * Next.js sets, then the first public address in the forwarded chain.
 */
export function clientIp(req: Request): string {
  const hop = connectingHopIp(req);
  const visitor = headerIp(req.headers[VISITOR_IP_HEADER]);
  if (isInfrastructureIp(hop)) {
    if (visitor && !isInfrastructureIp(visitor)) return visitor;
    return stripIpv4Mapped(hop);
  }

  const candidates = [
    headerIp(req.headers["cf-connecting-ip"]),
    headerIp(req.headers["true-client-ip"]),
    headerIp(req.headers["x-real-ip"]),
    ...forwardedIps(req),
    req.ip ?? null,
    req.socket?.remoteAddress ?? null,
  ]
    .map((ip) => (ip ? stripIpv4Mapped(ip) : null))
    .filter((ip): ip is string => Boolean(ip));

  const publicIp = candidates.find((ip) => !isInfrastructureIp(ip));
  return publicIp || candidates[0] || "unknown";
}

export interface ClientIpDiagnostics {
  resolvedIp: string;
  infrastructure: boolean;
  allowlisted: boolean;
  allowlistConfigured: boolean;
  headers: {
    "cf-connecting-ip": string | null;
    "true-client-ip": string | null;
    "x-real-ip": string | null;
    "x-forwarded-for": string | null;
    "x-leadthur-client-ip": string | null;
  };
  expressReqIp: string | null;
  socketRemoteAddress: string | null;
}

export function getClientIpDiagnostics(req: Request): ClientIpDiagnostics {
  const resolvedIp = clientIp(req);
  const allowlist = parseIpAllowlist();
  return {
    resolvedIp,
    infrastructure: isInfrastructureIp(resolvedIp),
    allowlisted: allowlist.has(resolvedIp),
    allowlistConfigured: allowlist.size > 0,
    headers: {
      "cf-connecting-ip": headerIp(req.headers["cf-connecting-ip"]),
      "true-client-ip": headerIp(req.headers["true-client-ip"]),
      "x-real-ip": headerIp(req.headers["x-real-ip"]),
      "x-forwarded-for": headerIp(req.headers["x-forwarded-for"]),
      "x-leadthur-client-ip": headerIp(req.headers[VISITOR_IP_HEADER]),
    },
    expressReqIp: req.ip ?? null,
    socketRemoteAddress: req.socket?.remoteAddress ?? null,
  };
}

function parseIpAllowlist(): Set<string> {
  return parseIpList(process.env.RATE_LIMIT_IP_ALLOWLIST);
}

export function isRateLimitAllowlisted(ip: string): boolean {
  return parseIpAllowlist().has(ip);
}

function rateLimitIdentity(req: Request): string {
  const ip = clientIp(req);
  if (!isInfrastructureIp(ip)) return ip;

  const body = req.body as { email?: unknown } | undefined;
  const email = typeof body?.email === "string" ? body.email.toLowerCase().trim() : "";
  if (email.includes("@")) return `trial-email:${email}`;
  return ip;
}

export function rateLimit(req: Request, res: Response, next: NextFunction): void {
  const ip = clientIp(req);
  if (isRateLimitAllowlisted(ip)) {
    next();
    return;
  }

  const scope = requestScope(req);
  const key = `${scope}:${rateLimitIdentity(req)}`;
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
