import { Router, type Request, type Response } from "express";
import multer from "multer";
import bcrypt from "bcryptjs";
import { config } from "../config/env";
import { requireAdminAuth } from "../middleware/admin-auth";
import { signAdminToken } from "../utils/jwt";
import {
  createLicenseKey,
  listRecentLicenses,
  lookupLicensesByEmail,
  truncateLicenseKey,
} from "../database/license-repository";
import { supabase } from "../database/client";
import {
  sendAccessEmail,
  sendDirectEmailHtml,
  sendDirectMessageEmail,
  sendPayoutPaidEmail,
} from "../services/email";
import { SALE_PRICE_NGN } from "../constants/pricing";
import { logger } from "../utils/logger";

const loginAttempts = new Map<string, { count: number; resetAt: number }>();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 },
});

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
    const { email, newLimit: rawLimit } = req.body as {
      email?: string;
      newLimit?: number | string;
    };

    if (!email?.trim()) {
      res.status(400).json({ error: "Email is required" });
      return;
    }

    if (rawLimit === undefined || rawLimit === null || rawLimit === "") {
      res.status(400).json({ error: "newLimit is required" });
      return;
    }

    const newLimit = parseInt(String(rawLimit), 10);
    if (Number.isNaN(newLimit) || newLimit < 0 || newLimit > 100_000) {
      res.status(400).json({ error: "Limit must be between 0 and 100000" });
      return;
    }

    const normalizedEmail = email.toLowerCase().trim();
    const license = await fetchLatestLicenseByEmail(normalizedEmail);
    if (!license) {
      res.status(404).json({ error: `No license found for ${email}` });
      return;
    }

    const { error } = await supabase
      .from("license_keys")
      .update({ monthly_search_limit: newLimit })
      .eq("id", license.id as string);

    if (error) {
      logger.error("Update search limit failed", {
        error: error.message,
        email: normalizedEmail,
      });
      res.status(500).json({ error: "Failed to update limit in database" });
      return;
    }

    logger.info("Search limit updated by admin", { email: normalizedEmail, newLimit });

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
      res.status(400).json({ error: "Email is required" });
      return;
    }

    const normalizedEmail = email.toLowerCase().trim();
    const license = await fetchLatestLicenseByEmail(normalizedEmail);

    if (!license) {
      res.status(404).json({ error: `No license found for ${email}` });
      return;
    }

    const { error: updateError } = await supabase
      .from("license_keys")
      .update({
        device_one: null,
        device_two: null,
        device_three: null,
        device_four: null,
      })
      .eq("id", license.id as string);

    if (updateError) {
      logger.error("Failed to reset devices", {
        error: updateError.message,
        email: normalizedEmail,
      });
      res.status(500).json({ error: "Failed to reset devices in database" });
      return;
    }

    logger.info("Devices reset successfully by admin", { email: normalizedEmail });

    res.json({
      success: true,
      message: `All devices reset for ${email}. They can now log in from up to ${(license.max_devices as number) || 4} new devices.`,
    });
  } catch (err) {
    logger.error("Reset devices endpoint error", {
      error: err instanceof Error ? err.message : "unknown",
    });
    res.status(500).json({ error: "Internal server error" });
  }
});

