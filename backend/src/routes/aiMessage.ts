import { Router, type Request, type Response } from "express";
import { requireLicense } from "../middleware/require-license";
import {
  applyAiBonusIfEligible,
  deductAiMessageCredits,
  getSearchCreditsBalance,
  logAiMessageGeneration,
  refundAiMessageCredits,
} from "../database/ai-message-repository";
import {
  buildAiMessagePrompt,
  generateAiWhatsappMessage,
} from "../services/ai-message-service";
import { logger } from "../utils/logger";
import {
  getDeepseekKeyFingerprint,
  isDeepseekConfigured,
} from "../utils/deepseek-config";

const router = Router();

const VALID_NICHES = new Set([
  "web_design",
  "social_media",
  "seo",
  "copywriting",
  "general",
]);

function generationErrorCode(
  reason: "missing_key" | "api_error" | "auth_error" | "empty_response"
): string {
  if (reason === "missing_key") return "ai_not_configured";
  if (reason === "auth_error") return "deepseek_auth_error";
  return "ai_generation_failed";
}

router.get("/status", requireLicense, async (req: Request, res: Response) => {
  try {
    const balance = await getSearchCreditsBalance(req.licenseId!);
    res.json({
      deepseekConfigured: isDeepseekConfigured(),
      deepseekKeyFingerprint: getDeepseekKeyFingerprint(),
      search_credits: balance ?? 0,
      canGenerate: (balance ?? 0) >= 3 && isDeepseekConfigured(),
    });
  } catch (err) {
    logger.error("GET /ai-message/status failed", {
      error: err instanceof Error ? err.message : "unknown",
    });
    res.status(500).json({ error: "Failed to read AI message status" });
  }
});

router.post("/claim-bonus", requireLicense, async (req: Request, res: Response) => {
  try {
    const result = await applyAiBonusIfEligible(req.licenseId!);
    res.json({
      applied: result.applied,
      search_credits: result.search_credits,
      deepseekConfigured: isDeepseekConfigured(),
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

    if (!isDeepseekConfigured()) {
      res.status(503).json({
        error: "Generation failed, credits refunded",
        message: "Generation failed, credits refunded",
        code: "ai_not_configured",
        deepseekConfigured: false,
      });
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

    const generation = await generateAiWhatsappMessage(prompt);

    if (!generation.ok) {
      const restoredBalance = await refundAiMessageCredits(licenseId);
      const status =
        generation.reason === "missing_key"
          ? 503
          : generation.reason === "auth_error"
            ? 502
            : 502;

      res.status(status).json({
        error: "Generation failed, credits refunded",
        message: "Generation failed, credits refunded",
        code: generationErrorCode(generation.reason),
        balance: restoredBalance ?? deduction.balance + 3,
      });
      return;
    }

    await logAiMessageGeneration({
      email: normalizedEmail,
      business_name,
      niche: normalizedNiche,
    }).catch(() => undefined);

    logger.info("AI WhatsApp message generated", {
      email: normalizedEmail,
      business_name: business_name.trim(),
      niche: normalizedNiche,
    });

    res.json({
      message: generation.message,
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
