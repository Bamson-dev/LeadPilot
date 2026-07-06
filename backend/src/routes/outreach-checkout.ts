import { Router, type Request, type Response } from "express";
import { config } from "../config/env";
import {
  getOutreachCreditPack,
  getOutreachSubscriptionTier,
} from "../constants/outreach-pricing";
import { requireLicense } from "../middleware/require-license";
import { getOutreachPlanCodeForTier } from "../services/outreach-paystack-plans";
import { initializePaystackTransaction } from "../services/paystack-client";
import { logger } from "../utils/logger";

export const outreachCheckoutRouter = Router();

outreachCheckoutRouter.post("/", requireLicense, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const licenseEmail = req.licenseEmail;
    if (!userId || !licenseEmail) {
      res.status(401).json({ error: "User account not resolved" });
      return;
    }

    if (!config.PAYSTACK_SECRET_KEY) {
      res.status(503).json({ error: "Payment is not configured" });
      return;
    }

    const body = req.body as {
      type?: string;
      tier?: string;
      pack_id?: string;
    };

    const checkoutType = body.type === "pack" ? "pack" : body.type === "subscription" ? "subscription" : null;
    if (!checkoutType) {
      res.status(400).json({ error: "type must be subscription or pack" });
      return;
    }

    const frontendUrl = config.FRONTEND_URL.replace(/\/$/, "");
    const reference = `LT-OUT-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

    let amountKobo: number;
    let metadata: Record<string, unknown>;
    let planCode: string | undefined;

    if (checkoutType === "subscription") {
      const tier = body.tier ? getOutreachSubscriptionTier(body.tier) : undefined;
      if (!tier) {
        res.status(400).json({ error: "tier must be starter, growth, or scale" });
        return;
      }

      const storedPlanCode = await getOutreachPlanCodeForTier(tier.id);
      if (!storedPlanCode) {
        res.status(503).json({ error: "Subscription plans are not ready yet. Try again shortly." });
        return;
      }

      amountKobo = tier.amountKobo;
      planCode = storedPlanCode;
      metadata = {
        outreach_type: "subscription",
        user_id: userId,
        tier: tier.id,
      };
    } else {
      const pack = body.pack_id ? getOutreachCreditPack(body.pack_id) : undefined;
      if (!pack) {
        res.status(400).json({ error: "pack_id must be small, medium, or large" });
        return;
      }

      amountKobo = pack.amountKobo;
      metadata = {
        outreach_type: "pack",
        user_id: userId,
        pack_id: pack.id,
      };
    }

    const tx = await initializePaystackTransaction({
      email: licenseEmail,
      amountKobo,
      reference,
      callbackUrl: `${frontendUrl}/checkout/success`,
      metadata,
      planCode,
    });

    res.json({
      authorization_url: tx.authorization_url,
      reference: tx.reference ?? reference,
      access_code: tx.access_code,
    });
  } catch (error) {
    logger.error("POST /checkout outreach init failed", {
      error: error instanceof Error ? error.message : "unknown",
    });
    res.status(500).json({ error: "Failed to initialize checkout" });
  }
});
