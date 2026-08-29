import { logger } from "../utils/logger";
import { parsePaystackMetadata } from "./paystack-webhook-forward";
import { verifyTransaction, type PaystackVerifiedTransaction } from "./paystack-client";
import {
  buildDigitalSkillXHandoffHeaders,
  getDigitalSkillXForwardSecret,
} from "./digitalskillx-handoff";

export const DIGITALSKILLX_PAYSTACK_WEBHOOK_URL =
  process.env.DIGITALSKILLX_PAYSTACK_WEBHOOK_URL?.trim() ||
  "https://www.digitalskillx.com/api/webhooks/paystack";

export const DIGITALSKILLX_AIAPP_PRODUCT_KEY = "build-software-with-ai";
export const DIGITALSKILLX_AIAPP_PAGE_SLUG = "aiapp";
export const DIGITALSKILLX_AIAPP_AMOUNT_KOBO = 4_999_900;
export const DIGITALSKILLX_AIAPP_CURRENCY = "NGN";
export const DIGITALSKILLX_AIAPP_COURSE_ID = "9818cf69-4158-40b5-8926-54a3be38f306";

const FORWARD_TIMEOUT_MS = 8_000;

/** Forwards are only marked done after DigitalSkillX acknowledges with 2xx. */
const FORWARD_IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000;
const forwardedReferences = new Map<string, number>();

function pruneForwardCache(now: number): void {
  for (const [reference, expiresAt] of forwardedReferences) {
    if (expiresAt <= now) forwardedReferences.delete(reference);
  }
}

export function hasAlreadyForwarded(reference: string, now = Date.now()): boolean {
  pruneForwardCache(now);
  const expiresAt = forwardedReferences.get(reference);
  return typeof expiresAt === "number" && expiresAt > now;
}

export function markForwarded(reference: string, now = Date.now()): void {
  forwardedReferences.set(reference, now + FORWARD_IDEMPOTENCY_TTL_MS);
}

/** Test seam only. */
export function resetDigitalSkillXForwardCache(): void {
  forwardedReferences.clear();
}

function metadataString(meta: Record<string, unknown> | undefined, key: string): string | null {
  const raw = meta?.[key];
  if (typeof raw === "string" && raw.trim()) return raw.trim();
  return null;
}

function pageSlugFromUrl(value: string): string | null {
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    if (!host.endsWith("paystack.com") && !host.endsWith("paystack.shop")) return null;
    const parts = url.pathname.split("/").filter(Boolean);
    const payIndex = parts.findIndex((part) => part.toLowerCase() === "pay");
    if (payIndex >= 0 && parts[payIndex + 1]) {
      return parts[payIndex + 1].toLowerCase();
    }
  } catch {
    return null;
  }
  return null;
}

function collectStrings(value: unknown, out: string[], depth = 0): void {
  if (depth > 6 || value == null) return;
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    const text = String(value).trim();
    if (text) out.push(text);
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectStrings(item, out, depth + 1);
    return;
  }
  if (typeof value === "object") {
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      out.push(key);
      collectStrings(nested, out, depth + 1);
    }
  }
}

function hasAiappPageIdentity(values: string[]): boolean {
  return values.some((value) => {
    const slug = pageSlugFromUrl(value);
    if (slug === DIGITALSKILLX_AIAPP_PAGE_SLUG) return true;
    return value.toLowerCase().includes(`pay/${DIGITALSKILLX_AIAPP_PAGE_SLUG}`);
  });
}

function metadataMatchesDigitalSkillX(meta: Record<string, unknown> | undefined): boolean {
  if (!meta) return false;

  const productKey = metadataString(meta, "product_key") ?? metadataString(meta, "product");
  if (productKey?.toLowerCase() === DIGITALSKILLX_AIAPP_PRODUCT_KEY) return true;
  if (productKey?.toLowerCase() === "digitalskillx") return true;

  const paymentPage =
    metadataString(meta, "payment_page") ??
    metadataString(meta, "payment_page_slug") ??
    metadataString(meta, "page_slug");
  if (paymentPage?.toLowerCase().includes(DIGITALSKILLX_AIAPP_PAGE_SLUG)) return true;

  const customFields = meta.custom_fields;
  if (Array.isArray(customFields)) {
    for (const field of customFields) {
      if (!field || typeof field !== "object") continue;
      const row = field as { variable_name?: string; value?: unknown };
      const name = String(row.variable_name ?? "").toLowerCase();
      const value = String(row.value ?? "").toLowerCase();
      if (value.includes(DIGITALSKILLX_AIAPP_PRODUCT_KEY)) return true;
      if (value.includes(DIGITALSKILLX_AIAPP_PAGE_SLUG)) return true;
      if (name.includes("product") && value.includes("digitalskillx")) return true;
    }
  }

  const haystack: string[] = [];
  collectStrings(meta, haystack);
  return hasAiappPageIdentity(haystack);
}

