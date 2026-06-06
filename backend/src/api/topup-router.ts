import { Router, type Request, type Response } from "express";
import { config } from "../config/env";
import { getLicenseByKeyAndEmail } from "../database/license-repository";
import { getPaystack, paystackAsync } from "../services/paystack-client";
import { getTopUpTier, TOPUP_TIERS } from "../services/topup-service";
import { logger } from "../utils/logger";

export const topupRouter = Router();

async function resolveTopUpLicense(req: Request, res: Response) {
  const { email: bodyEmail, tierId, key: bodyKey } = req.body as {
    email?: string;
    tierId?: string;
    key?: string;
  };
  const email = (
    (req.headers["x-license-email"] as string) ||
    bodyEmail ||
    ""
  )
    .toLowerCase()
    .trim();
  const licenseKey = (
    (req.headers["x-license-key"] as string) ||
    bodyKey ||
    ""
  )
    .trim()
    .toUpperCase();

  if (!email.includes("@") || !licenseKey || !tierId) {
    res.status(400).json({ error: "License, email, and tier are required" });
    return null;
  }

  const tier = getTopUpTier(tierId);
  if (!tier) {
    res.status(400).json({ error: "Invalid tier" });
    return null;
  }

  const license = await getLicenseByKeyAndEmail(licenseKey, email);
  if (!license) {
    res.status(404).json({
      error: "No active license found. Check your email and license key, then try again.",
    });
    return null;
  }

  return { email, tier, license };
}

topupRouter.post("/initialize", async (req: Request, res: Response) => {
  try {
    const resolved = await resolveTopUpLicense(req, res);
    if (!resolved) return;

    const { tier, license } = resolved;

    if (!config.PAYSTACK_SECRET_KEY) {
      res.status(503).json({ error: "Payment is not configured" });
      return;
    }

    const reference = `topup_${tier.id}_${Date.now()}`;
    const frontendUrl = config.FRONTEND_URL.replace(/\/$/, "");

    const paystack = getPaystack();
    const response = await paystackAsync<{ data: { authorization_url: string } }>((cb) =>
      paystack.transaction.initialize(
        {
          email: license.email,
          amount: tier.amountKobo,
          currency: "NGN",
          reference,
          metadata: {
            type: "topup",
            tierId: tier.id,
            credits: tier.credits,
            licenseId: license.id,
            email: license.email,
            amountNgn: tier.amountNgn,
          },
          callback_url: `${frontendUrl}/dashboard?topup=success`,
          channels: ["card", "bank", "ussd", "bank_transfer"],
          customizations: {
            title: "LeadThur Search Top Up",
            description: tier.label,
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

topupRouter.post("/initialize-flw", async (req: Request, res: Response) => {
  try {
    const resolved = await resolveTopUpLicense(req, res);
    if (!resolved) return;

    const { tier, license } = resolved;

    if (!config.FLUTTERWAVE_SECRET_KEY) {
      res.status(503).json({ error: "Flutterwave is not configured" });
      return;
    }

    const reference = `topup_flw_${tier.id}_${Date.now()}`;
    const frontendUrl = config.FRONTEND_URL.replace(/\/$/, "");

    res.json({
      success: true,
      reference,
      amount: tier.amountUsd,
      currency: "USD",
      email: license.email,
      tierId: tier.id,
      credits: tier.credits,
      licenseId: license.id,
      amountNgn: tier.amountNgn,
      label: tier.label,
      redirectUrl: `${frontendUrl}/dashboard?topup=success`,
    });
  } catch (err) {
    logger.error("Flutterwave top up initialization failed", {
      error: err instanceof Error ? err.message : "unknown",
    });
    res.status(500).json({ error: "Failed to initialize top up payment" });
  }
});

topupRouter.get("/tiers", (_req: Request, res: Response) => {
  res.json({ tiers: TOPUP_TIERS });
});
