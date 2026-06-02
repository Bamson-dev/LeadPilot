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
import {
  sendActivationEmail,
  sendDirectMessageEmail,
  sendPayoutPaidEmail,
} from "../services/brevo-service";
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
    const { mode, recipient, subject, body } = req.body as {
      mode?: string;
      recipient?: string;
      subject?: string;
      body?: string;
    };

    if (!subject || !body) {
      res.status(400).json({ error: "Subject and body are required" });
      return;
    }

    if (mode === "broadcast") {
      const { data: users, error } = await supabase
        .from("license_keys")
        .select("email")
        .eq("activated", true);

      if (error) throw error;

      if (!users || users.length === 0) {
        res.status(404).json({ error: "No active users found" });
        return;
      }

      let sent = 0;
      let failed = 0;

      for (const user of users) {
        try {
          await sendDirectMessageEmail(user.email as string, subject, body);
          sent++;
          await new Promise((resolve) => setTimeout(resolve, 150));
        } catch {
          failed++;
        }
      }

      res.json({
        success: true,
        message: `Sent to ${sent} users.${failed > 0 ? ` ${failed} failed.` : ""}`,
      });
      return;
    }

    if (!recipient) {
      res.status(400).json({ error: "Recipient email is required" });
      return;
    }

    await sendDirectMessageEmail(recipient, subject, body);

    logger.info("Direct message sent by admin", { recipient, subject });

    res.json({
      success: true,
      message: `Message sent successfully to ${recipient}`,
    });
  } catch (err) {
    logger.error("Failed to send direct message", {
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
            await sendDirectMessageEmail(userEmail, subject, message);
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

adminRouter.get("/overview", requireAdminAuth, async (_req: Request, res: Response) => {
  try {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - 7);

    const [
      totalUsersResult,
      activeUsersResult,
      suspendedUsersResult,
      newUsersTodayResult,
      newUsersThisWeekResult,
      totalSearchesResult,
      totalTrialSearchesResult,
    ] = await Promise.all([
      supabase
        .from("license_keys")
        .select("*", { count: "exact", head: true })
        .eq("activated", true),
      supabase
        .from("license_keys")
        .select("*", { count: "exact", head: true })
        .eq("activated", true)
        .eq("is_suspended", false),
      supabase
        .from("license_keys")
        .select("*", { count: "exact", head: true })
        .eq("is_suspended", true),
      supabase
        .from("license_keys")
        .select("*", { count: "exact", head: true })
        .eq("activated", true)
        .gte("created_at", todayStart.toISOString()),
      supabase
        .from("license_keys")
        .select("*", { count: "exact", head: true })
        .eq("activated", true)
        .gte("created_at", weekStart.toISOString()),
      supabase
        .from("search_jobs")
        .select("*", { count: "exact", head: true })
        .eq("is_trial", false),
      supabase
        .from("search_jobs")
        .select("*", { count: "exact", head: true })
        .eq("is_trial", true),
    ]);

    const totalUsers = totalUsersResult.count ?? 0;
    const estimatedRevenue = totalUsers * 15000;

    res.json({
      totalUsers,
      activeUsers: activeUsersResult.count ?? 0,
      suspendedUsers: suspendedUsersResult.count ?? 0,
      newUsersToday: newUsersTodayResult.count ?? 0,
      newUsersThisWeek: newUsersThisWeekResult.count ?? 0,
      totalSearches: totalSearchesResult.count ?? 0,
      totalTrialSearches: totalTrialSearchesResult.count ?? 0,
      estimatedRevenue,
    });
  } catch (err) {
    logger.error("Admin overview failed", {
      error: err instanceof Error ? err.message : "unknown",
    });
    res.status(500).json({ error: "Failed to fetch overview" });
  }
});

// GET /admin/activations
adminRouter.get("/activations", requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const { from, to, preset } = req.query;

    let startDate: string;
    let endDate: string;

    const now = new Date();

    if (preset) {
      switch (preset) {
        case "today":
          startDate = new Date(now.setHours(0, 0, 0, 0)).toISOString();
          endDate = new Date().toISOString();
          break;
        case "yesterday": {
          const yesterday = new Date(now);
          yesterday.setDate(yesterday.getDate() - 1);
          startDate = new Date(yesterday.setHours(0, 0, 0, 0)).toISOString();
          endDate = new Date(yesterday.setHours(23, 59, 59, 999)).toISOString();
          break;
        }
        case "7days": {
          const sevenDaysAgo = new Date(now);
          sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
          startDate = new Date(sevenDaysAgo.setHours(0, 0, 0, 0)).toISOString();
          endDate = new Date().toISOString();
          break;
        }
        case "14days": {
          const fourteenDaysAgo = new Date(now);
          fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);
          startDate = new Date(fourteenDaysAgo.setHours(0, 0, 0, 0)).toISOString();
          endDate = new Date().toISOString();
          break;
        }
        case "30days": {
          const thirtyDaysAgo = new Date(now);
          thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
          startDate = new Date(thirtyDaysAgo.setHours(0, 0, 0, 0)).toISOString();
          endDate = new Date().toISOString();
          break;
        }
        case "thismonth":
          startDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
          endDate = new Date().toISOString();
          break;
        default:
          startDate = new Date(now.setHours(0, 0, 0, 0)).toISOString();
          endDate = new Date().toISOString();
      }
    } else if (from && to) {
      startDate = new Date(from as string).toISOString();
      endDate = new Date(to as string).toISOString();
    } else {
      const sevenDaysAgo = new Date(now);
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      startDate = new Date(sevenDaysAgo.setHours(0, 0, 0, 0)).toISOString();
      endDate = new Date().toISOString();
    }

    const { data, error } = await supabase
      .from("license_keys")
      .select("created_at, email")
      .eq("activated", true)
      .gte("created_at", startDate)
      .lte("created_at", endDate)
      .order("created_at", { ascending: true });

    if (error) throw error;

    const total = data?.length || 0;

    const dailyMap: Record<string, number> = {};

    data?.forEach((row) => {
      const day = new Date(row.created_at as string).toISOString().split("T")[0];
      dailyMap[day] = (dailyMap[day] || 0) + 1;
    });

    const daily = Object.entries(dailyMap).map(([date, count]) => ({
      date,
      count,
      label: new Date(date).toLocaleDateString("en-GB", {
        weekday: "short",
        day: "numeric",
        month: "short",
      }),
    }));

    const peak = daily.reduce((max, day) => (day.count > max ? day.count : max), 0);

    const average = daily.length > 0 ? Math.round(total / daily.length) : 0;

    logger.info("Activations fetched", { total, from: startDate, to: endDate });

    res.json({
      total,
      daily,
      peak,
      average,
      from: startDate,
      to: endDate,
      days: daily.length,
    });
  } catch (err) {
    logger.error("Failed to fetch activations", {
      error: err instanceof Error ? err.message : "unknown",
    });
    res.status(500).json({ error: "Failed to fetch activations" });
  }
});

