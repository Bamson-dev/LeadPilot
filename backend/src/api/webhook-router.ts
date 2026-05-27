// PAYSTACK DASHBOARD SETUP
// Settings → API Keys & Webhooks
// Webhook URL: https://backend.leadpilot.live/webhooks/paystack
//
// FLUTTERWAVE DASHBOARD SETUP
// Settings → Webhooks
// Webhook URL: https://backend.leadpilot.live/webhooks/flutterwave
// Set secret hash → FLUTTERWAVE_SECRET_HASH in Coolify
// Success Redirect: https://www.leadpilot.live/checkout/success
// Paystack sends its own receipt email; LeadPilot sends the license key via Brevo when this webhook runs.

import { Router, type Request, type Response } from "express";
import express from "express";
import crypto from "crypto";
import { config } from "../config/env";
import {
  extractRefCodeFromMetadata,
  fulfillFlutterwaveCharge,
  fulfillPaystackCharge,
} from "../services/payment-fulfillment";
import { logger } from "../utils/logger";

export const webhookRouter = Router();

webhookRouter.post(
  "/flutterwave",
  express.json(),
  async (req: Request, res: Response) => {
    try {
      const secretHash = config.FLUTTERWAVE_SECRET_HASH;
      const signature = req.headers["verif-hash"] as string | undefined;

      if (secretHash && signature !== secretHash) {
        logger.warn("Flutterwave webhook signature mismatch");
        res.status(401).json({ error: "Invalid signature" });
        return;
      }

      const event = req.body as {
        event?: string;
        data?: {
          status?: string;
          tx_ref?: string;
          flw_ref?: string;
          amount?: number;
          currency?: string;
          customer?: { email?: string };
          meta?: Record<string, unknown>;
        };
      };

      if (event.event !== "charge.completed" || event.data?.status !== "successful") {
        res.status(200).json({ received: true });
        return;
      }

      res.status(200).json({ received: true });

      setImmediate(() => {
        void (async () => {
          try {
            const email = event.data?.customer?.email;
            const reference = event.data?.tx_ref;
            const amount = event.data?.amount ?? 0;
            const currency = event.data?.currency ?? "USD";
            const meta = event.data?.meta;

            if (!email || !reference) {
              logger.error("Missing email or tx_ref in Flutterwave webhook", { event });
              return;
            }

            const metadata: Record<string, unknown> = { ...(meta ?? {}) };
            const refCode = extractRefCodeFromMetadata(metadata);
            if (refCode) {
              metadata.ref_code = refCode;
            }

            await fulfillFlutterwaveCharge({
              email,
              reference,
              amount,
              currency,
              metadata,
            });
          } catch (err) {
            logger.error("Flutterwave webhook processing failed", {
              error: err instanceof Error ? err.message : "unknown",
            });
          }
        })();
      });
    } catch (err) {
      logger.error("Flutterwave webhook handler error", {
        error: err instanceof Error ? err.message : "unknown",
      });
      res.status(500).json({ error: "Webhook processing failed" });
    }
  }
);

webhookRouter.post(
  "/paystack",
  express.raw({ type: "application/json" }),
  async (req: Request, res: Response) => {
    try {
      const signature = req.headers["x-paystack-signature"] as string | undefined;
      const rawBody = req.body as Buffer;
      const secret = config.PAYSTACK_SECRET_KEY;

      if (!secret) {
        logger.warn("Paystack webhook received but PAYSTACK_SECRET_KEY is not set");
        res.status(200).send("ok");
        return;
      }

      const expectedHash = crypto
        .createHmac("sha512", secret)
        .update(rawBody)
        .digest("hex");

      if (!signature || signature !== expectedHash) {
        logger.warn("Invalid Paystack webhook signature — check sk_test/sk_live matches dashboard");
        res.status(200).send("ok");
        return;
      }

      const event = JSON.parse(rawBody.toString()) as {
        event?: string;
        data?: {
          customer?: { email?: string };
          reference?: string;
          amount?: number;
          metadata?: Record<string, unknown>;
        };
      };

      if (event.event !== "charge.success") {
        res.status(200).send("ok");
        return;
      }

      res.status(200).send("ok");

      setImmediate(() => {
        void (async () => {
          try {
            const email = event.data?.customer?.email;
            const reference = event.data?.reference;
            const amount = event.data?.amount ?? 0;

            if (!email || !reference) {
              logger.error("Missing email or reference in Paystack webhook", { event });
              return;
            }

            await fulfillPaystackCharge({
              email,
              reference,
              amount,
              metadata: event.data?.metadata,
            });
          } catch (err) {
            logger.error("Webhook processing failed", {
              error: err instanceof Error ? err.message : "unknown",
            });
          }
        })();
      });
    } catch (err) {
      logger.error("Webhook handler error", {
        error: err instanceof Error ? err.message : "unknown",
      });
      res.status(200).send("ok");
    }
  }
);
