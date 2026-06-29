import { Router, type Request, type Response } from "express";
import {
  createTrialSignup,
  getTrialSignupByEmail,
  incrementTrialSearchesUsed,
  recordTrialEmailOpen,
  updateTrialSequenceProgress,
} from "../database/free-trial-repository";
import { sendTrialEmail } from "../services/email";
import { logger } from "../utils/logger";

export const trialRouter = Router();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const OPEN_PIXEL_GIF = Buffer.from(
  "R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==",
  "base64"
);

trialRouter.post("/signup", async (req: Request, res: Response) => {
  try {
    const rawEmail = (req.body as { email?: string })?.email;
    if (!rawEmail || typeof rawEmail !== "string") {
      res.status(400).json({ error: "Email is required" });
      return;
    }

    const email = rawEmail.toLowerCase().trim();
    if (!EMAIL_RE.test(email)) {
      res.status(400).json({ error: "Invalid email address" });
      return;
    }

    const existing = await getTrialSignupByEmail(email);
    if (existing) {
      res.json({ success: true, existing: true });
      return;
    }

    await createTrialSignup(email);

    try {
      await sendTrialEmail(email, 1);
      await updateTrialSequenceProgress(email, 1);
    } catch (error) {
      logger.error("Trial welcome email failed", { email, error });
    }

    res.json({ success: true, existing: false });
  } catch (err) {
    logger.error("Trial signup failed", {
      error: err instanceof Error ? err.message : "unknown",
    });
    res.status(500).json({ error: "Signup failed" });
  }
});

trialRouter.post("/search-used", async (req: Request, res: Response) => {
  try {
    const rawEmail = (req.body as { email?: string })?.email;
    if (!rawEmail || typeof rawEmail !== "string") {
      res.status(400).json({ error: "Email is required" });
      return;
    }

    const email = rawEmail.toLowerCase().trim();
    if (!EMAIL_RE.test(email)) {
      res.status(400).json({ error: "Invalid email address" });
      return;
    }

    await incrementTrialSearchesUsed(email);
    res.json({ success: true });
  } catch (err) {
    logger.error("Trial search-used failed", {
      error: err instanceof Error ? err.message : "unknown",
    });
    res.status(500).json({ error: "Failed to update search count" });
  }
});

trialRouter.get("/email-opened", async (req: Request, res: Response) => {
  const email = String(req.query.email || "").toLowerCase().trim();
  const step = Number(req.query.step);

  try {
    if (EMAIL_RE.test(email) && Number.isInteger(step) && step >= 1 && step <= 15) {
      await recordTrialEmailOpen(email, step);
    }
  } catch (err) {
    logger.error("Trial email open tracking failed", {
      email,
      step,
      error: err instanceof Error ? err.message : "unknown",
    });
  } finally {
    res.setHeader("Content-Type", "image/gif");
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, private");
    res.setHeader("Pragma", "no-cache");
    res.status(200).send(OPEN_PIXEL_GIF);
  }
});
