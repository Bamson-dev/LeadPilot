import { Router, type Request, type Response } from "express";
import { activateLicense, getLicenseKeyByKey } from "../database/license-repository";
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
    const email = String(req.query.email ?? "").toLowerCase().trim();
    const key = String(req.query.key ?? "").trim().toUpperCase();

    if (!email || !key) {
      res.status(400).json({ error: "Email and key required" });
      return;
    }

    const license = await getLicenseKeyByKey(key);
    if (!license || license.email !== email) {
      res.status(401).json({ valid: false });
      return;
    }

    res.json({
      valid: true,
      activated: license.activated,
      email: license.email,
    });
  } catch (err) {
    logger.error("License status check failed", {
      error: err instanceof Error ? err.message : "unknown",
    });
    res.status(500).json({ error: "Status check failed" });
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
