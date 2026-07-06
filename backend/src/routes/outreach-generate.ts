import { Router, type Request, type Response } from "express";
import { requireLicense } from "../middleware/require-license";
import { outreachGenerateRateLimit } from "../middleware/outreach-generate-rate-limit";
import {
  generateOutreachEmail,
  OUTREACH_EMAIL_TONES,
} from "../services/outreach-email-service";
import { isDeepseekConfigured } from "../utils/deepseek-config";
import { logger } from "../utils/logger";

export const outreachGenerateRouter = Router();

function generationErrorMessage(
  reason: "missing_key" | "api_error" | "auth_error" | "empty_response" | "parse_error"
): string {
  if (reason === "missing_key") {
    return "AI email writer is not configured on the server yet.";
  }
  if (reason === "auth_error") {
    return "AI email writer is temporarily unavailable. Try again later or write manually.";
  }
  if (reason === "parse_error") {
    return "Could not read the generated email. Try again or write manually.";
  }
  return "Generation failed. Try again or write your email manually.";
}

outreachGenerateRouter.post(
  "/generate-email",
  requireLicense,
  outreachGenerateRateLimit,
  async (req: Request, res: Response) => {
    try {
      const { service_description, target_business_type, tone } = req.body as {
        service_description?: string;
        target_business_type?: string;
        tone?: string | null;
      };

      if (!service_description?.trim()) {
        res.status(400).json({ error: "service_description is required" });
        return;
      }

      if (!target_business_type?.trim()) {
        res.status(400).json({ error: "target_business_type is required" });
        return;
      }

      if (service_description.trim().length > 500) {
        res.status(400).json({ error: "service_description is too long" });
        return;
      }

      if (target_business_type.trim().length > 120) {
        res.status(400).json({ error: "target_business_type is too long" });
        return;
      }

      const normalizedTone = tone?.trim().toLowerCase() || null;
      if (
        normalizedTone &&
        !OUTREACH_EMAIL_TONES.includes(normalizedTone as (typeof OUTREACH_EMAIL_TONES)[number])
      ) {
        res.status(400).json({
          error: `tone must be one of: ${OUTREACH_EMAIL_TONES.join(", ")}`,
        });
        return;
      }

      if (!isDeepseekConfigured()) {
        res.status(503).json({
          error: generationErrorMessage("missing_key"),
          code: "ai_not_configured",
        });
        return;
      }

      const generation = await generateOutreachEmail({
        service_description: service_description.trim(),
        target_business_type: target_business_type.trim(),
        tone: normalizedTone,
      });

      if (!generation.ok) {
        const status =
          generation.reason === "missing_key"
            ? 503
            : generation.reason === "auth_error"
              ? 502
              : 502;

        res.status(status).json({
          error: generationErrorMessage(generation.reason),
          code: generation.reason,
        });
        return;
      }

      if (!/\[Business Name\]/i.test(generation.body)) {
        res.status(502).json({
          error: generationErrorMessage("parse_error"),
          code: "missing_merge_token",
        });
        return;
      }

      logger.info("Outreach email generated", {
        userId: req.user?.id,
        target_business_type: target_business_type.trim(),
      });

      res.json({
        subject: generation.subject,
        body: generation.body,
      });
    } catch (error) {
      logger.error("POST /outreach/generate-email failed", {
        error: error instanceof Error ? error.message : "unknown",
      });
      res.status(500).json({
        error: "Generation failed. Try again or write your email manually.",
      });
    }
  }
);
