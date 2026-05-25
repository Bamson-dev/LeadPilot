import type { Request, Response, NextFunction } from "express";
import { getLicenseByKeyAndEmail } from "../database/license-repository";

export async function requireLicense(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const licenseKey = (req.headers["x-license-key"] as string)?.trim().toUpperCase();
    const email = (req.headers["x-license-email"] as string)?.toLowerCase().trim();

    if (!licenseKey || !email) {
      res.status(401).json({ error: "License key and email required" });
      return;
    }

    const license = await getLicenseByKeyAndEmail(licenseKey, email);
    if (!license) {
      res.status(401).json({ error: "Invalid license" });
      return;
    }

    if (!license.activated) {
      res.status(401).json({ error: "Account not activated" });
      return;
    }

    if (license.is_suspended) {
      res.status(403).json({
        error:
          license.suspension_reason ||
          "Account suspended. Contact support on WhatsApp 09067285890.",
      });
      return;
    }

    req.licenseEmail = email;
    req.licenseId = license.id;
    req.licenseKey = licenseKey;
    next();
  } catch {
    res.status(500).json({ error: "License verification failed" });
  }
}