adminRouter.get("/recent-users", requireAdminAuth, async (_req: Request, res: Response) => {
  try {
    const { data: users, error } = await supabase
      .from("license_keys")
      .select("email, activated, is_suspended, created_at, searches_used, max_devices")
      .order("created_at", { ascending: false })
      .limit(10);

    if (error) throw error;

    res.json({ users: users ?? [] });
  } catch (err) {
    logger.error("Recent users failed", {
      error: err instanceof Error ? err.message : "unknown",
    });
    res.status(500).json({ error: "Failed to fetch recent users" });
  }
});

adminRouter.get("/trial-stats", requireAdminAuth, async (_req: Request, res: Response) => {
  try {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - 7);

    const monthStart = new Date();
    monthStart.setDate(monthStart.getDate() - 30);

    const [
      totalTrialsResult,
      trialsTodayResult,
      trialsThisWeekResult,
      trialsThisMonthResult,
      licensesTodayResult,
      licensesThisWeekResult,
    ] = await Promise.all([
      supabase
        .from("search_jobs")
        .select("*", { count: "exact", head: true })
        .eq("is_trial", true),
      supabase
        .from("search_jobs")
        .select("*", { count: "exact", head: true })
        .eq("is_trial", true)
        .gte("created_at", todayStart.toISOString()),
      supabase
        .from("search_jobs")
        .select("*", { count: "exact", head: true })
        .eq("is_trial", true)
        .gte("created_at", weekStart.toISOString()),
      supabase
        .from("search_jobs")
        .select("*", { count: "exact", head: true })
        .eq("is_trial", true)
        .gte("created_at", monthStart.toISOString()),
      supabase
        .from("license_keys")
        .select("*", { count: "exact", head: true })
        .gte("created_at", todayStart.toISOString()),
      supabase
        .from("license_keys")
        .select("*", { count: "exact", head: true })
        .gte("created_at", weekStart.toISOString()),
    ]);

    const trialsThisWeek = trialsThisWeekResult.count ?? 0;
    const licensesThisWeek = licensesThisWeekResult.count ?? 0;
    const conversionRate =
      trialsThisWeek > 0 && licensesThisWeek > 0
        ? ((licensesThisWeek / trialsThisWeek) * 100).toFixed(1)
        : "0";

    res.json({
      totalTrials: totalTrialsResult.count ?? 0,
      trialsToday: trialsTodayResult.count ?? 0,
      trialsThisWeek,
      trialsThisMonth: trialsThisMonthResult.count ?? 0,
      licensesToday: licensesTodayResult.count ?? 0,
      licensesThisWeek,
      conversionRate,
    });
  } catch (err) {
    logger.error("Trial stats failed", {
      error: err instanceof Error ? err.message : "unknown",
    });
    res.status(500).json({ error: "Failed to fetch trial stats" });
  }
});

