import type { Request, Response, NextFunction } from "express";
import { recordApiLatency } from "../observability/latency-metrics";

/**
 * Passive request timing. Does not modify responses or business logic.
 */
export function observabilityLatency(
  _req: Request,
  res: Response,
  next: NextFunction
): void {
  const started = Date.now();
  res.on("finish", () => {
    recordApiLatency(Date.now() - started);
  });
  next();
}
