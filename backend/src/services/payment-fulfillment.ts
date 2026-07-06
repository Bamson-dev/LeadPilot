import {
  createLicenseKey,
  getLicenseByPaymentReference,
} from "../database/license-repository";
import {
  LIFETIME_PRICE_KOBO,
  SALE_PRICE_USD,
} from "../constants/pricing";
import {
  getOutreachCreditPack,
  getOutreachSubscriptionTier,
} from "../constants/outreach-pricing";
import {
  activateOutreachSubscription,
  creditPurchasedPack,
  ensureUserIdForEmail,
  enterOutreachGracePeriod,
  findOutreachUserByPaystackSubscription,
  storePaystackSubscription,
} from "../database/outreach-repository";
import { createCommissionForReferral } from "./license-service";
import { sendAccessEmail, sendPaymentConfirmationEmail } from "./email";
import { markTrialSignupConverted } from "../database/free-trial-repository";
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

  try {
    await markTrialSignupConverted(email);
  } catch (error) {
    logger.error("Failed to mark trial signup as converted", { userEmail: email, error });
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

// --- Outreach payments (subscriptions + credit packs) ---

export type OutreachCheckoutType = "subscription" | "pack";

export function parseOutreachPaystackMetadata(
  metadata: Record<string, unknown> | string | undefined
): Record<string, unknown> | null {
  if (!metadata) return null;
  let meta: Record<string, unknown>;
  if (typeof metadata === "string") {
    try {
      meta = JSON.parse(metadata) as Record<string, unknown>;
    } catch {
      return null;
    }
  } else {
    meta = metadata;
  }

  const checkoutType = meta.outreach_type ?? meta.type;
  if (checkoutType === "subscription" || checkoutType === "pack") {
    return meta;
  }
  return null;
}

export function isOutreachPaystackMetadata(
  metadata: Record<string, unknown> | string | undefined
): boolean {
  return parseOutreachPaystackMetadata(metadata) !== null;
}

function readMetaUserId(metadata: Record<string, unknown>): string | null {
  const raw = metadata.user_id ?? metadata.userId;
  return typeof raw === "string" && raw.trim() ? raw.trim() : null;
}

function readMetaTier(metadata: Record<string, unknown>): string | null {
  const raw = metadata.tier ?? metadata.tier_id;
  return typeof raw === "string" && raw.trim() ? raw.trim() : null;
}

function readMetaPackId(metadata: Record<string, unknown>): string | null {
  const raw = metadata.pack_id ?? metadata.packId;
  return typeof raw === "string" && raw.trim() ? raw.trim() : null;
}

export async function fulfillOutreachPackCharge(params: {
  reference: string;
  metadata: Record<string, unknown>;
}): Promise<{ processed: boolean; duplicate: boolean; credits?: number }> {
  const userId = readMetaUserId(params.metadata);
  const packId = readMetaPackId(params.metadata);
  const pack = packId ? getOutreachCreditPack(packId) : undefined;

  if (!userId || !pack) {
    logger.error("Outreach pack webhook missing user_id or pack_id", {
      reference: params.reference,
      metadata: params.metadata,
    });
    return { processed: false, duplicate: false };
  }

  const result = await creditPurchasedPack({
    userId,
    credits: pack.credits,
    reference: params.reference,
  });

  if (result.duplicate) {
    logger.info("Outreach pack webhook duplicate skipped", { reference: params.reference });
  } else if (result.credited) {
    logger.info("Outreach pack credited", {
      reference: params.reference,
      userId,
      packId: pack.id,
      credits: pack.credits,
    });
  }

  return { ...result, processed: result.credited, credits: pack.credits };
}

export async function fulfillOutreachSubscriptionCharge(params: {
  reference: string;
  metadata: Record<string, unknown>;
  renewsAt?: string | null;
  subscriptionCode?: string | null;
}): Promise<{ processed: boolean; duplicate: boolean; tier?: string }> {
  const userId = readMetaUserId(params.metadata);
  const tierId = readMetaTier(params.metadata);
  const tier = tierId ? getOutreachSubscriptionTier(tierId) : undefined;

  if (!userId || !tier) {
    logger.error("Outreach subscription webhook missing user_id or tier", {
      reference: params.reference,
      metadata: params.metadata,
    });
    return { processed: false, duplicate: false };
  }

  const result = await activateOutreachSubscription({
    userId,
    tier: tier.id,
    monthlyAllowance: tier.monthlyAllowance,
    maxMailboxes: tier.maxMailboxes,
    reference: params.reference,
    renewsAt: params.renewsAt,
    subscriptionCode: params.subscriptionCode,
  });

  if (result.duplicate) {
    logger.info("Outreach subscription webhook duplicate skipped", { reference: params.reference });
  } else if (result.applied) {
    logger.info("Outreach subscription activated/refilled", {
      reference: params.reference,
      userId,
      tier: tier.id,
      allowance: tier.monthlyAllowance,
    });
  }

  return { ...result, processed: result.applied, tier: tier.id };
}

export async function handleOutreachSubscriptionLifecycle(params: {
  event: string;
  data: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  const subscription = (params.data.subscription ?? params.data) as Record<string, unknown>;
  const subscriptionCode =
    (typeof subscription.subscription_code === "string" && subscription.subscription_code) ||
    (typeof params.data.subscription_code === "string" && params.data.subscription_code) ||
    null;

  const nextPaymentDate =
    (typeof subscription.next_payment_date === "string" && subscription.next_payment_date) ||
    (typeof params.data.next_payment_date === "string" && params.data.next_payment_date) ||
    null;

  let userId = params.metadata ? readMetaUserId(params.metadata) : null;

  if (!userId && subscriptionCode) {
    userId = await findOutreachUserByPaystackSubscription(subscriptionCode);
  }

  const customer = params.data.customer as { email?: string } | undefined;
  if (!userId && customer?.email) {
    userId = await ensureUserIdForEmail(customer.email);
  }

  if (
    (params.event === "subscription.create" || params.event === "subscription.enable") &&
    userId &&
    subscriptionCode
  ) {
    await storePaystackSubscription({
      userId,
      subscriptionCode,
      renewsAt: nextPaymentDate,
    });
    logger.info("Outreach Paystack subscription stored", {
      userId,
      subscriptionCode,
      event: params.event,
    });
    return;
  }

  if (
    (params.event === "invoice.payment_failed" || params.event === "subscription.disable") &&
    userId
  ) {
    await enterOutreachGracePeriod(userId);
    logger.info("Outreach account entered grace period", {
      userId,
      event: params.event,
    });
  }
}

export async function processOutreachPaystackWebhookEvent(event: {
  event?: string;
  data?: Record<string, unknown> & {
    customer?: { email?: string };
    reference?: string;
    amount?: number;
    metadata?: Record<string, unknown> | string;
    subscription?: Record<string, unknown>;
    subscription_code?: string;
    next_payment_date?: string;
  };
}): Promise<void> {
  const eventName = event.event ?? "";
  const data = event.data ?? {};
  const metadata = parseOutreachPaystackMetadata(data.metadata) ?? undefined;

  if (
    eventName === "subscription.create" ||
    eventName === "subscription.enable" ||
    eventName === "invoice.payment_failed" ||
    eventName === "subscription.disable"
  ) {
    await handleOutreachSubscriptionLifecycle({
      event: eventName,
      data: data as Record<string, unknown>,
      metadata,
    });
    return;
  }

  if (eventName !== "charge.success") return;

  const reference = data.reference;
  if (!reference || !metadata) return;

  const checkoutType = (metadata.outreach_type ?? metadata.type) as string;

  if (checkoutType === "pack") {
    await fulfillOutreachPackCharge({ reference, metadata });
    return;
  }

  if (checkoutType === "subscription") {
    const subscription = (data.subscription ?? {}) as Record<string, unknown>;
    const subscriptionCode =
      (typeof subscription.subscription_code === "string" && subscription.subscription_code) ||
      (typeof data.subscription_code === "string" ? data.subscription_code : null);
    const renewsAt =
      (typeof subscription.next_payment_date === "string" && subscription.next_payment_date) ||
      (typeof data.next_payment_date === "string" ? data.next_payment_date : null);

    await fulfillOutreachSubscriptionCharge({
      reference,
      metadata,
      renewsAt,
      subscriptionCode,
    });
  }
}
