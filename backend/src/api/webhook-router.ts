// PAYSTACK DASHBOARD SETUP
// Settings → API Keys & Webhooks
// Webhook URL: https://backend.leadthur.com/webhooks/paystack
// Success Redirect: https://www.leadthur.com/checkout/success
// Paystack sends its own receipt email; LeadThur sends the license key via Resend when this webhook runs.

import { Router, type Request, type Response } from "express";
import express from "express";
import crypto from "crypto";
import { config } from "../config/env";
import { getLicenseByPaymentReference } from "../database/license-repository";
import { fulfillTopUpPayment, getTopUpTier, isTopUpPaymentReference, parseTopUpTierIdFromFlwRef } from "../services/topup-service";
import {
  fulfillFlutterwaveCharge,
  fulfillPaystackCharge,
} from "../services/payment-fulfillment";
import {
  handleMailthurPaystackForward,
  isMailthurPaystackEvent,
} from "../services/paystack-webhook-forward";
import { logger } from "../utils/logger";

export const webhookRouter = Router();

function parseFlutterwaveMeta(
  meta: Record<string, unknown> | string | undefined
): Record<string, unknown> | undefined {
  if (!meta) return undefined;
  if (typeof meta === "string") {
    try {
      return JSON.parse(meta) as Record<string, unknown>;
    } catch {
      return undefined;
    }
  }
  if (typeof meta === "object") return meta;
  return undefined;
}

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
          metadata?: Record<string, unknown> | string;
        };
      };

      if (isMailthurPaystackEvent(event.data?.metadata)) {
        const forwardResult = await handleMailthurPaystackForward({
          rawBody,
          signature,
          reference: event.data?.reference,
          eventType: event.event,
        });

        if (forwardResult.forwarded) {
          if (forwardResult.contentType) {
            res.setHeader("Content-Type", forwardResult.contentType);
          }
          res.status(forwardResult.status).send(forwardResult.body);
          return;
        }

        res.status(200).send("ok");
        return;
      }

      if (event.event !== "charge.success") {
        res.status(200).send("ok");
        return;
      }

      const reference = event.data?.reference;
      const metadata = (event.data?.metadata ?? {}) as Record<string, unknown>;

      if (metadata.type === "topup") {
        res.status(200).send("ok");
        setImmediate(() => {
          void (async () => {
            try {
              await fulfillTopUpPayment({
                reference: reference ?? "",
                amount: event.data?.amount ?? 0,
                channel: (event.data as { channel?: string })?.channel,
                metadata,
              });
            } catch (err) {
              logger.error("Top up webhook processing failed", {
                error: err instanceof Error ? err.message : "unknown",
              });
            }
          })();
        });
        return;
      }

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
            const meta = (event.data?.metadata ?? {}) as Record<string, unknown>;

            if (meta.type === "topup") {
              await fulfillTopUpPayment({
                reference: ref ?? "",
                amount,
                channel: (event.data as { channel?: string })?.channel,
                metadata: meta,
              });
              return;
            }

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
              metadata: meta,
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

webhookRouter.post(
  "/flutterwave",
  express.json(),
  async (req: Request, res: Response) => {
    try {
      const secretHash = config.FLUTTERWAVE_SECRET_HASH;
      const signature = req.headers["verif-hash"] as string | undefined;

      if (!secretHash) {
        logger.error(
          "FLUTTERWAVE_SECRET_HASH is not configured, rejecting all webhook requests for security."
        );
        res.status(500).json({
          error: "Flutterwave webhook verification is not configured",
        });
        return;
      }

      if (signature !== secretHash) {
        logger.warn("Flutterwave webhook signature mismatch");
        res.status(401).json({ error: "Invalid signature" });
        return;
      }

      const event = req.body as {
        event?: string;
        data?: {
          status?: string;
          customer?: { email?: string };
          tx_ref?: string;
          amount?: number;
          currency?: string;
          meta?: Record<string, unknown> | string;
        };
      };

      if (event.event !== "charge.completed" || event.data?.status !== "successful") {
        res.status(200).json({ received: true });
        return;
      }

      const data = event.data;
      const email = data?.customer?.email;
      const reference = data?.tx_ref;
      const amount = data?.amount ?? 0;
      const currency = data?.currency ?? "USD";

      if (!email || !reference) {
        logger.error("Flutterwave webhook missing email or tx_ref", { event });
        res.status(200).json({ received: true });
        return;
      }

      const meta = parseFlutterwaveMeta(data?.meta);
      const isTopUp =
        meta?.type === "topup" ||
        (typeof reference === "string" && reference.startsWith("topup_flw_"));

      if (isTopUp) {
        res.status(200).json({ received: true });

        setImmediate(() => {
          void (async () => {
            try {
              const tierId =
                (typeof meta?.tierId === "string" ? meta.tierId : null) ||
                parseTopUpTierIdFromFlwRef(reference);
              const tier = tierId ? getTopUpTier(tierId) : undefined;

              await fulfillTopUpPayment({
                reference,
                amount: amount,
                channel: "flutterwave",
                metadata: {
                  type: "topup",
                  tierId: tierId ?? undefined,
                  licenseId: meta?.licenseId,
                  credits: meta?.credits ?? tier?.credits,
                  email: email.toLowerCase().trim(),
                  amountNgn: meta?.amountNgn ?? tier?.amountNgn,
                },
              });
            } catch (err) {
              logger.error("Flutterwave top up webhook processing failed", {
                error: err instanceof Error ? err.message : "unknown",
              });
            }
          })();
        });
        return;
      }

      if (isTopUpPaymentReference(reference)) {
        res.status(200).json({ received: true });
        return;
      }

      const existing = await getLicenseByPaymentReference(reference);
      if (existing) {
        logger.info("Flutterwave webhook already processed — skipping duplicate", {
          reference,
        });
        res.status(200).json({ received: true });
        return;
      }

      res.status(200).json({ received: true });

      setImmediate(() => {
        void (async () => {
          try {
            const duplicate = await getLicenseByPaymentReference(reference);
            if (duplicate) {
              logger.info("Flutterwave webhook duplicate skipped in async handler", {
                reference,
              });
              return;
            }

            let meta: Record<string, unknown> | undefined = parseFlutterwaveMeta(data?.meta);

            await fulfillFlutterwaveCharge({
              email,
              reference,
              amount,
              currency,
              metadata: meta,
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
