import { Router, type Request, type Response } from "express";
import { listSentEmails } from "../database/outreach-repository";
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
