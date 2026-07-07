import { Router, type Request, type Response } from "express";
import {
  listSentEmails,
  markRecipientRepliedForUser,
  markThreadReplied,
} from "../database/outreach-repository";
import { requireLicense } from "../middleware/require-license";
import { logger } from "../utils/logger";

export const sendsRouter = Router();

const VALID_STATUSES = new Set([
  "all",
  "queued",
  "sending",
  "sent",
  "failed",
  "bounced",
  "suppressed",
]);

sendsRouter.get("/", requireLicense, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: "User account not resolved" });
      return;
    }

    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 25));
    const offset = Math.max(0, Number(req.query.offset) || 0);
    const statusRaw = typeof req.query.status === "string" ? req.query.status : "all";
    const status = VALID_STATUSES.has(statusRaw) ? statusRaw : "all";
    const sortRaw = typeof req.query.sort === "string" ? req.query.sort : "recent";
    const sort = sortRaw === "sent_at" ? "sent_at" : "recent";

    const result = await listSentEmails(userId, {
      limit,
      offset,
      status: status === "all" ? null : status,
      sort,
    });

    res.json({
      sends: result.sends,
      pagination: {
        limit,
        offset,
        total: result.total,
      },
      summary: result.summary,
    });
  } catch (error) {
    logger.error("GET /sends failed", {
      error: error instanceof Error ? error.message : "unknown",
    });
    res.status(500).json({ error: "Failed to load recent sends" });
  }
});

sendsRouter.post("/:id/replied", requireLicense, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: "User account not resolved" });
      return;
    }

    const sentEmailId = String(req.params.id || "").trim();
    if (!sentEmailId) {
      res.status(400).json({ error: "sent email id is required" });
      return;
    }

    await markThreadReplied(sentEmailId);
    res.json({ ok: true });
  } catch (error) {
    logger.error("POST /sends/:id/replied failed", {
      error: error instanceof Error ? error.message : "unknown",
    });
    res.status(500).json({ error: "Failed to mark recipient replied" });
  }
});

sendsRouter.post("/replied-by-recipient", requireLicense, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: "User account not resolved" });
      return;
    }

    const recipientEmail = String((req.body as { recipient_email?: string }).recipient_email ?? "")
      .toLowerCase()
      .trim();
    if (!recipientEmail) {
      res.status(400).json({ error: "recipient_email is required" });
      return;
    }

    await markRecipientRepliedForUser(userId, recipientEmail);
    res.json({ ok: true });
  } catch (error) {
    logger.error("POST /sends/replied-by-recipient failed", {
      error: error instanceof Error ? error.message : "unknown",
    });
    res.status(500).json({ error: "Failed to mark recipient replied" });
  }
});
