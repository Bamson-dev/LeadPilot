import { Router, type Request, type Response } from "express";
import { recordOutreachEmailOpen } from "../database/outreach-repository";
import { logger } from "../utils/logger";

export const outreachTrackingRouter = Router();

const OPEN_PIXEL_GIF = Buffer.from(
  "R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==",
  "base64"
);

outreachTrackingRouter.get("/open/:token", async (req: Request, res: Response) => {
  const token = String(req.params.token || "").trim();

  try {
    if (token) {
      await recordOutreachEmailOpen(token);
    }
  } catch (err) {
    logger.error("Outreach email open tracking failed", {
      token,
      error: err instanceof Error ? err.message : "unknown",
    });
  } finally {
    res.setHeader("Content-Type", "image/gif");
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, private");
    res.setHeader("Pragma", "no-cache");
    res.status(200).send(OPEN_PIXEL_GIF);
  }
});
