import { Router, type Request, type Response } from "express";
import bcrypt from "bcryptjs";
import { config } from "../config/env";
import { requireAdminAuth } from "../middleware/admin-auth";
import { signAdminToken } from "../utils/jwt";
import {
  createLicenseKey,
  listRecentLicenses,
  lookupLicensesByEmail,
  truncateLicenseKey,
  resetDevices,
} from "../database/license-repository";
import { supabase } from "../database/client";
import { sendActivationEmail, sendAdminMessage } from "../services/brevo-service";
import { logger } from "../utils/logger";

const loginAttempts = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const record = loginAttempts.get(ip);

  if (!record || now > record.resetAt) {
    loginAttempts.set(ip, { count: 0, resetAt: now + 15 * 60 * 1000 });
    return true;
  }

  if (record.count >= 5) return false;
  return true;
}

function recordFailedLogin(ip: string): void {
  const now = Date.now();
  const record = loginAttempts.get(ip);

  if (!record || now > record.resetAt) {
    loginAttempts.set(ip, { count: 1, resetAt: now + 15 * 60 * 1000 });
    return;
  }

  record.count++;
}

function clearLoginAttempts(ip: string): void {
  loginAttempts.delete(ip);
}

async function verifyAdminPassword(input: string, stored: string): Promise<boolean> {
  if (stored.startsWith("$2")) {
    return bcrypt.compare(input, stored);
  }
  return input === stored;
}

async function fetchLatestLicenseByEmail(email: string) {
  const normalized = email.toLowerCase().trim();
  const { data, error } = await supabase
    .from("license_keys")
    .select("*")
    .eq("email", normalized)
    .order("created_at", { ascending: false })
    .limit(1);

  if (error) throw error;
  return data?.[0] ?? null;
}

export const adminRouter = Router();

adminRouter.post("/login", async (req: Request, res: Response) => {
  try {
    const ip = req.ip || req.socket.remoteAddress || "unknown";

    if (!checkRateLimit(ip)) {
      res.status(429).json({
        error: "Too many attempts. Try again in 15 minutes.",
      });
      return;
    }

    const { email, password } = req.body as { email?: string; password?: string };

    if (!email || !password) {
      res.status(400).json({ error: "Email and password required" });
      return;
    }

    const validEmail = email === config.ADMIN_EMAIL;
    const validPassword = await verifyAdminPassword(password, config.ADMIN_PASSWORD);

    if (!validEmail || !validPassword) {
      recordFailedLogin(ip);
      res.status(401).json({ error: "Invalid credentials" });
      return;
    }

    clearLoginAttempts(ip);
    const token = signAdminToken(email);

    res.json({
      token,
      expiresIn: "8h",
      email,
    });
  } catch (err) {
    logger.error("Admin login failed", {
      error: err instanceof Error ? err.message : "unknown",
    });
    res.status(500).json({ error: "Login failed" });
  }
});

adminRouter.get("/lookup", requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const email = String(req.query.email ?? "").trim();

    if (!email) {
      res.status(400).json({ error: "Email required" });
      return;
    }

    const licenses = await lookupLicensesByEmail(email);

    if (licenses.length === 0) {
      res.status(404).json({ error: "No license found for this email" });
      return;
    }

    res.json({ licenses });
  } catch (err) {
    logger.error("Lookup failed", {
      error: err instanceof Error ? err.message : "unknown",
    });
    res.status(500).json({ error: "Lookup failed" });
  }
});

adminRouter.post("/update-limit", requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const { email, newLimit } = req.body as { email?: string; newLimit?: number };

    if (!email || newLimit === undefined) {
      res.status(400).json({ error: "Email and newLimit required" });
      return;
    }

    if (newLimit < 0 || newLimit > 100_000) {
      res.status(400).json({ error: "Limit must be between 0 and 100000" });
      return;
    }

    const license = await fetchLatestLicenseByEmail(email);
    if (!license) {
      res.status(404).json({ error: "No license found for this email" });
      return;
    }

    const { error } = await supabase
      .from("license_keys")
      .update({ monthly_search_limit: newLimit })
      .eq("id", license.id as string);

    if (error) throw error;

    res.json({
      success: true,
      message: `Search limit updated to ${newLimit} for ${email}`,
    });
  } catch (err) {
    logger.error("Update limit failed", {
      error: err instanceof Error ? err.message : "unknown",
    });
    res.status(500).json({ error: "Failed to update limit" });
  }
});

