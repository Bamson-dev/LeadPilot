import type { Request, Response, NextFunction } from "express";
import {
  checkAndIncrementSearchCount,
  getLicenseByKeyAndEmail,
} from "../database/license-repository";
import { supabase } from "../database/client";
import { sendLimitReachedEmail } from "../services/email";
import { logger } from "../utils/logger";

/**
 * Search metering must fail closed.
 * Any license lookup or limit-check failure returns 503 — never grants free searches.
 */
export async function checkSearchLimit(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const licenseKey = (req.headers["x-license-key"] as string)?.trim().toUpperCase();
    const email = (req.headers["x-license-email"] as string)?.toLowerCase().trim();

    if (!licenseKey || !email) {
      res.status(401).json({
        error: "License key required. Please activate your account at /activate",
        code: "NO_LICENSE",
      });
      return;
    }

    let license;
    try {
      license = await getLicenseByKeyAndEmail(licenseKey, email);
    } catch (dbErr) {
      logger.error("License lookup DB error — denying search (fail-closed)", {
        error: dbErr instanceof Error ? dbErr.message : "unknown",
      });
      res.status(503).json({
        error: "Unable to verify search allowance. Please try again shortly.",
        code: "METERING_UNAVAILABLE",
      });
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
        error:
          license.suspension_reason ||
          "Account suspended. Contact support on WhatsApp 09067285890.",
        code: "SUSPENDED",
      });
      return;
    }

    let limitCheck: {
      allowed: boolean;
      remaining: number;
      reason?: string;
      creditsRemaining?: number;
    };

    try {
      limitCheck = await checkAndIncrementSearchCount(license.id);
    } catch (limitErr) {
      logger.error("Limit check failed — denying search (fail-closed)", {
        error: limitErr instanceof Error ? limitErr.message : "unknown",
      });
      res.status(503).json({
        error: "Unable to verify search allowance. Please try again shortly.",
        code: "METERING_UNAVAILABLE",
      });
      return;
    }

    if (!limitCheck.allowed) {
      const isSearchLimitReached = limitCheck.reason === "Search limit reached";

      if (isSearchLimitReached) {
        const { data: row } = await supabase
          .from("license_keys")
          .select("limit_email_sent, last_reset_at, email")
          .eq("id", license.id)
          .single();

        if (row && !row.limit_email_sent) {
          const resetDate = new Date(row.last_reset_at as string);
          resetDate.setMonth(resetDate.getMonth() + 1);
          const resetDateStr = resetDate.toLocaleDateString("en-GB", {
            day: "numeric",
            month: "long",
            year: "numeric",
          });

          await supabase
            .from("license_keys")
            .update({ limit_email_sent: true })
            .eq("id", license.id);

          void sendLimitReachedEmail(row.email as string, resetDateStr).catch(
            (err) =>
              logger.error("Failed to send limit email", {
                error: err instanceof Error ? err.message : "unknown",
              })
          );
        }

        res.status(402).json({
          error: "search_limit_reached",
          message: "You have used all your searches for this month.",
          searchesRemaining: 0,
          creditsRemaining: limitCheck.creditsRemaining ?? 0,
        });
        return;
      }

      res.status(403).json({ error: limitCheck.reason ?? "Search not allowed" });
      return;
    }

    req.licenseId = license.id;
    req.licenseKey = licenseKey;
    req.licenseEmail = email;
    req.searchesRemaining = limitCheck.remaining;
    req.creditsRemaining = limitCheck.creditsRemaining;
    next();
  } catch (err) {
    logger.error("Search limit middleware error — denying search (fail-closed)", {
      error: err instanceof Error ? err.message : "unknown",
    });
    res.status(503).json({
      error: "Unable to verify search allowance. Please try again shortly.",
      code: "METERING_UNAVAILABLE",
    });
  }
}
