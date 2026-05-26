// PAYSTACK DASHBOARD SETUP
// Settings → API Keys & Webhooks
// Webhook URL: https://backend.leadpilot.live/webhooks/paystack
// Success Redirect: https://www.leadpilot.live/checkout/success
// Paystack sends its own receipt email; LeadPilot sends the license key via Brevo when this webhook runs.

import { Router, type Request, type Response } from "express";
import express from "express";
import crypto from "crypto";
import { config } from "../config/env";
import { getLicenseByPaymentReference } from "../database/license-repository";
import { fulfillPaystackCharge } from "../services/payment-fulfillment";
import { logger } from "../utils/logger";

export const webhookRouter = Router();

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

      const reference = event.data?.reference;
      if (reference) {
        const existing = await getLicenseByPaymentReference(reference);
        if (existing) {
          logger.info("Webhook already processed — skipping duplicate", { reference });
          res.status(200).json({ received: true });
          return;
        }
      }

      res.status(200).send("ok");

      setImmediate(() => {
        void (async () => {
          try {
            const email = event.data?.customer?.email;
            const ref = event.data?.reference;
            const amount = event.data?.amount ?? 0;

            if (!email || !ref) {
              logger.error("Missing email or reference in Paystack webhook", { event });
              return;
            }

            const duplicate = await getLicenseByPaymentReference(ref);
            if (duplicate) {
              logger.info("Webhook duplicate skipped in async handler", { reference: ref });
              return;
            }

            await fulfillPaystackCharge({
              email,
              reference: ref,
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