adminRouter.post("/upgrade-devices", requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const { email, maxDevices } = req.body as { email?: string; maxDevices?: number | string };

    if (!email || maxDevices === undefined || maxDevices === null || maxDevices === "") {
      res.status(400).json({ error: "Email and maxDevices are required" });
      return;
    }

    const newLimit = parseInt(String(maxDevices), 10);
    if (Number.isNaN(newLimit) || newLimit < 1 || newLimit > 20) {
      res.status(400).json({ error: "maxDevices must be between 1 and 20" });
      return;
    }

    const normalizedEmail = email.toLowerCase().trim();
    const license = await fetchLatestLicenseByEmail(normalizedEmail);

    if (!license) {
      res.status(404).json({ error: `No license found for ${email}` });
      return;
    }

    const { error: updateError } = await supabase
      .from("license_keys")
      .update({ max_devices: newLimit })
      .eq("id", license.id as string);

    if (updateError) {
      logger.error("Failed to upgrade devices", {
        error: updateError.message,
        email: normalizedEmail,
      });
      res.status(500).json({ error: "Failed to update device limit" });
      return;
    }

    logger.info("Device limit upgraded by admin", { email: normalizedEmail, newLimit });

    res.json({
      success: true,
      message: `Device limit updated to ${newLimit} for ${email}.`,
    });
  } catch (err) {
    logger.error("Upgrade devices endpoint error", {
      error: err instanceof Error ? err.message : "unknown",
    });
    res.status(500).json({ error: "Internal server error" });
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

function buildRichDirectEmailHtml(htmlBody: string): string {
  return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width,initial-scale=1">
      </head>
      <body style="margin:0;padding:0;background:#f4f4f4;font-family:Inter,Arial,sans-serif;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f4;padding:40px 20px;">
          <tr><td align="center">
            <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:white;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.08);">
              <tr><td style="background:#7C3AED;padding:24px 32px;">
                <table cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="width:44px;height:44px;background:rgba(255,255,255,0.15);border-radius:9px;text-align:center;vertical-align:middle;">
                      <span style="font-size:13px;font-weight:800;color:white;line-height:44px;">LT</span>
                    </td>
                    <td style="padding-left:12px;">
                      <div style="font-size:20px;font-weight:800;color:white;line-height:1;">LeadThur</div>
                      <div style="font-size:10px;color:rgba(255,255,255,0.7);letter-spacing:0.12em;text-transform:uppercase;margin-top:2px;">Business Discovery</div>
                    </td>
                  </tr>
                </table>
              </td></tr>
              <tr><td style="padding:36px 32px;">
                ${htmlBody}
              </td></tr>
              <tr><td style="padding:20px 32px;background:#f9fafb;border-top:1px solid #e5e7eb;">
                <p style="margin:0;font-size:12px;color:#9ca3af;text-align:center;line-height:1.6;">
                  This message was sent from the LeadThur team.<br/>
                  Questions? WhatsApp <strong style="color:#374151;">09067285890</strong>
                  or email <strong style="color:#374151;">support@leadthur.com</strong>
                </p>
              </td></tr>
            </table>
          </td></tr>
        </table>
      </body>
      </html>
    `;
}

function hasHtmlContent(htmlBody: string): boolean {
  return htmlBody.replace(/<[^>]*>/g, "").trim().length > 0;
}

function personalizeMessageContent(text: string, email: string): string {
  const localPart = email.split("@")[0] ?? "there";
  const nameSegment = localPart.split(/[._-]/)[0] ?? localPart;
  const firstName =
    nameSegment.length > 0
      ? nameSegment.charAt(0).toUpperCase() + nameSegment.slice(1).toLowerCase()
      : "there";
  const dashboardUrl = `${config.FRONTEND_URL.replace(/\/$/, "")}/dashboard`;

  return text
    .replace(/\{\{firstName\}\}/g, firstName)
    .replace(/\{\{email\}\}/g, email)
    .replace(/\{\{dashboardUrl\}\}/g, dashboardUrl);
}

adminRouter.post("/send-message", requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const { email, subject, htmlBody } = req.body as {
      email?: string;
      subject?: string;
      htmlBody?: string;
    };

    if (!subject?.trim() || !htmlBody?.trim()) {
      res.status(400).json({ error: "Subject and htmlBody are required" });
      return;
    }

    if (!hasHtmlContent(htmlBody)) {
      res.status(400).json({ error: "Subject and htmlBody are required" });
      return;
    }

    if (!email?.trim()) {
      res.status(400).json({ error: "Recipient email is required for single send" });
      return;
    }

    const recipient = email.trim();
    const personalizedBody = personalizeMessageContent(htmlBody, recipient);
    const personalizedSubject = personalizeMessageContent(subject.trim(), recipient);
    const fullHtml = buildRichDirectEmailHtml(personalizedBody);

    await sendDirectEmailHtml({
      to: recipient,
      subject: personalizedSubject,
      html: fullHtml,
    });

    logger.info("Direct message sent", { email: recipient, subject: personalizedSubject });
    res.json({ success: true });
  } catch (err) {
    logger.error("Failed to send direct message", {
      error: err instanceof Error ? err.message : "unknown",
    });
    res.status(500).json({ error: "Failed to send message" });
  }
});

adminRouter.post("/broadcast-message", requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const { subject, htmlBody } = req.body as {
      subject?: string;
      htmlBody?: string;
    };

    if (!subject?.trim() || !htmlBody?.trim()) {
      res.status(400).json({ error: "Subject and htmlBody are required" });
      return;
    }

    if (!hasHtmlContent(htmlBody)) {
      res.status(400).json({ error: "Subject and htmlBody are required" });
      return;
    }

    const { data: users, error } = await supabase
      .from("license_keys")
      .select("email")
      .eq("activated", true);

    if (error) throw error;

    if (!users || users.length === 0) {
      res.status(404).json({ error: "No active users found" });
      return;
    }

    const uniqueEmails = [
      ...new Set(
        users
          .map((user) => (user.email as string)?.toLowerCase().trim())
          .filter(Boolean)
      ),
    ];

    let sent = 0;
    let failed = 0;

    for (const userEmail of uniqueEmails) {
      try {
        const personalizedBody = personalizeMessageContent(htmlBody, userEmail);
        const personalizedSubject = personalizeMessageContent(subject.trim(), userEmail);
        const fullHtml = buildRichDirectEmailHtml(personalizedBody);

        await sendDirectEmailHtml({
          to: userEmail,
          subject: personalizedSubject,
          html: fullHtml,
        });
        sent++;
        await new Promise((resolve) => setTimeout(resolve, 150));
      } catch {
        failed++;
      }
    }

    logger.info("Broadcast message sent", { sent, failed, total: uniqueEmails.length });

    res.json({
      success: true,
      message: `Sent to ${sent} users.${failed > 0 ? ` ${failed} failed.` : ""}`,
    });
  } catch (err) {
    logger.error("Failed to send broadcast message", {
      error: err instanceof Error ? err.message : "unknown",
    });
    res.status(500).json({ error: "Failed to send broadcast" });
  }
});

async function handleAdminImageUpload(req: Request, res: Response): Promise<void> {
  try {
    if (!req.file) {
      res.status(400).json({ error: "No image file provided" });
      return;
    }

    const allowedTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"];
    if (!allowedTypes.includes(req.file.mimetype)) {
      res.status(400).json({ error: "Only JPEG, PNG, GIF and WebP images are allowed" });
      return;
    }

    const base64 = req.file.buffer.toString("base64");
    const dataUrl = `data:${req.file.mimetype};base64,${base64}`;

    logger.info("Image uploaded", {
      size: req.file.size,
      type: req.file.mimetype,
    });

    res.json({
      success: true,
      url: dataUrl,
      filename: req.file.originalname,
      size: req.file.size,
    });
  } catch (err) {
    logger.error("Image upload failed", {
      error: err instanceof Error ? err.message : "unknown",
    });
    res.status(500).json({ error: "Image upload failed" });
  }
}

adminRouter.post(
  "/upload-image",
  requireAdminAuth,
  upload.single("image"),
  handleAdminImageUpload
);

adminRouter.post(
  "/blog/upload-image",
  requireAdminAuth,
  upload.single("image"),
  handleAdminImageUpload
);

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

    await sendAccessEmail(email, licenseKey.key);

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

    await sendAccessEmail(email.toLowerCase().trim(), data.key as string);

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
    const estimatedRevenue = totalUsers * SALE_PRICE_NGN;

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

// GET /admin/activations
adminRouter.get("/activations", requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const { from, to, preset } = req.query as {
      from?: string;
      to?: string;
      preset?: string;
    };

    let startDate: string;
    let endDate: string;

    if (from && to) {
      startDate = new Date(from).toISOString();
      endDate = new Date(to).toISOString();
    } else {
      const presetValue = (preset as string) || "today";

      switch (presetValue) {
        case "today": {
          const start = new Date();
          start.setUTCHours(0, 0, 0, 0);
          startDate = start.toISOString();
          endDate = new Date().toISOString();
          break;
        }
        case "yesterday": {
          const start = new Date();
          start.setUTCDate(start.getUTCDate() - 1);
          start.setUTCHours(0, 0, 0, 0);
          const end = new Date();
          end.setUTCDate(end.getUTCDate() - 1);
          end.setUTCHours(23, 59, 59, 999);
          startDate = start.toISOString();
          endDate = end.toISOString();
          break;
        }
        case "7days": {
          const start = new Date();
          start.setUTCDate(start.getUTCDate() - 7);
          start.setUTCHours(0, 0, 0, 0);
          startDate = start.toISOString();
          endDate = new Date().toISOString();
          break;
        }
        case "14days": {
          const start = new Date();
          start.setUTCDate(start.getUTCDate() - 14);
          start.setUTCHours(0, 0, 0, 0);
          startDate = start.toISOString();
          endDate = new Date().toISOString();
          break;
        }
        case "30days": {
          const start = new Date();
          start.setUTCDate(start.getUTCDate() - 30);
          start.setUTCHours(0, 0, 0, 0);
          startDate = start.toISOString();
          endDate = new Date().toISOString();
          break;
        }
        case "thismonth": {
          const start = new Date();
          start.setUTCDate(1);
          start.setUTCHours(0, 0, 0, 0);
          startDate = start.toISOString();
          endDate = new Date().toISOString();
          break;
        }
        default: {
          const start = new Date();
          start.setUTCHours(0, 0, 0, 0);
          startDate = start.toISOString();
          endDate = new Date().toISOString();
        }
      }
    }

    logger.info("Activations query range", {
      preset,
      startDate,
      endDate,
    });

    const { data, error } = await supabase
      .from("license_keys")
      .select("created_at, email")
      .eq("activated", true)
      .gte("created_at", startDate)
      .lte("created_at", endDate)
      .order("created_at", { ascending: true });

    if (error) {
      logger.error("Activations query error", {
        error: error.message,
      });
      throw error;
    }

    logger.info("Activations query result", {
      totalFound: data?.length || 0,
      startDate,
      endDate,
    });

    const total = data?.length || 0;

    const dailyMap: Record<string, number> = {};
    data?.forEach((row) => {
      const day = new Date(row.created_at as string).toISOString().split("T")[0];
      dailyMap[day] = (dailyMap[day] || 0) + 1;
    });

    const daily = Object.entries(dailyMap).map(([date, count]) => ({
      date,
      count,
      label: new Date(`${date}T12:00:00Z`).toLocaleDateString("en-GB", {
        weekday: "short",
        day: "numeric",
        month: "short",
      }),
    }));

    const peak = daily.reduce((max, day) => (day.count > max ? day.count : max), 0);
    const average = daily.length > 0 ? Math.round(total / daily.length) : 0;

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

adminRouter.get("/site-settings", requireAdminAuth, async (_req: Request, res: Response) => {
  try {
    const { data, error } = await supabase
      .from("site_settings")
      .select("id, value")
      .in("id", ["head_scripts", "body_scripts"]);

    if (error) throw error;

    const settings: Record<string, string> = {};
    data?.forEach((row) => {
      settings[row.id as string] = row.value as string;
    });

    res.json({
      headScripts: settings["head_scripts"] || "",
      bodyScripts: settings["body_scripts"] || "",
    });
  } catch (err) {
    logger.error("Failed to fetch site settings", {
      error: err instanceof Error ? err.message : "unknown",
    });
    res.status(500).json({ error: "Failed to fetch site settings" });
  }
});

adminRouter.post("/site-settings", requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const { headScripts, bodyScripts } = req.body as {
      headScripts?: string;
      bodyScripts?: string;
    };

    const { error } = await supabase.from("site_settings").upsert([
      { id: "head_scripts", value: headScripts || "", updated_at: new Date().toISOString() },
      { id: "body_scripts", value: bodyScripts || "", updated_at: new Date().toISOString() },
    ]);
    if (error) throw error;

    logger.info("Site settings updated");
    res.json({ success: true, message: "Scripts saved successfully" });
  } catch (err) {
    logger.error("Failed to save site settings", {
      error: err instanceof Error ? err.message : "unknown",
    });
    res.status(500).json({ error: "Failed to save site settings" });
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

adminRouter.get("/blog/posts", requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const { status, limit = "50", offset = "0" } = req.query;

    let query = supabase
      .from("blog_posts")
      .select(
        "id, title, slug, excerpt, category, tags, status, featured, read_time, published_at, created_at, updated_at"
      )
      .order("created_at", { ascending: false })
      .range(Number(offset), Number(offset) + Number(limit) - 1);

    if (status) {
      query = query.eq("status", status);
    }

    const { data, error } = await query;
    if (error) throw error;

    res.json({ posts: data, total: data?.length || 0 });
  } catch (err) {
    logger.error("Failed to fetch blog posts", {
      error: err instanceof Error ? err.message : "unknown",
    });
    res.status(500).json({ error: "Failed to fetch blog posts" });
  }
});

adminRouter.get("/blog/posts/:id", requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabase
      .from("blog_posts")
      .select("*")
      .eq("id", id)
      .single();

    if (error) throw error;
    if (!data) {
      res.status(404).json({ error: "Post not found" });
      return;
    }

    res.json(data);
  } catch (err) {
    logger.error("Failed to fetch blog post", {
      error: err instanceof Error ? err.message : "unknown",
    });
    res.status(500).json({ error: "Failed to fetch blog post" });
  }
});

adminRouter.post("/blog/posts", requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const {
      title,
      slug,
      excerpt,
      content,
      cover_image,
      author,
      author_title,
      category,
      tags,
      meta_title,
      meta_description,
      status,
      featured,
      read_time,
    } = req.body as {
      title?: string;
      slug?: string;
      excerpt?: string;
      content?: string;
      cover_image?: string;
      author?: string;
      author_title?: string;
      category?: string;
      tags?: string[];
      meta_title?: string;
      meta_description?: string;
      status?: string;
      featured?: boolean;
      read_time?: number;
    };

    if (!title || !slug || !content) {
      res.status(400).json({ error: "Title, slug and content are required" });
      return;
    }

    const now = new Date().toISOString();
    const postStatus = status || "draft";
    const normalizedSlug = slug
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, "-")
      .replace(/-+/g, "-");

    const { data, error } = await supabase
      .from("blog_posts")
      .insert({
        title,
        slug: normalizedSlug,
        excerpt,
        content,
        cover_image,
        author: author || "Bamidele Matthew",
        author_title: author_title || "Founder, LeadThur",
        category,
        tags: tags || [],
        meta_title: meta_title || title,
        meta_description: meta_description || excerpt,
        status: postStatus,
        featured: featured || false,
        read_time: read_time || Math.ceil(content.split(" ").length / 200),
        published_at: postStatus === "published" ? now : null,
        created_at: now,
        updated_at: now,
      })
      .select()
      .single();

    if (error) {
      logger.error("Failed to create blog post", { error: error.message, code: error.code });
      res.status(500).json({ error: error.message || "Failed to create blog post" });
      return;
    }

    logger.info("Blog post created", { slug: normalizedSlug, status });
    res.json({ success: true, post: data });
  } catch (err) {
    logger.error("Failed to create blog post", {
      error: err instanceof Error ? err.message : "unknown",
    });
    res.status(500).json({
      error: err instanceof Error ? err.message : "Failed to create blog post",
    });
  }
});

adminRouter.put("/blog/posts/:id", requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const body = req.body as Record<string, unknown>;
    const allowedFields = [
      "title",
      "slug",
      "excerpt",
      "content",
      "cover_image",
      "category",
      "tags",
      "meta_title",
      "meta_description",
      "status",
      "featured",
      "read_time",
      "published_at",
    ] as const;

    const updates: Record<string, unknown> = {};
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updates[field] = body[field];
      }
    }

    const now = new Date().toISOString();

    const { data: existing, error: fetchError } = await supabase
      .from("blog_posts")
      .select("published_at")
      .eq("id", id)
      .single();

    if (fetchError) {
      res.status(404).json({ error: fetchError.message || "Post not found" });
      return;
    }

    if (typeof updates.slug === "string") {
      updates.slug = updates.slug
        .toLowerCase()
        .replace(/[^a-z0-9-]/g, "-")
        .replace(/-+/g, "-");
    }

    if (updates.status === "published" && !existing.published_at) {
      updates.published_at = now;
    } else {
      delete updates.published_at;
    }

    if (typeof updates.content === "string" && !updates.read_time) {
      updates.read_time = Math.ceil(updates.content.split(" ").length / 200);
    }

    if (updates.title && !updates.meta_title) {
      updates.meta_title = updates.title;
    }

    updates.updated_at = now;
    delete updates.id;

    const { data, error } = await supabase
      .from("blog_posts")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      logger.error("Failed to update blog post", { error: error.message, code: error.code });
      res.status(500).json({ error: error.message || "Failed to update blog post" });
      return;
    }

    logger.info("Blog post updated", { id, status: updates.status });
    res.json({ success: true, post: data });
  } catch (err) {
    logger.error("Failed to update blog post", {
      error: err instanceof Error ? err.message : "unknown",
    });
    res.status(500).json({
      error: err instanceof Error ? err.message : "Failed to update blog post",
    });
  }
});

adminRouter.delete("/blog/posts/:id", requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const { error } = await supabase.from("blog_posts").delete().eq("id", id);

    if (error) throw error;

    logger.info("Blog post deleted", { id });
    res.json({ success: true });
  } catch (err) {
    logger.error("Failed to delete blog post", {
      error: err instanceof Error ? err.message : "unknown",
    });
    res.status(500).json({ error: "Failed to delete blog post" });
  }
});

// Staging/local only — auto-enabled when FRONTEND_URL is staging, or set ENABLE_TEST_EMAIL=true
const testEmailEnabled =
  process.env.ENABLE_TEST_EMAIL === "true" ||
  process.env.FRONTEND_URL?.includes("staging.leadthur.com") === true;

if (testEmailEnabled) {
  adminRouter.post("/test-email", async (req: Request, res: Response) => {
    try {
      const to =
        typeof req.body?.to === "string" && req.body.to.trim()
          ? req.body.to.trim()
          : "bamzonline01@gmail.com";
      const { sendAccessEmail } = await import("../services/email");
      await sendAccessEmail(to, "TEST-KEY-12345");
      res.json({ success: true, message: `Test email sent to ${to}` });
    } catch (error) {
      console.error("Test email error:", error);
      res.status(500).json({ success: false, error: String(error) });
    }
  });
}
