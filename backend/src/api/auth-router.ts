import { Router, type Request, type Response } from "express";
import {
  activateLicense,
  getLicenseByKeyAndEmail,
  isSupabaseRowNotFound,
  LICENSE_AUTH_SELECT,
  normalizeLicenseRow,
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

    const { data: licenseRow, error: licenseLookupError } = await supabase
      .from("license_keys")
      .select(LICENSE_AUTH_SELECT)
      .eq("key", normalizedKey)
      .eq("email", normalizedEmail)
      .single();

    if (licenseLookupError && !isSupabaseRowNotFound(licenseLookupError)) {
      logger.error("License login lookup failed", {
        keyPrefix: normalizedKey.slice(0, 8),
        error: licenseLookupError.message,
      });
      trackEvent({
        eventName: EVENT_NAMES.LICENSE_ACTIVATION_FAILED,
        source: "server",
        userEmail: normalizedEmail,
        properties: { reason: "database_unavailable" },
        idempotencyKey: `license_activation_failed:db:${Date.now()}`,
      });
      res.status(503).json({
        error:
          "Login is temporarily unavailable. Please try again in a few minutes or contact support on WhatsApp 09067285890.",
        code: "SERVICE_UNAVAILABLE",
      });
      return;
    }

    const license =
      licenseRow && !licenseLookupError
        ? normalizeLicenseRow(licenseRow as Record<string, unknown>)
        : null;

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

    if (license.is_suspended) {
      trackEvent({
        eventName: EVENT_NAMES.LICENSE_ACTIVATION_FAILED,
        source: "server",
        userEmail: normalizedEmail,
        licenseId: license.id,
        properties: { reason: "suspended" },
        idempotencyKey: `license_activation_failed:suspended:${license.id}`,
      });
      res.status(403).json({
        error:
          license.suspension_reason ||
          "Your account has been suspended. Contact support on WhatsApp 09067285890.",
        code: "SUSPENDED",
      });
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
    const message = err instanceof Error ? err.message : "unknown";
    logger.error("License activation failed", { error: message });
    trackEvent({
      eventName: EVENT_NAMES.LICENSE_ACTIVATION_FAILED,
      source: "server",
      properties: { reason: "exception" },
    });
    const serviceUnavailable = /egress|quota|402|restricted|service unavailable/i.test(
      message
    );
    res.status(serviceUnavailable ? 503 : 500).json({
      error: serviceUnavailable
        ? "Login is temporarily unavailable. Please try again in a few minutes or contact support on WhatsApp 09067285890."
        : "Activation failed",
      code: serviceUnavailable ? "SERVICE_UNAVAILABLE" : "ACTIVATION_FAILED",
    });
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
      .select(LICENSE_AUTH_SELECT)
      .eq("key", licenseKey)
      .eq("email", email)
      .single();

    if (error && !isSupabaseRowNotFound(error)) {
      logger.error("Auth status license lookup failed", { error: error.message });
      res.status(503).json({
        valid: false,
        reason:
          "Login is temporarily unavailable. Please try again in a few minutes or contact support on WhatsApp 09067285890.",
        code: "SERVICE_UNAVAILABLE",
      });
      return;
    }

    if (!license) {
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
    const { data: licenseRow, error: licenseLookupError } = await supabase
      .from("license_keys")
      .select(LICENSE_AUTH_SELECT)
      .eq("key", normalizedKey)
      .eq("email", normalizedEmail)
      .single();

    if (licenseLookupError && !isSupabaseRowNotFound(licenseLookupError)) {
      logger.error("Device registration license lookup failed", {
        error: licenseLookupError.message,
      });
      res.status(503).json({ error: "Device registration temporarily unavailable" });
      return;
    }

    if (!licenseRow || licenseLookupError) {
      res.status(401).json({ error: "Invalid license" });
      return;
    }

    const license = normalizeLicenseRow(licenseRow as Record<string, unknown>);

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

    const normalizedKey = key.trim().toUpperCase();
    const normalizedEmail = email.toLowerCase().trim();
    const { data, error } = await supabase
      .from("license_keys")
      .select(LICENSE_AUTH_SELECT)
      .eq("key", normalizedKey)
      .eq("email", normalizedEmail)
      .single();

    if (error && !isSupabaseRowNotFound(error)) {
      logger.error("License validate lookup failed", { error: error.message });
      res.status(503).json({ error: "Validation temporarily unavailable" });
      return;
    }

    if (!data || error) {
      res.status(401).json({ valid: false });
      return;
    }

    res.json({ valid: true, activated: data.activated });
  } catch (err) {
    res.status(500).json({ error: "Validation failed" });
  }
});
