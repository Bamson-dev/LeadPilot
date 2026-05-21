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
    const licenseKey = req.headers["x-license-key"] as string | undefined;
    const email = req.headers["x-license-email"] as string | undefined;

    if (!licenseKey || !email) {
      res.status(401).json({
        error: "License key required. Please activate your account.",
        code: "NO_LICENSE",
      });
      return;
    }

    const license = await getLicenseByKeyAndEmail(licenseKey, email);

    if (!license) {
      res.status(401).json({
        error: "Invalid license key or email. Please check your activation details.",
        code: "INVALID_LICENSE",
      });
      return;
    }

    const limitCheck = await checkAndIncrementSearchCount(license.id);

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
    logger.error("Search limit check failed", {
      error: err instanceof Error ? err.message : "unknown",
    });
    res.status(500).json({ error: "Authorization check failed" });
  }
}
