import {
  createLicenseKey,
  getLicenseByPaymentReference,
} from "../database/license-repository";
import {
  LIFETIME_PRICE_KOBO,
  SALE_PRICE_USD,
} from "../constants/pricing";
import { createCommissionForReferral } from "./license-service";
import { sendAccessEmail, sendPaymentConfirmationEmail } from "./email";
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

  if (metadata.meta && typeof metadata.meta === "object") {
    const nested = metadata.meta as Record<string, unknown>;
    if (typeof nested.ref_code === "string" && nested.ref_code.trim()) {
      return nested.ref_code.trim();
    }
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

function validatePaymentAmount(
  gateway: PaymentGateway,
  amount: number,
  currency: string
): void {
  if (gateway === "paystack") {
    if (amount < LIFETIME_PRICE_KOBO) {
      throw new Error(`Paystack payment amount too low: ${amount} kobo`);
    }
    return;
  }

  const cur = currency.toUpperCase();
  if (cur !== "USD") {
    throw new Error(`Flutterwave payment must be USD, got ${currency}`);
  }
  if (amount + 0.001 < SALE_PRICE_USD) {
    throw new Error(`Flutterwave payment amount too low: ${amount} USD`);
  }
}

function formatPaymentAmount(
  gateway: PaymentGateway,
  amount: number,
  currency: string
): string {
  if (gateway === "paystack") {
    return `₦${Math.round(amount / 100).toLocaleString()}`;
  }
  return `$${amount.toFixed(2)} ${currency.toUpperCase()}`;
}

/** Idempotent: create license, send activation email, record affiliate commission. */
export async function fulfillPayment(params: {
  email: string;
  reference: string;
  gateway: PaymentGateway;
  amount: number;
  currency: string;
  metadata?: Record<string, unknown>;
}): Promise<FulfillPaymentResult> {
  const email = params.email.toLowerCase().trim();
  const reference = params.reference.trim();

  validatePaymentAmount(params.gateway, params.amount, params.currency);

  const existing = await getLicenseByPaymentReference(reference);
  if (existing) {
    logger.info("Payment already fulfilled — skipping duplicate", {
      reference,
      email,
      gateway: params.gateway,
    });
    return {
      alreadyFulfilled: true,
      licenseKey: existing.key,
      emailSent: false,
      commissionCreated: false,
      commissionSkippedReason: "already_fulfilled",
    };
  }

  const paymentChannel = params.gateway === "flutterwave" ? "flutterwave" : "paystack";

  const license = await createLicenseKey({
    email,
    paymentReference: reference,
    paymentChannel,
  });

  let emailSent = false;
  try {
    const paymentAmount = formatPaymentAmount(
      params.gateway,
      params.amount,
      params.currency
    );
    await sendAccessEmail(email, license.key);
    await sendPaymentConfirmationEmail(email, paymentAmount);
    emailSent = true;
  } catch (error) {
    logger.error("Email send failed", {
      userEmail: email,
      reference,
      gateway: params.gateway,
      keyPrefix: license.key.slice(0, 12),
      error,
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
      logger.info("Commission recorded for referral", { refCode, referred: email });
    } catch (err) {
      commissionSkippedReason = err instanceof Error ? err.message : "commission_failed";
      logger.error("Commission creation failed", {
        refCode,
        referred: email,
        error: commissionSkippedReason,
      });
    }
  }

  logger.info("Payment fulfilled", {
    email,
    reference,
    gateway: params.gateway,
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

/** Paystack webhook / verify (amount in kobo). */
export async function fulfillPaystackCharge(params: {
  email: string;
  reference: string;
  amount: number;
  metadata?: Record<string, unknown>;
}): Promise<FulfillPaymentResult> {
  return fulfillPayment({
    email: params.email,
    reference: params.reference,
    gateway: "paystack",
    amount: params.amount,
    currency: "NGN",
    metadata: params.metadata,
  });
}

/** Flutterwave webhook / verify (amount in USD). */
export async function fulfillFlutterwaveCharge(params: {
  email: string;
  reference: string;
  amount: number;
  currency: string;
  metadata?: Record<string, unknown>;
}): Promise<FulfillPaymentResult> {
  return fulfillPayment({
    email: params.email,
    reference: params.reference,
    gateway: "flutterwave",
    amount: params.amount,
    currency: params.currency,
    metadata: params.metadata,
  });
}
