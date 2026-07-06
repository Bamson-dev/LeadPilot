import type { Request, Response, NextFunction } from "express";

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

const WINDOW_MS = Number(process.env.OUTREACH_GENERATE_RATE_WINDOW_MS) || 60 * 60 * 1000;
const MAX_PER_USER = Number(process.env.OUTREACH_GENERATE_RATE_MAX) || 20;

export function outreachGenerateRateLimit(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const key =
    req.licenseEmail?.toLowerCase().trim() ||
    req.user?.id ||
    req.ip ||
    "unknown";

  const now = Date.now();
  let bucket = buckets.get(key);

  if (!bucket || now >= bucket.resetAt) {
    bucket = { count: 0, resetAt: now + WINDOW_MS };
    buckets.set(key, bucket);
  }

  bucket.count++;

  if (bucket.count > MAX_PER_USER) {
    res.status(429).json({
      error: "Too many email generations. Please wait before trying again.",
      code: "outreach_generate_rate_limited",
    });
    return;
  }

  next();
}
