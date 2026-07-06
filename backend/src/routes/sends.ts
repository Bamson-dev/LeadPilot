import { Router, type Request, type Response } from "express";
import { listRecentSentEmails } from "../database/outreach-repository";
import { requireLicense } from "../middleware/require-license";
import { logger } from "../utils/logger";

export const sendsRouter = Router();

sendsRouter.get("/", requireLicense, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: "User account not resolved" });
      return;
    }

    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50));
    const sends = await listRecentSentEmails(userId, limit);

    res.json({
      sends: sends.map((row) => ({
        id: row.id,
        recipient_email: row.recipient_email,
        business_name: row.business_name,
        subject: row.subject,
        status: row.status,
        credit_bucket: row.credit_bucket,
        provider_message_id: row.provider_message_id,
        error_message: row.error_message,
        opened_at: row.opened_at,
        open_count: row.open_count,
        sent_at: row.sent_at,
        created_at: row.created_at,
        mailbox_id: row.mailbox_id,
      })),
    });
  } catch (error) {
    logger.error("GET /sends failed", {
      error: error instanceof Error ? error.message : "unknown",
    });
    res.status(500).json({ error: "Failed to load recent sends" });
  }
});
