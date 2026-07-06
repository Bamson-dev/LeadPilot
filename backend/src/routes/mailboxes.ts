import { Router, type Request, type Response } from "express";
import { requireLicense } from "../middleware/require-license";
import {
  connectMailbox,
  disconnectMailboxForUser,
  listMailboxesForUser,
  MailboxConnectError,
} from "../services/mailbox-service";
import { logger } from "../utils/logger";

export const mailboxesRouter = Router();

mailboxesRouter.post("/connect", requireLicense, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: "User account not resolved" });
      return;
    }

    const { email_address, app_password, account_type } = req.body as {
      email_address?: string;
      app_password?: string;
      account_type?: string;
    };

    if (!email_address?.trim() || !app_password?.trim()) {
      res.status(400).json({ error: "email_address and app_password are required" });
      return;
    }

    const accountType = account_type === "workspace" ? "workspace" : "personal";

    const result = await connectMailbox({
      userId,
      emailAddress: email_address,
      appPassword: app_password,
      accountType,
    });

    res.status(201).json({
      success: true,
      mailbox: {
        id: result.mailbox.id,
        email_address: result.mailbox.email_address,
        account_type: result.mailbox.account_type,
        status: result.mailbox.status,
        daily_cap: result.mailbox.daily_cap,
        daily_send_count: result.mailbox.daily_send_count,
        last_verified_at: result.mailbox.last_verified_at,
      },
      first_connect: result.firstConnect,
    });
  } catch (error) {
    if (error instanceof MailboxConnectError) {
      res.status(error.statusCode).json({ error: error.message, code: error.code });
      return;
    }

    logger.error("POST /mailboxes/connect failed", {
      error: error instanceof Error ? error.message : "unknown",
    });
    res.status(500).json({ error: "Failed to connect mailbox" });
  }
});

mailboxesRouter.get("/", requireLicense, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: "User account not resolved" });
      return;
    }

    const mailboxes = await listMailboxesForUser(userId);
    res.json({
      mailboxes: mailboxes.map((mailbox) => ({
        id: mailbox.id,
        email_address: mailbox.email_address,
        account_type: mailbox.account_type,
        status: mailbox.status,
        daily_cap: mailbox.daily_cap,
        daily_send_count: mailbox.daily_send_count,
        daily_count_reset_at: mailbox.daily_count_reset_at,
        last_verified_at: mailbox.last_verified_at,
        last_error: mailbox.last_error,
      })),
    });
  } catch (error) {
    logger.error("GET /mailboxes failed", {
      error: error instanceof Error ? error.message : "unknown",
    });
    res.status(500).json({ error: "Failed to list mailboxes" });
  }
});

mailboxesRouter.delete("/:id", requireLicense, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: "User account not resolved" });
      return;
    }

    const mailboxId = String(req.params.id);
    await disconnectMailboxForUser(userId, mailboxId);
    res.json({ success: true });
  } catch (error) {
    logger.error("DELETE /mailboxes/:id failed", {
      error: error instanceof Error ? error.message : "unknown",
    });
    res.status(500).json({ error: "Failed to disconnect mailbox" });
  }
});