adminRouter.post("/suspend", requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const { email, reason } = req.body as { email?: string; reason?: string };
    if (!email) {
      res.status(400).json({ error: "Email required" });
      return;
    }

    const license = await fetchLatestLicenseByEmail(email);
    if (!license) {
      res.status(404).json({ error: "License not found" });
      return;
    }

    const { error } = await supabase
      .from("license_keys")
      .update({
        is_suspended: true,
        suspension_reason: reason || "Suspended by admin",
      })
      .eq("id", license.id as string);

    if (error) throw error;

    res.json({ success: true, message: `Account suspended for ${email}` });
  } catch (err) {
    logger.error("Suspend failed", {
      error: err instanceof Error ? err.message : "unknown",
    });
    res.status(500).json({ error: "Failed to suspend account" });
  }
});

adminRouter.post("/unsuspend", requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const { email } = req.body as { email?: string };
    if (!email) {
      res.status(400).json({ error: "Email required" });
      return;
    }

    const license = await fetchLatestLicenseByEmail(email);
    if (!license) {
      res.status(404).json({ error: "License not found" });
      return;
    }

    const { error } = await supabase
      .from("license_keys")
      .update({ is_suspended: false, suspension_reason: null })
      .eq("id", license.id as string);

    if (error) throw error;

    res.json({ success: true, message: `Account unsuspended for ${email}` });
  } catch (err) {
    logger.error("Unsuspend failed", {
      error: err instanceof Error ? err.message : "unknown",
    });
    res.status(500).json({ error: "Failed to unsuspend account" });
  }
});

adminRouter.post("/reset-searches", requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const { email } = req.body as { email?: string };
    if (!email) {
      res.status(400).json({ error: "Email required" });
      return;
    }

    const license = await fetchLatestLicenseByEmail(email);
    if (!license) {
      res.status(404).json({ error: "License not found" });
      return;
    }

    const { error } = await supabase
      .from("license_keys")
      .update({
        search_count: 0,
        searches_used: 0,
        last_reset_at: new Date().toISOString(),
      })
      .eq("id", license.id as string);

    if (error) throw error;

    res.json({ success: true, message: `Search count reset for ${email}` });
  } catch (err) {
    logger.error("Reset searches failed", {
      error: err instanceof Error ? err.message : "unknown",
    });
    res.status(500).json({ error: "Failed to reset searches" });
  }
});

adminRouter.post("/reset-devices", requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const { email } = req.body as { email?: string };
    if (!email) {
      res.status(400).json({ error: "Email required" });
      return;
    }

    const license = await fetchLatestLicenseByEmail(email);
    if (!license) {
      res.status(404).json({ error: "License not found" });
      return;
    }

    await resetDevices(license.id as string);
    res.json({
      success: true,
      message: `Devices reset for ${email}. User can now log in from new devices.`,
    });
  } catch (err) {
    logger.error("Reset devices failed", {
      error: err instanceof Error ? err.message : "unknown",
    });
    res.status(500).json({ error: "Failed to reset devices" });
  }
});

adminRouter.post("/update-device-limit", requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const { email, maxDevices } = req.body as { email?: string; maxDevices?: number };

    if (!email || maxDevices === undefined) {
      res.status(400).json({ error: "Email and maxDevices required" });
      return;
    }

    if (maxDevices < 1 || maxDevices > 10) {
      res.status(400).json({ error: "Max devices must be between 1 and 10" });
      return;
    }

    const license = await fetchLatestLicenseByEmail(email);
    if (!license) {
      res.status(404).json({ error: "License not found" });
      return;
    }

    const { error } = await supabase
      .from("license_keys")
      .update({ max_devices: maxDevices })
      .eq("id", license.id as string);

    if (error) throw error;

    res.json({
      success: true,
      message: `Device limit updated to ${maxDevices} for ${email}`,
    });
  } catch (err) {
    logger.error("Update device limit failed", {
      error: err instanceof Error ? err.message : "unknown",
    });
    res.status(500).json({ error: "Failed to update device limit" });
  }
});

adminRouter.post("/send-message", requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const { email, subject, message } = req.body as {
      email?: string;
      subject?: string;
      message?: string;
    };

    if (!email || !subject || !message) {
      res.status(400).json({ error: "Email, subject and message required" });
      return;
    }

    await sendAdminMessage(email, subject, message);

    res.json({ success: true, message: `Message sent to ${email}` });
  } catch (err) {
    logger.error("Send message failed", {
      error: err instanceof Error ? err.message : "unknown",
    });
    res.status(500).json({ error: "Failed to send message" });
  }
});