export type DigitalSkillXPaystackEvent = {
  event?: string;
  data?: {
    reference?: string;
    amount?: number;
    currency?: string;
    metadata?: Record<string, unknown> | string;
    page?: { slug?: string; name?: string } | null;
  };
};

/**
 * Product identification, strongest signal first:
 *   1. explicit product metadata (product_key / product)
 *   2. payment page identity (page.slug, referrer URL, custom fields)
 *   3. exact amount + currency as a required corroborating check
 *
 * Amount alone never identifies the product.
 */
export function isDigitalSkillXPaystackEvent(event: DigitalSkillXPaystackEvent): boolean {
  const data = event.data;
  if (!data) return false;

  const meta = parsePaystackMetadata(data.metadata);
  if (metadataMatchesDigitalSkillX(meta)) {
    if (
      typeof data.amount === "number" &&
      data.amount !== DIGITALSKILLX_AIAPP_AMOUNT_KOBO
    ) {
      return false;
    }
    const currency = String(data.currency ?? "NGN").toUpperCase();
    if (currency !== DIGITALSKILLX_AIAPP_CURRENCY) return false;
    return true;
  }

  const pageSlug = data.page?.slug?.toLowerCase();
  if (pageSlug?.includes(DIGITALSKILLX_AIAPP_PAGE_SLUG)) {
    return (
      data.amount === DIGITALSKILLX_AIAPP_AMOUNT_KOBO &&
      String(data.currency ?? "NGN").toUpperCase() === DIGITALSKILLX_AIAPP_CURRENCY
    );
  }

  const haystack: string[] = [];
  collectStrings(meta, haystack);
  if (
    hasAiappPageIdentity(haystack) &&
    data.amount === DIGITALSKILLX_AIAPP_AMOUNT_KOBO &&
    String(data.currency ?? "NGN").toUpperCase() === DIGITALSKILLX_AIAPP_CURRENCY
  ) {
    return true;
  }

  return false;
}

/** Only fields DigitalSkillX needs to enroll. No secrets, no LeadThur internals. */
export type DigitalSkillXFulfillmentPayload = {
  event: "charge.success";
  source: "leadthur-paystack-router";
  product_key: string;
  course_id: string;
  reference: string;
  amount: number;
  currency: string;
  status: string;
  paid_at: string | null;
  customer: { email: string };
};

export function buildDigitalSkillXPayload(
  verified: PaystackVerifiedTransaction
): DigitalSkillXFulfillmentPayload {
  return {
    event: "charge.success",
    source: "leadthur-paystack-router",
    product_key: DIGITALSKILLX_AIAPP_PRODUCT_KEY,
    course_id: DIGITALSKILLX_AIAPP_COURSE_ID,
    reference: verified.reference,
    amount: verified.amount,
    currency: String(verified.currency ?? DIGITALSKILLX_AIAPP_CURRENCY).toUpperCase(),
    status: verified.status,
    paid_at: verified.paidAt ?? null,
    customer: { email: verified.customer.email.trim().toLowerCase() },
  };
}

export type DigitalSkillXRouteOutcome =
  | { outcome: "forwarded"; status: number; body: string; contentType: string | null }
  | { outcome: "duplicate" }
  | { outcome: "not_success"; status: string }
  | { outcome: "rejected"; reason: string }
  | { outcome: "retryable"; reason: string };

type ForwardDeps = {
  verify?: (reference: string) => Promise<PaystackVerifiedTransaction>;
  fetchImpl?: typeof fetch;
  now?: () => number;
  paystackSignature?: string;
  rawBody?: Buffer;
};

async function postToDigitalSkillX(params: {
  body: string;
  headers: Record<string, string>;
  fetchImpl: typeof fetch;
}): Promise<
  | { ok: true; status: number; body: string; contentType: string | null }
  | { ok: false; error: string }
> {
  try {
    const response = await params.fetchImpl(DIGITALSKILLX_PAYSTACK_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...params.headers },
      body: params.body,
      signal: AbortSignal.timeout(FORWARD_TIMEOUT_MS),
    });
    const text = await response.text();
    return {
      ok: true,
      status: response.status,
      body: text,
      contentType: response.headers.get("content-type"),
    };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "unknown" };
  }
}

/**
 * Verifies the transaction against the Paystack API and only then hands the
 * verified facts to DigitalSkillX over a signed server-to-server request.
 *
 * The webhook payload is never trusted for amount, currency, status or email.
 */
