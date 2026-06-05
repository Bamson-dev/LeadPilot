import { Router, type Request, type Response } from "express";
import { config } from "../config/env";
import { supabase } from "../database/client";
import { getPaystack, paystackAsync } from "../services/paystack-client";
import { TOPUP_TIERS } from "../services/topup-service";
import { logger } from "../utils/logger";

export const topupRouter = Router();

topupRouter.post("/initialize", async (req: Request, res: Response) => {
  try {
    const { email, tierId } = req.body as { email?: string; tierId?: string };

    if (!email?.includes("@") || !tierId) {
      res.status(400).json({ error: "Email and tier are required" });
      return;
    }

    const tier = TOPUP_TIERS.find((t) => t.id === tierId);
    if (!tier) {
      res.status(400).json({ error: "Invalid tier" });
      return;
    }

    if (!config.PAYSTACK_SECRET_KEY) {
      res.status(503).json({ error: "Payment is not configured" });
      return;
    }

    const normalizedEmail = email.toLowerCase().trim();

    const { data: license, error: licenseError } = await supabase
      .from("license_keys")
      .select("id, email, activated")
      .eq("email", normalizedEmail)
      .eq("activated", true)
      .maybeSingle();

    if (licenseError || !license) {
      res.status(404).json({ error: "No active license found for this email" });
      return;
    }

    const reference = `topup_${tierId}_${Date.now()}`;
    const frontendUrl = config.FRONTEND_URL.replace(/\/$/, "");

    const paystack = getPaystack();
    const response = await paystackAsync<{ data: { authorization_url: string } }>((cb) =>
      paystack.transaction.initialize(
        {
          email: normalizedEmail,
          amount: tier.amountKobo,
          currency: "NGN",
          reference,
          metadata: {
            type: "topup",
            tierId: tier.id,
            credits: tier.credits,
            licenseId: license.id,
            email: normalizedEmail,
          },
          callback_url: `${frontendUrl}/dashboard?topup=success`,
          channels: ["card", "bank", "ussd", "bank_transfer"],
          customizations: {
            title: "LeadThur Search Top Up",
            description: `${tier.label} — ${tier.searches} extra searches`,
          },
        },
        cb
      )
    );

    res.json({
      success: true,
      authorizationUrl: response.data.authorization_url,
      reference,
    });
  } catch (err) {
    logger.error("Top up initialization failed", {
      error: err instanceof Error ? err.message : "unknown",
    });
    res.status(500).json({ error: "Failed to initialize top up payment" });
  }
});

topupRouter.get("/tiers", (_req: Request, res: Response) => {
  res.json({ tiers: TOPUP_TIERS });
});
