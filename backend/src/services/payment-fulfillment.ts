import {
  createLicenseKey,
  getLicenseByPaymentReference,
} from "../database/license-repository";
import { LIFETIME_PRICE_KOBO } from "../constants/pricing";
import { createCommissionForReferral } from "./license-service";
import { sendActivationEmail } from "./brevo-service";
import { logger } from "../utils/logger";

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

/** Idempotent: create license, send activation email, record affiliate commission. */
export async function fulfillPaystackCharge(params: {
  email: string;
  reference: string;
  amount: number;
  metadata?: Record<string, unknown>;
}): Promise<FulfillPaymentResult> {
  const email = params.email.toLowerCase().trim();
  const reference = params.reference.trim();

  if (params.amount < LIFETIME_PRICE_KOBO) {
    throw new Error(`Payment amount too low: ${params.amount} kobo`);
  }

  const existing = await getLicenseByPaymentReference(reference);
  if (existing) {
    let emailSent = false;
    try {
      await sendActivationEmail(email, existing.key);
      emailSent = true;
    } catch (err) {
      logger.warn("Activation email resend skipped for existing payment", {
        reference,
        error: err instanceof Error ? err.message : "unknown",
      });
    }

    const refCode = extractRefCodeFromMetadata(params.metadata);
    let commissionCreated = false;
    let commissionSkippedReason: string | undefined = "already_fulfilled";

    if (refCode) {
      try {
        await createCommissionForReferral({ refCode, referredEmail: email });
        commissionCreated = true;
        commissionSkippedReason = undefined;
      } catch (err) {
        commissionSkippedReason = err instanceof Error ? err.message : "commission_failed";
      }
    }

    return {
      alreadyFulfilled: true,
      licenseKey: existing.key,
      emailSent,
      commissionCreated,
      commissionSkippedReason,
    };
  }

  const license = await createLicenseKey({
    email,
    paymentReference: reference,
    paymentChannel: "paystack",
  });

  let emailSent = false;
  try {
    await sendActivationEmail(email, license.key);
    emailSent = true;
  } catch (err) {
    logger.error("Activation email failed after license created", {
      email,
      reference,
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

  logger.info("Paystack payment fulfilled", {
    email,
    reference,
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
