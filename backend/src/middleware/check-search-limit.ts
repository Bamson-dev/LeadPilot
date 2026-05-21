import type { Request, Response, NextFunction } from "express";
import {
  checkAndIncrementSearchCount,
  getLicenseByKeyAndEmail,
} from "../database/license-repository";
import { logger } from "../utils/logger";

export async function checkSearchLimit(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const licenseKey = req.headers["x-license-key"] as string;
    const email = req.headers["x-license-email"] as string;

    if (!licenseKey || !email) {
      res.status(401).json({
        error: "License key required. Please activate your account at /activate",
        code: "NO_LICENSE",
      });
      return;
    }

    let license = null;
    try {
      license = await getLicenseByKeyAndEmail(licenseKey, email);
    } catch (dbErr) {
      logger.error("License lookup DB error — allowing search", {
        error: dbErr instanceof Error ? dbErr.message : "unknown",
      });
      req.licenseId = "unknown";
      req.searchesRemaining = 99;
      next();
      return;
    }

    if (!license) {
      res.status(401).json({
        error: "Invalid license key. Please check your activation email.",
        code: "INVALID_LICENSE",
      });
      return;
    }

    if (license.is_suspended) {
      res.status(403).json({
        error: license.suspension_reason || "Account suspended. Contact support.",
        code: "SUSPENDED",
      });
      return;
    }

    let limitCheck: { allowed: boolean; remaining: number; reason?: string } = {
      allowed: true,
      remaining: 99,
    };
    try {
      limitCheck = await checkAndIncrementSearchCount(license.id);
    } catch (limitErr) {
      logger.error("Limit check failed — allowing search", {
        error: limitErr instanceof Error ? limitErr.message : "unknown",
      });
    }

    if (!limitCheck.allowed) {
      res.status(429).json({
        error: limitCheck.reason,
        code: "LIMIT_REACHED",
        remaining: 0,
      });
      return;
    }

    req.licenseId = license.id;
    req.searchesRemaining = limitCheck.remaining;
    next();
  } catch (err) {
    logger.error("Search limit middleware error — allowing search", {
      error: err instanceof Error ? err.message : "unknown",
    });
    next();
  }
}
