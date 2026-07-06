import { Router, type Request, type Response } from "express";
import { requireLicense } from "../middleware/require-license";
import { queueSendBatch } from "../services/outreach-send-service";
import { logger } from "../utils/logger";
import type { OutreachSendMode } from "../queue/outreach-send-queue-types";

export const sendRouter = Router();

sendRouter.post("/", requireLicense, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: "User account not resolved" });
      return;
    }

    const body = req.body as {
      targets?: Array<{
        recipient_email?: string;
        business_name?: string;
        business_id?: string;
        email_kind?: "verified" | "predicted";
      }>;
      subject?: string;
      body?: string;
      template_id?: string;
      mailbox_id?: string;
      send_mode?: string;
    };

    const targets = body.targets ?? [];
    if (!Array.isArray(targets) || targets.length === 0) {
      res.status(400).json({ error: "targets array is required" });
      return;
    }

    if (!body.subject?.trim() || !body.body?.trim()) {
      res.status(400).json({ error: "subject and body are required" });
      return;
    }

    const sendMode: OutreachSendMode = body.send_mode === "manual" ? "manual" : "auto";
    if (sendMode === "manual" && !body.mailbox_id?.trim()) {
      res.status(400).json({ error: "mailbox_id is required for manual send_mode" });
      return;
    }

    const result = await queueSendBatch({
      userId,
      targets: targets.map((t) => ({
        recipient_email: String(t.recipient_email || ""),
        business_name: t.business_name,
        business_id: t.business_id?.trim() || undefined,
        email_kind: t.email_kind === "predicted" ? "predicted" : t.email_kind === "verified" ? "verified" : undefined,
      })),
      subject: body.subject.trim(),
      body: body.body.trim(),
      templateId: body.template_id,
      mailboxId: body.mailbox_id,
      sendMode,
    });

    res.status(202).json({
      queued: result.queued,
      skipped_suppression: result.skipped_suppression,
      skipped_no_verified_email: result.skipped_no_verified_email,
      short_credits: result.short_credits,
      sent_email_ids: result.sent_email_ids,
    });
  } catch (error) {
    logger.error("POST /send failed", {
      error: error instanceof Error ? error.message : "unknown",
    });
    res.status(500).json({ error: "Failed to queue sends" });
  }
});