export async function routeDigitalSkillXCharge(
  params: { reference?: string; eventType?: string },
  deps: ForwardDeps = {}
): Promise<DigitalSkillXRouteOutcome> {
  const reference = params.reference?.trim();
  if (!reference) {
    return { outcome: "rejected", reason: "missing_reference" };
  }

  const now = deps.now ?? Date.now;

  if (hasAlreadyForwarded(reference, now())) {
    logger.info("DigitalSkillX forward skipped — already fulfilled", { reference });
    return { outcome: "duplicate" };
  }

  let verified: PaystackVerifiedTransaction;
  try {
    const verifyFn = deps.verify ?? verifyTransaction;
    verified = await verifyFn(reference);
  } catch (err) {
    logger.error("DigitalSkillX routing: Paystack verification failed", {
      reference,
      error: err instanceof Error ? err.message : "unknown",
    });
    return { outcome: "retryable", reason: "paystack_verify_failed" };
  }

  if (String(verified.status).toLowerCase() !== "success") {
    logger.info("DigitalSkillX routing: transaction not successful", {
      reference,
      status: verified.status,
    });
    return { outcome: "not_success", status: String(verified.status) };
  }

  const verifiedCurrency = String(verified.currency ?? "").toUpperCase();
  if (verifiedCurrency !== DIGITALSKILLX_AIAPP_CURRENCY) {
    logger.warn("DigitalSkillX routing rejected: currency mismatch", {
      reference,
      currency: verifiedCurrency,
    });
    return { outcome: "rejected", reason: "currency_mismatch" };
  }

  if (verified.amount !== DIGITALSKILLX_AIAPP_AMOUNT_KOBO) {
    logger.warn("DigitalSkillX routing rejected: amount mismatch", {
      reference,
      amount: verified.amount,
    });
    return { outcome: "rejected", reason: "amount_mismatch" };
  }

  // Re-run identification against verified data, not the webhook payload.
  const identified = isDigitalSkillXPaystackEvent({
    event: "charge.success",
    data: {
      reference: verified.reference,
      amount: verified.amount,
      currency: verifiedCurrency,
      metadata: parsePaystackMetadata(verified.metadata ?? undefined),
      page: verified.page ?? null,
    },
  });

  if (!identified) {
    logger.warn("DigitalSkillX routing rejected: product not confirmed on verified data", {
      reference,
    });
    return { outcome: "rejected", reason: "product_not_confirmed" };
  }

  const email = verified.customer?.email?.trim().toLowerCase();
  if (!email) {
    logger.error("DigitalSkillX routing rejected: verified transaction has no customer email", {
      reference,
    });
    return { outcome: "rejected", reason: "missing_customer_email" };
  }

  const payload = buildDigitalSkillXPayload({ ...verified, customer: { email } });
  const secret = getDigitalSkillXForwardSecret();
  const fetchImpl = deps.fetchImpl ?? fetch;

  let body: string;
  let headers: Record<string, string>;

  if (secret) {
    body = JSON.stringify(payload);
    headers = buildDigitalSkillXHandoffHeaders({
      secret,
      body,
      eventId: reference,
      productKey: DIGITALSKILLX_AIAPP_PRODUCT_KEY,
      nowSeconds: Math.floor(now() / 1000),
    });
  } else if (deps.rawBody && deps.paystackSignature) {
    // Legacy passthrough: DigitalSkillX verifies the original Paystack signature.
    logger.warn(
      "DigitalSkillX signing key not configured — falling back to Paystack signature passthrough",
      { reference }
    );
    body = deps.rawBody.toString("utf8");
    headers = { "x-paystack-signature": deps.paystackSignature };
  } else {
    logger.error("DigitalSkillX routing rejected: no handoff credential available", { reference });
    return { outcome: "rejected", reason: "handoff_not_configured" };
  }

  const result = await postToDigitalSkillX({ body, headers, fetchImpl });

  if (!result.ok) {
    logger.error("DigitalSkillX forward failed", {
      reference,
      error: result.error,
      targetUrl: DIGITALSKILLX_PAYSTACK_WEBHOOK_URL,
    });
    return { outcome: "retryable", reason: "forward_failed" };
  }

  if (result.status >= 500) {
    logger.error("DigitalSkillX returned server error", {
      reference,
      digitalskillxStatus: result.status,
    });
    return { outcome: "retryable", reason: "digitalskillx_server_error" };
  }

  if (result.status >= 200 && result.status < 300) {
    markForwarded(reference, now());
    logger.info("Paystack charge fulfilled via DigitalSkillX", {
      reference,
      digitalskillxStatus: result.status,
    });
  } else {
    logger.error("DigitalSkillX rejected the forwarded charge", {
      reference,
      digitalskillxStatus: result.status,
    });
  }

  return {
    outcome: "forwarded",
    status: result.status,
    body: result.body,
    contentType: result.contentType,
  };
}
