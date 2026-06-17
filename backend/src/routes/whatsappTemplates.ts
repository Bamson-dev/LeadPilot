import { Router, type Request, type Response } from "express";
import { getAllWhatsappTemplates } from "../database/whatsapp-templates-repository";
import { logger } from "../utils/logger";

const router = Router();

router.get("/", async (_req: Request, res: Response) => {
  try {
    const templates = await getAllWhatsappTemplates();
    res.json({ templates });
  } catch (err) {
    logger.error("GET /whatsapp-templates failed", {
      error: err instanceof Error ? err.message : "unknown",
    });
    res.status(500).json({ error: "Failed to fetch WhatsApp templates" });
  }
});

export default router;
