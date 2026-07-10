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

export function clientIp(req: Request): string {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string") {
    return forwarded.split(",")[0]?.trim() ?? req.ip ?? "unknown";
  }
  return req.ip ?? "unknown";
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

function requestScope(req: Request): "default" | "sends" | "checkout-balance" {
  const url = req.originalUrl || req.path;
  if (url.startsWith("/sends")) return "sends";
  if (url.startsWith("/checkout") || url.startsWith("/balance")) {
    return "checkout-balance";
  }
  return "default";
}

function maxRequestsForScope(scope: "default" | "sends" | "checkout-balance"): number {
  if (scope === "sends") return SENDS_MAX_REQUESTS;
  if (scope === "checkout-balance") return CHECKOUT_BALANCE_MAX_REQUESTS;
  return MAX_REQUESTS;
}
