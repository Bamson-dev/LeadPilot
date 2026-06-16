import { Router, type Request, type Response } from "express";
import { requireLicense } from "../middleware/require-license";
import {
  applyAiBonusIfEligible,
  deductAiMessageCredits,
  logAiMessageGeneration,
  refundAiMessageCredits,
} from "../database/ai-message-repository";
import {
  buildAiMessagePrompt,
  generateAiWhatsappMessage,
} from "../services/ai-message-service";
import { logger } from "../utils/logger";

const router = Router();

const VALID_NICHES = new Set([
  "web_design",
  "social_media",
  "seo",
  "copywriting",
  "general",
]);

router.post("/claim-bonus", requireLicense, async (req: Request, res: Response) => {
  try {
    const result = await applyAiBonusIfEligible(req.licenseId!);
    res.json({
      applied: result.applied,
      search_credits: result.search_credits,
    });
  } catch (err) {
    logger.error("POST /ai-message/claim-bonus failed", {
      error: err instanceof Error ? err.message : "unknown",
    });
    res.status(500).json({ error: "Failed to claim AI bonus" });
  }
});

router.post("/generate", requireLicense, async (req: Request, res: Response) => {
  let creditsDeducted = false;

  try {
    const {
      email,
      business_name,
      city,
      niche,
      rating,
      has_website,
      has_email,
    } = req.body as {
      email?: string;
      business_name?: string;
      city?: string;
      niche?: string;
      rating?: number | null;
      has_website?: boolean;
      has_email?: boolean;
    };

    const authEmail = req.licenseEmail!;
    const normalizedEmail = (email ?? authEmail).toLowerCase().trim();

    if (normalizedEmail !== authEmail) {
      res.status(403).json({ error: "Email does not match authenticated license" });
      return;
    }

    if (!business_name?.trim()) {
      res.status(400).json({ error: "business_name is required" });
      return;
    }

    if (!city?.trim()) {
      res.status(400).json({ error: "city is required" });
      return;
    }

    const normalizedNiche = (niche ?? "general").trim();
    if (!VALID_NICHES.has(normalizedNiche)) {
      res.status(400).json({ error: "Invalid niche" });
      return;
    }

    const licenseId = req.licenseId!;
    const deduction = await deductAiMessageCredits(licenseId);

    if (!deduction.success) {
      res.status(402).json({
        error: "Insufficient credits",
        message: "Insufficient credits",
        balance: deduction.balance,
      });
      return;
    }

    creditsDeducted = true;

    const prompt = buildAiMessagePrompt({
      business_name: business_name.trim(),
      city: city.trim(),
      niche: normalizedNiche,
      rating: rating ?? null,
      has_website: Boolean(has_website),
      has_email: Boolean(has_email),
    });

    const message = await generateAiWhatsappMessage(prompt);

    if (!message) {
      const restoredBalance = await refundAiMessageCredits(licenseId);
      res.status(502).json({
        error: "Generation failed, credits refunded",
        message: "Generation failed, credits refunded",
        balance: restoredBalance ?? deduction.balance + 3,
      });
      return;
    }

    await logAiMessageGeneration({
      email: normalizedEmail,
      business_name,
      niche: normalizedNiche,
    }).catch(() => undefined);

    res.json({
      message,
      balance: deduction.balance,
    });
  } catch (err) {
    logger.error("POST /ai-message/generate failed", {
      error: err instanceof Error ? err.message : "unknown",
    });

    if (creditsDeducted) {
      const restoredBalance = await refundAiMessageCredits(req.licenseId!);
      res.status(500).json({
        error: "Generation failed, credits refunded",
        message: "Generation failed, credits refunded",
        balance: restoredBalance ?? undefined,
      });
      return;
    }

    res.status(500).json({
      error: "Generation failed, credits refunded",
      message: "Generation failed, credits refunded",
    });
  }
});

export default router;
