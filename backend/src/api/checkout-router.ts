import { Router, type Request, type Response } from "express";
import { config } from "../config/env";
import { LIFETIME_PRICE_KOBO } from "../constants/pricing";
import { getPaystack, paystackAsync } from "../services/paystack-client";
import { logger } from "../utils/logger";

const router = Router();

router.post("/initialize", async (req: Request, res: Response) => {
  try {
    const { email, refCode } = req.body as { email?: string; refCode?: string };

    if (!email?.includes("@")) {
      res.status(400).json({ error: "Email is required" });
      return;
    }

    if (!config.PAYSTACK_SECRET_KEY) {
      res.status(503).json({ error: "Payment is not configured" });
      return;
    }

    const reference = `LP-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
    const frontendUrl = config.FRONTEND_URL.replace(/\/$/, "");

    const metadata: Record<string, string> = {
      product: "LeadPilot Lifetime",
      cancel_action: `${frontendUrl}/`,
    };

    if (refCode?.trim()) {
      metadata.ref_code = refCode.trim();
    }

    const paystack = getPaystack();
    const response = await paystackAsync<{ data: { authorization_url: string; access_code: string } }>(
      (cb) =>
        paystack.transaction.initialize(
          {
            email: email.toLowerCase().trim(),
            amount: LIFETIME_PRICE_KOBO,
            currency: "NGN",
            reference,
            callback_url: `${frontendUrl}/checkout/success`,
            metadata,
            channels: ["card", "bank", "ussd", "bank_transfer"],
            customizations: {
              title: "LeadPilot Lifetime Access",
              description: "One payment. Find clients forever.",
              logo: `${frontendUrl}/logo.png`,
            },
          },
          cb
        )
    );

    res.json({
      authorizationUrl: response.data.authorization_url,
      reference,
      accessCode: response.data.access_code,
    });
  } catch (err) {
    logger.error("Checkout initialization failed", {
      error: err instanceof Error ? err.message : "unknown",
    });
    res.status(500).json({ error: "Failed to initialize payment" });
  }
});

export default router;
