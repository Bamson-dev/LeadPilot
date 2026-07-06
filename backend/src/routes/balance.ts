import { Router, type Request, type Response } from "express";
import { getOutreachBalance } from "../database/outreach-repository";
import { requireLicense } from "../middleware/require-license";
import { logger } from "../utils/logger";

export const balanceRouter = Router();

balanceRouter.get("/", requireLicense, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: "User account not resolved" });
      return;
    }

    const balance = await getOutreachBalance(userId);
    res.json(balance);
  } catch (error) {
    logger.error("GET /balance failed", {
      error: error instanceof Error ? error.message : "unknown",
    });
    res.status(500).json({ error: "Failed to load balance" });
  }
});
