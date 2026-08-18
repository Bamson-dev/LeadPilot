import { Router, type Request, type Response } from "express";
import {
  activateLicense,
  getLicenseByKeyAndEmail,
  getLicenseKeyByKey,
  registerDevice,
} from "../database/license-repository";
import { ensureRefCodeForEmail } from "../services/license-service";
import { getLicenseUsage } from "../services/topup-service";
import { sendWelcomeEmail } from "../services/email";
import { supabase } from "../database/client";
import { trackEvent } from "../observability/track";
import { EVENT_NAMES } from "../observability/event-taxonomy";
import { logger } from "../utils/logger";
import { onLicenseActivatedForCampaign } from "../email-campaigns/ai-money-code/hooks";

export const authRouter = Router();

authRouter.post("/activate", async (req: Request, res: Response) => {
  try {
    const { email, key, deviceSignature } = req.body as {
      email?: string;
      key?: string;
      deviceSignature?: string;
    };

    if (!email?.trim() || !key?.trim()) {
      trackEvent({
        eventName: EVENT_NAMES.LICENSE_ACTIVATION_FAILED,
        source: "server",
        properties: { reason: "missing_fields" },
        idempotencyKey: `license_activation_failed:missing:${Date.now()}`,
      });
      res.status(400).json({ error: "Email and license key are required" });
      return;
    }

    const normalizedEmail = email.toLowerCase().trim();
    const normalizedKey = key.trim().toUpperCase();

    const license = await getLicenseKeyByKey(normalizedKey);

    if (!license) {
      trackEvent({
        eventName: EVENT_NAMES.LICENSE_INVALID,
        source: "server",
        userEmail: normalizedEmail,
        properties: { reason: "invalid_key" },
        idempotencyKey: `license_invalid:${normalizedEmail}:${normalizedKey.slice(0, 8)}`,
      });
      trackEvent({
        eventName: EVENT_NAMES.LICENSE_ACTIVATION_FAILED,
        source: "server",
        userEmail: normalizedEmail,
        properties: { reason: "invalid_key" },
        idempotencyKey: `license_activation_failed:invalid:${normalizedEmail}:${normalizedKey.slice(0, 8)}`,
      });
      res.status(401).json({ error: "Invalid license key" });
      return;
    }

    if (license.email !== normalizedEmail) {
      trackEvent({
        eventName: EVENT_NAMES.LICENSE_ACTIVATION_FAILED,
        source: "server",
        userEmail: normalizedEmail,
        licenseId: license.id,
        properties: { reason: "email_mismatch" },
        idempotencyKey: `license_activation_failed:mismatch:${license.id}:${normalizedEmail}`,
      });
      res.status(401).json({ error: "License key does not match this email" });
      return;
    }

    const wasAlreadyActivated = Boolean(license.activated);

    if (!license.activated) {
      await activateLicense(license.id);
      try {
        await sendWelcomeEmail(normalizedEmail);
      } catch (error) {
        console.error("Email send failed:", { userEmail: normalizedEmail, error });
      }
      void onLicenseActivatedForCampaign({ licenseId: license.id, email: normalizedEmail });
    }

    if (deviceSignature?.trim()) {
      const deviceResult = await registerDevice(license.id, deviceSignature, {
        isActivation: true,
      });
      if (!deviceResult.allowed) {
        trackEvent({
          eventName: EVENT_NAMES.LICENSE_DEVICE_DENIED,
          source: "server",
          userEmail: normalizedEmail,
          licenseId: license.id,
          properties: { reason: deviceResult.reason ?? "denied" },
          idempotencyKey: `license_device_denied:${license.id}:${Date.now()}`,
        });
        trackEvent({
          eventName: EVENT_NAMES.LICENSE_ACTIVATION_FAILED,
          source: "server",
          userEmail: normalizedEmail,
          licenseId: license.id,
          properties: { reason: "device_denied" },
          idempotencyKey: `license_activation_failed:device:${license.id}:${Date.now()}`,
        });
        res.status(403).json({
          error: deviceResult.reason ?? "Device registration denied",
          code: deviceResult.reason?.includes("Maximum devices")
            ? "MAX_DEVICES"
            : "DEVICE_DENIED",
        });
        return;
      }
    }

    await ensureRefCodeForEmail(normalizedEmail);

    if (wasAlreadyActivated) {
      trackEvent({
        eventName: EVENT_NAMES.DUPLICATE_ACTIVATION,
        source: "server",
        userEmail: normalizedEmail,
        licenseId: license.id,
        idempotencyKey: `duplicate_activation:${license.id}:${Math.floor(Date.now() / 60_000)}`,
      });
    }

    trackEvent({
      eventName: EVENT_NAMES.LICENSE_ACTIVATED,
      source: "server",
      userEmail: normalizedEmail,
      licenseId: license.id,
      properties: { alreadyActivated: wasAlreadyActivated },
      idempotencyKey: `license_activated:${license.id}`,
    });

    res.json({
      success: true,
      email: license.email,
      activated: true,
    });
  } catch (err) {
    logger.error("License activation failed", {
      error: err instanceof Error ? err.message : "unknown",
    });
    trackEvent({
      eventName: EVENT_NAMES.LICENSE_ACTIVATION_FAILED,
      source: "server",
      properties: { reason: "exception" },
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

    const normalizedEmail = email.toLowerCase().trim();
    const normalizedKey = key.trim().toUpperCase();
    const license = await getLicenseKeyByKey(normalizedKey);
    if (!license || license.email !== normalizedEmail) {
      res.status(401).json({ error: "Invalid license" });
      return;
    }

    if (!license.activated) {
      res.status(401).json({ error: "Account not activated" });
      return;
    }

    const result = await registerDevice(license.id, deviceSignature);
    if (!result.allowed) {
      const isMaxDevices = result.reason?.includes("Maximum devices") ?? false;
      res.status(403).json({
        error: result.reason ?? "Device registration denied",
        code: isMaxDevices ? "MAX_DEVICES" : "DEVICE_DENIED",
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
