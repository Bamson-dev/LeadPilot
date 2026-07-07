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
      followups?: {
        enabled?: boolean;
        steps?: Array<{
          step_number?: number;
          gap_days?: number;
          subject?: string;
          body?: string;
        }>;
      };
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

    const followupsEnabled = Boolean(body.followups?.enabled);
    const followupSteps =
      body.followups?.steps?.map((step, idx) => ({
        stepNumber: Number(step.step_number ?? idx + 1),
        gapDays: Number(step.gap_days ?? 0),
        subject: String(step.subject ?? "").trim(),
        body: String(step.body ?? "").trim(),
      })) ?? [];

    if (followupsEnabled) {
      if (followupSteps.length > 3) {
        res.status(400).json({ error: "A batch can have at most 3 follow ups" });
        return;
      }
      for (const step of followupSteps) {
        if (step.gapDays < 2) {
          res.status(400).json({
            error: `Follow up ${step.stepNumber} must have at least 2 days gap`,
          });
          return;
        }
        if (!step.subject || !step.body) {
          res.status(400).json({
            error: `Follow up ${step.stepNumber} subject and body are required`,
          });
          return;
        }
      }
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
      followups: {
        enabled: followupsEnabled,
        steps: followupSteps,
      },
    });

    res.status(202).json({
      queued: result.queued,
      skipped_suppression: result.skipped_suppression,
      skipped_no_verified_email: result.skipped_no_verified_email,
      skipped_invalid_email: result.skipped_invalid_email,
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
