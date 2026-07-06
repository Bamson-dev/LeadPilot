import { Router, type Request, type Response } from "express";
import { listSystemEmailTemplates } from "../database/outreach-repository";
import { logger } from "../utils/logger";

export const emailTemplatesRouter = Router();

emailTemplatesRouter.get("/", async (_req: Request, res: Response) => {
  try {
    const templates = await listSystemEmailTemplates();
    res.json({ templates });
  } catch (error) {
    logger.error("GET /email-templates failed", {
      error: error instanceof Error ? error.message : "unknown",
    });
    res.status(500).json({ error: "Failed to load email templates" });
  }
});
