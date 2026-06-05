import { Router, type Request, type Response } from "express";
import {
  activateLicense,
  getLicenseByKeyAndEmail,
  getLicenseKeyByKey,
  registerDevice,
} from "../database/license-repository";
import { ensureRefCodeForEmail } from "../services/license-service";
import { getLicenseUsage } from "../services/topup-service";
import { supabase } from "../database/client";
import { logger } from "../utils/logger";

export const authRouter = Router();

authRouter.post("/activate", async (req: Request, res: Response) => {
  try {
    const { email, key } = req.body as { email?: string; key?: string };

    if (!email?.trim() || !key?.trim()) {
      res.status(400).json({ error: "Email and license key are required" });
      return;
    }

    const normalizedEmail = email.toLowerCase().trim();
    const normalizedKey = key.trim().toUpperCase();

    const license = await getLicenseKeyByKey(normalizedKey);

    if (!license) {
      res.status(401).json({ error: "Invalid license key" });
      return;
    }

    if (license.email !== normalizedEmail) {
      res.status(401).json({ error: "License key does not match this email" });
      return;
    }

    if (!license.activated) {
      await activateLicense(license.id);
    }

    await ensureRefCodeForEmail(normalizedEmail);

    res.json({
      success: true,
      email: license.email,
      activated: true,
    });
  } catch (err) {
    logger.error("License activation failed", {
      error: err instanceof Error ? err.message : "unknown",
    });
    res.status(500).json({ error: "Activation failed" });
  }
});

authRouter.get("/status", async (req: Request, res: Response) => {
  try {
    const licenseKey = (
      (req.headers["x-license-key"] as string) ||
      String(req.query.key ?? "")
    )
      .trim()
      .toUpperCase();
    const email = (
      (req.headers["x-license-email"] as string) ||
      String(req.query.email ?? "")
    )
      .toLowerCase()
      .trim();

    if (!licenseKey || !email) {
      res.status(401).json({
        valid: false,
        reason: "No license key provided",
        code: "NO_LICENSE",
      });
      return;
    }

    const { data: license, error } = await supabase
      .from("license_keys")
      .select("id, activated, is_suspended, suspension_reason, email, key")
      .eq("key", licenseKey)
      .eq("email", email)
      .single();

    if (error || !license) {
      res.status(401).json({
        valid: false,
        reason: "Invalid license key",
        code: "INVALID_LICENSE",
      });
      return;
    }

    if (!license.activated) {
      res.status(401).json({
        valid: false,
        reason: "Account not activated",
        code: "NOT_ACTIVATED",
      });
      return;
    }

    if (license.is_suspended) {
      res.status(403).json({
        valid: false,
        reason:
          (license.suspension_reason as string) ||
          "Your account has been suspended. Contact support on WhatsApp 09067285890.",
        code: "SUSPENDED",
      });
      return;
    }

    res.json({ valid: true, licenseId: license.id });
  } catch (err) {
    logger.error("Auth status check failed", {
      error: err instanceof Error ? err.message : "unknown",
    });
    res.status(500).json({ valid: false, reason: "Status check failed" });
  }
});

authRouter.get("/usage", async (req: Request, res: Response) => {
  try {
    const licenseKey = (req.headers["x-license-key"] as string)?.trim().toUpperCase();
    const email = (req.headers["x-license-email"] as string)?.toLowerCase().trim();

    if (!licenseKey || !email) {
      res.status(401).json({ error: "License required" });
      return;
    }

    const license = await getLicenseByKeyAndEmail(licenseKey, email);
    if (!license) {
      res.status(401).json({ error: "Invalid license" });
      return;
    }

    const usage = await getLicenseUsage(license.id);
    if (!usage) {
      res.status(404).json({ error: "Usage not found" });
      return;
    }

    res.json(usage);
  } catch (err) {
    logger.error("Auth usage check failed", {
      error: err instanceof Error ? err.message : "unknown",
    });
    res.status(500).json({ error: "Usage check failed" });
  }
});

authRouter.post("/register-device", async (req: Request, res: Response) => {
  try {
    const { email, key, deviceSignature } = req.body as {
      email?: string;
      key?: string;
      deviceSignature?: string;
    };

    if (!email || !key || !deviceSignature) {
      res.status(400).json({ error: "Missing required fields" });
      return;
    }

    const license = await getLicenseByKeyAndEmail(key, email);
    if (!license) {
      res.status(401).json({ error: "Invalid license" });
      return;
    }

    const result = await registerDevice(license.id, deviceSignature);
    if (!result.allowed) {
      res.status(403).json({
        error: result.reason,
        code: "MAX_DEVICES",
      });
      return;
    }

    res.json({ allowed: true });
  } catch (err) {
    logger.error("Device registration failed", {
      error: err instanceof Error ? err.message : "unknown",
    });
    res.status(500).json({ error: "Device registration failed" });
  }
});

authRouter.post("/validate", async (req: Request, res: Response) => {
  try {
    const { email, key } = req.body as { email?: string; key?: string };
    if (!email || !key) {
      res.status(400).json({ error: "Email and key required" });
      return;
    }

    const license = await getLicenseKeyByKey(key);
    if (!license || license.email !== email.toLowerCase().trim()) {
      res.status(401).json({ valid: false });
      return;
    }

    res.json({ valid: true, activated: license.activated });
  } catch (err) {
    res.status(500).json({ error: "Validation failed" });
  }
});