adminRouter.post("/broadcast", requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const { subject, message } = req.body as { subject?: string; message?: string };

    if (!subject || !message) {
      res.status(400).json({ error: "Subject and message required" });
      return;
    }

    const { data: licenses, error } = await supabase
      .from("license_keys")
      .select("email")
      .eq("activated", true)
      .eq("is_suspended", false);

    if (error) throw error;

    if (!licenses || licenses.length === 0) {
      res.status(404).json({ error: "No active users found" });
      return;
    }

    const uniqueEmails = [
      ...new Set(
        licenses
          .map((l) => (l.email as string)?.toLowerCase().trim())
          .filter(Boolean)
      ),
    ];

    res.json({
      success: true,
      message: `Broadcast queued for ${uniqueEmails.length} users`,
      count: uniqueEmails.length,
    });

    setImmediate(() => {
      void (async () => {
        for (const userEmail of uniqueEmails) {
          try {
            await sendAdminMessage(userEmail, subject, message);
            await new Promise((resolve) => setTimeout(resolve, 300));
          } catch (err) {
            logger.error("Failed to send broadcast to user", {
              email: userEmail,
              error: err instanceof Error ? err.message : "unknown",
            });
          }
        }
        logger.info("Broadcast complete", { count: uniqueEmails.length });
      })();
    });
  } catch (err) {
    logger.error("Broadcast failed", {
      error: err instanceof Error ? err.message : "unknown",
    });
    res.status(500).json({ error: "Failed to send broadcast" });
  }
});

adminRouter.post("/generate-access", requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const { email } = req.body as { email?: string };
    if (!email) {
      res.status(400).json({ error: "Email required" });
      return;
    }

    const licenseKey = await createLicenseKey({
      email,
      paymentChannel: "bank_transfer",
      paymentReference: `manual-${Date.now()}`,
    });

    await sendActivationEmail(email, licenseKey.key);

    res.json({
      success: true,
      email: licenseKey.email,
      key: licenseKey.key,
      message: `Activation email sent to ${email}`,
    });
  } catch (err) {
    logger.error("Generate access failed", {
      error: err instanceof Error ? err.message : "unknown",
    });
    res.status(500).json({ error: "Failed to generate access" });
  }
});

adminRouter.post("/resend-access", requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const { email } = req.body as { email?: string };
    if (!email) {
      res.status(400).json({ error: "Email required" });
      return;
    }

    const data = await fetchLatestLicenseByEmail(email);

    if (!data) {
      res.status(404).json({ error: "No license key found for this email" });
      return;
    }

    await sendActivationEmail(email.toLowerCase().trim(), data.key as string);

    res.json({
      success: true,
      message: `Activation email resent to ${email}`,
    });
  } catch (err) {
    logger.error("Resend access failed", {
      error: err instanceof Error ? err.message : "unknown",
    });
    res.status(500).json({ error: "Failed to resend access" });
  }
});

adminRouter.get("/licenses", requireAdminAuth, async (_req: Request, res: Response) => {
  try {
    const licenses = await listRecentLicenses(50);
    const safe = licenses.map((row) => ({
      ...row,
      key: truncateLicenseKey(row.key),
      key_full_available: false,
    }));

    res.json({ licenses: safe });
  } catch (err) {
    logger.error("Get licenses failed", {
      error: err instanceof Error ? err.message : "unknown",
    });
    res.status(500).json({ error: "Failed to fetch licenses" });
  }
});

adminRouter.get("/stats", requireAdminAuth, async (_req: Request, res: Response) => {
  try {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [licensesResult, searchesResult, activatedResult, todayResult] =
      await Promise.all([
        supabase.from("license_keys").select("*", { count: "exact", head: true }),
        supabase.from("search_jobs").select("*", { count: "exact", head: true }),
        supabase
          .from("license_keys")
          .select("*", { count: "exact", head: true })
          .eq("activated", true),
        supabase
          .from("license_keys")
          .select("*", { count: "exact", head: true })
          .gte("created_at", todayStart.toISOString()),
      ]);

    res.json({
      totalLicenses: licensesResult.count ?? 0,
      activatedLicenses: activatedResult.count ?? 0,
      totalSearches: searchesResult.count ?? 0,
      licensesToday: todayResult.count ?? 0,
    });
  } catch (err) {
    logger.error("Get stats failed", {
      error: err instanceof Error ? err.message : "unknown",
    });
    res.status(500).json({ error: "Failed to fetch stats" });
  }
});
