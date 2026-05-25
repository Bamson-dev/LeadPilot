// PAYSTACK DASHBOARD SETUP
// Settings → API Keys & Webhooks
// Webhook URL: https://backend.leadpilot.live/webhooks/paystack
// Success Redirect: https://www.leadpilot.live/payment-success
// The redirect happens on the frontend after payment
// The webhook fires on the backend silently after payment
// These are independent — both should be set

import { Router, type Request, type Response } from "express";
import express from "express";
import crypto from "crypto";
import { config } from "../config/env";
import {
  createLicenseKey,
  getLicenseByPaymentReference,
} from "../database/license-repository";
import { sendActivationEmail } from "../services/brevo-service";
import { LIFETIME_PRICE_KOBO } from "../constants/pricing";
import { createCommissionForReferral } from "../services/license-service";
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
        logger.warn("Invalid Paystack webhook signature");
        res.status(200).send("ok");
        return;
      }

      const event = JSON.parse(rawBody.toString()) as {
        event?: string;
        data?: {
          customer?: { email?: string };
          reference?: string;
          amount?: number;
          metadata?: Record<string, unknown> & {
            ref_code?: string;
            custom_fields?: Array<{ variable_name?: string; value?: string }>;
          };
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

            if (amount < LIFETIME_PRICE_KOBO) {
              logger.warn("Payment amount too low", { amount, reference });
              return;
            }

            const existing = await getLicenseByPaymentReference(reference);
            if (existing) {
              logger.info("Duplicate Paystack webhook ignored", { reference });
              return;
            }

            const license = await createLicenseKey({
              email,
              paymentReference: reference,
              paymentChannel: "paystack",
            });

            await sendActivationEmail(email, license.key);

            logger.info("License created from Paystack webhook", {
              email,
              keyPrefix: license.key.slice(0, 12),
            });

            const metadata = event.data?.metadata ?? {};
            let refCode =
              typeof metadata.ref_code === "string" ? metadata.ref_code : null;

            if (!refCode && Array.isArray(metadata.custom_fields)) {
              const field = metadata.custom_fields.find(
                (f) => f.variable_name === "ref_code"
              );
              if (field?.value) refCode = String(field.value);
            }

            if (refCode?.trim()) {
              try {
                await createCommissionForReferral({
                  refCode: refCode.trim(),
                  referredEmail: email,
                });
                logger.info("Commission created from Paystack webhook", {
                  refCode: refCode.trim(),
                  referred: email,
                });
              } catch (commissionErr) {
                logger.error("Commission creation failed", {
                  error:
                    commissionErr instanceof Error
                      ? commissionErr.message
                      : "unknown",
                });
              }
            }
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