adminRouter.get("/payouts", requireAdminAuth, async (_req: Request, res: Response) => {
  try {
    const { data: payouts, error } = await supabase
      .from("payout_requests")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;

    res.json({ payouts: payouts ?? [] });
  } catch (err) {
    logger.error("Failed to fetch payouts", {
      error: err instanceof Error ? err.message : "unknown",
    });
    res.status(500).json({ error: "Failed to fetch payouts" });
  }
});

adminRouter.post("/payouts/:id/processing", requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const { error } = await supabase
      .from("payout_requests")
      .update({ status: "processing" })
      .eq("id", id);

    if (error) throw error;

    res.json({ success: true, message: "Payout marked as processing" });
  } catch (err) {
    logger.error("Failed to mark payout as processing", {
      error: err instanceof Error ? err.message : "unknown",
    });
    res.status(500).json({ error: "Failed to update payout status" });
  }
});

adminRouter.post("/payouts/:id/pay", requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const { data: payout, error } = await supabase
      .from("payout_requests")
      .select("*")
      .eq("id", id)
      .single();

    if (error || !payout) {
      res.status(404).json({ error: "Payout request not found" });
      return;
    }

    if (payout.status === "paid") {
      res.status(400).json({ error: "Payout already marked as paid" });
      return;
    }

    await supabase
      .from("payout_requests")
      .update({
        status: "paid",
        paid_at: new Date().toISOString(),
      })
      .eq("id", id);

    const { data: license } = await supabase
      .from("license_keys")
      .select("total_paid_ngn")
      .eq("email", payout.referrer_email as string)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    await supabase
      .from("license_keys")
      .update({
        total_paid_ngn:
          ((license?.total_paid_ngn as number) || 0) + (payout.amount_ngn as number),
      })
      .eq("email", payout.referrer_email as string);

    try {
      await sendPayoutPaidEmail(
        payout.referrer_email as string,
        payout.amount_ngn as number,
        payout.amount_usd as number,
        payout.account_name as string,
        payout.bank_name as string,
        payout.account_number as string
      );
      logger.info("Payout confirmation email sent", {
        email: payout.referrer_email,
      });
    } catch (err) {
      logger.error("Failed to send payout confirmation email", {
        error: err instanceof Error ? err.message : "unknown",
      });
    }

    logger.info("Payout marked as paid", {
      payoutId: id,
      referrer: payout.referrer_email,
      amount: payout.amount_ngn,
    });

    res.json({
      success: true,
      message: `Payout of ₦${(payout.amount_ngn as number).toLocaleString()} marked as paid for ${payout.referrer_email}. Remember to complete the bank transfer manually.`,
    });
  } catch (err) {
    logger.error("Failed to process payout", {
      error: err instanceof Error ? err.message : "unknown",
    });
    res.status(500).json({ error: "Failed to process payout" });
  }
});

adminRouter.get("/trial-activity", requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const limit = Math.min(Math.max(parseInt(String(req.query.limit ?? "50"), 10) || 50, 1), 100);
    const offset = Math.max(parseInt(String(req.query.offset ?? "0"), 10) || 0, 0);

    const monthAgo = new Date();
    monthAgo.setDate(monthAgo.getDate() - 30);

    const [{ data: recentTrials }, { data: allTrials }] = await Promise.all([
      supabase
        .from("search_jobs")
        .select("id, query, location, total_found, status, created_at")
        .eq("is_trial", true)
        .order("created_at", { ascending: false })
        .range(offset, offset + limit - 1),
      supabase
        .from("search_jobs")
        .select("query, location, created_at")
        .eq("is_trial", true)
        .gte("created_at", monthAgo.toISOString()),
    ]);

    const queryCount: Record<string, number> = {};
    allTrials?.forEach((t) => {
      const query = (t.query as string | null)?.trim() ?? "";
      const location = (t.location as string | null)?.trim() ?? "";
      if (!query && !location) return;
      const key = `${query.toLowerCase()} in ${location.toLowerCase()}`;
      queryCount[key] = (queryCount[key] || 0) + 1;
    });

    const topQueries = Object.entries(queryCount)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([query, count]) => ({ query, count }));

    const dailyCounts: Record<string, number> = {};
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const key = date.toISOString().split("T")[0];
      dailyCounts[key] = 0;
    }

    allTrials?.forEach((t) => {
      if (!t.created_at) return;
      const day = new Date(t.created_at as string).toISOString().split("T")[0];
      if (dailyCounts[day] !== undefined) {
        dailyCounts[day]++;
      }
    });

    const dailyActivity = Object.entries(dailyCounts).map(([date, count]) => ({
      date,
      count,
    }));

    res.json({
      recentTrials: recentTrials ?? [],
      topQueries,
      dailyActivity,
    });
  } catch (err) {
    logger.error("Trial activity failed", {
      error: err instanceof Error ? err.message : "unknown",
    });
    res.status(500).json({ error: "Failed to fetch trial activity" });
  }
});
