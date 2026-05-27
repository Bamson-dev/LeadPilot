import {
  createLicenseKey,
  getLicenseByPaymentReference,
} from "../database/license-repository";
import {
  LIFETIME_PRICE_KOBO,
  SALE_PRICE_USD,
} from "../constants/pricing";
import { createCommissionForReferral } from "./license-service";
import { sendActivationEmail } from "./brevo-service";
import { logger } from "../utils/logger";

export type PaymentGateway = "paystack" | "flutterwave";

export function extractRefCodeFromMetadata(
  metadata: Record<string, unknown> | undefined
): string | null {
  if (!metadata) return null;

  const direct = metadata.ref_code;
  if (typeof direct === "string" && direct.trim()) {
    return direct.trim();
  }

  if (Array.isArray(metadata.custom_fields)) {
    const field = (
      metadata.custom_fields as Array<{ variable_name?: string; value?: unknown }>
    ).find((f) => f.variable_name === "ref_code");
    if (field?.value != null && String(field.value).trim()) {
      return String(field.value).trim();
    }
  }

  return null;
}

export interface FulfillPaymentResult {
  alreadyFulfilled: boolean;
  licenseKey?: string;
  emailSent: boolean;
  commissionCreated: boolean;
  commissionSkippedReason?: string;
}

/** Shared idempotent fulfillment for Paystack and Flutterwave. */
export async function fulfillLifetimePurchase(params: {
  email: string;
  reference: string;
  paymentChannel: PaymentGateway;
  metadata?: Record<string, unknown>;
}): Promise<FulfillPaymentResult> {
  const email = params.email.toLowerCase().trim();
  const reference = params.reference.trim();

  const existing = await getLicenseByPaymentReference(reference);
  if (existing) {
    logger.info("Payment already fulfilled — skipping duplicate", {
      reference,
      email,
      gateway: params.paymentChannel,
    });
    return {
      alreadyFulfilled: true,
      licenseKey: existing.key,
      emailSent: false,
      commissionCreated: false,
      commissionSkippedReason: "already_fulfilled",
    };
  }

  const license = await createLicenseKey({
    email,
    paymentReference: reference,
    paymentChannel: params.paymentChannel,
  });

  let emailSent = false;
  try {
    await sendActivationEmail(email, license.key);
    emailSent = true;
  } catch (err) {
    logger.error("Activation email failed after license created", {
      email,
      reference,
      gateway: params.paymentChannel,
      keyPrefix: license.key.slice(0, 12),
      error: err instanceof Error ? err.message : "unknown",
    });
  }

  const refCode = extractRefCodeFromMetadata(params.metadata);
  let commissionCreated = false;
  let commissionSkippedReason: string | undefined;

  if (!refCode) {
    commissionSkippedReason = "no_ref_code_in_payment";
  } else {
    try {
      await createCommissionForReferral({ refCode, referredEmail: email });
      commissionCreated = true;
      logger.info("Commission recorded for referral", {
        refCode,
        referred: email,
        gateway: params.paymentChannel,
      });
    } catch (err) {
      commissionSkippedReason = err instanceof Error ? err.message : "commission_failed";
      logger.error("Commission creation failed", {
        refCode,
        referred: email,
        error: commissionSkippedReason,
      });
    }
  }

  logger.info("Lifetime purchase fulfilled", {
    email,
    reference,
    gateway: params.paymentChannel,
    emailSent,
    commissionCreated,
    commissionSkippedReason,
  });

  return {
    alreadyFulfilled: false,
    licenseKey: license.key,
    emailSent,
    commissionCreated,
    commissionSkippedReason,
  };
}

/** Idempotent Paystack fulfillment (NGN, kobo). */
export async function fulfillPaystackCharge(params: {
  email: string;
  reference: string;
  amount: number;
  metadata?: Record<string, unknown>;
}): Promise<FulfillPaymentResult> {
  if (params.amount < LIFETIME_PRICE_KOBO) {
    throw new Error(`Payment amount too low: ${params.amount} kobo`);
  }

  return fulfillLifetimePurchase({
    email: params.email,
    reference: params.reference,
    paymentChannel: "paystack",
    metadata: params.metadata,
  });
}

/** Idempotent Flutterwave fulfillment (USD). */
export async function fulfillFlutterwaveCharge(params: {
  email: string;
  reference: string;
  amount: number;
  currency: string;
  metadata?: Record<string, unknown>;
}): Promise<FulfillPaymentResult> {
  const currency = params.currency.toUpperCase();
  if (currency !== "USD") {
    throw new Error(`Unexpected Flutterwave currency: ${currency}`);
  }
  if (params.amount < SALE_PRICE_USD) {
    throw new Error(`Payment amount too low: ${params.amount} USD`);
  }

  return fulfillLifetimePurchase({
    email: params.email,
    reference: params.reference,
    paymentChannel: "flutterwave",
    metadata: params.metadata,
  });
}
