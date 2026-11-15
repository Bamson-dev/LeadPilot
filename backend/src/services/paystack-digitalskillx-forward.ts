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

export const DIGITALSKILLX_AI_ADS_PRODUCT_KEY = "ai-ads-automation-masterclass";
export const DIGITALSKILLX_AI_ADS_PAGE_SLUG = "ai-ads-masterclass";
export const DIGITALSKILLX_AI_ADS_AMOUNT_KOBO = 1_499_900;
export const DIGITALSKILLX_AI_ADS_CURRENCY = "NGN";
export const DIGITALSKILLX_AI_ADS_COURSE_ID = "4e2a16b5-bbfb-4a00-939c-87c7eb5f2afb";

/**
 * Products this router may hand to DigitalSkillX. Each one has its own key,
 * payment page slug, expected amount and course. Adding a product here is the
 * only router change needed. The DigitalSkillX catalog must carry the same
 * key, amount and course ID or the handoff is rejected on that side.
 */
export type DigitalSkillXRouterProduct = {
  key: string;
  pageSlugs: readonly string[];
  amountKobo: number;
  currency: string;
  courseId: string;
  /** Accept the legacy generic "digitalskillx" metadata tag as evidence. */
  acceptsGenericTag: boolean;
};

export const DIGITALSKILLX_AIAPP_PRODUCT: DigitalSkillXRouterProduct = {
  key: DIGITALSKILLX_AIAPP_PRODUCT_KEY,
  pageSlugs: [DIGITALSKILLX_AIAPP_PAGE_SLUG],
  amountKobo: DIGITALSKILLX_AIAPP_AMOUNT_KOBO,
  currency: DIGITALSKILLX_AIAPP_CURRENCY,
  courseId: DIGITALSKILLX_AIAPP_COURSE_ID,
  acceptsGenericTag: true,
};

export const DIGITALSKILLX_AI_ADS_PRODUCT: DigitalSkillXRouterProduct = {
  key: DIGITALSKILLX_AI_ADS_PRODUCT_KEY,
  pageSlugs: [DIGITALSKILLX_AI_ADS_PAGE_SLUG],
  amountKobo: DIGITALSKILLX_AI_ADS_AMOUNT_KOBO,
  currency: DIGITALSKILLX_AI_ADS_CURRENCY,
  courseId: DIGITALSKILLX_AI_ADS_COURSE_ID,
  acceptsGenericTag: false,
};

export const DIGITALSKILLX_ROUTER_PRODUCTS: readonly DigitalSkillXRouterProduct[] = [
  DIGITALSKILLX_AIAPP_PRODUCT,
  DIGITALSKILLX_AI_ADS_PRODUCT,
];

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

function hasProductPageIdentity(values: string[], product: DigitalSkillXRouterProduct): boolean {
  return values.some((value) => {
    const slug = pageSlugFromUrl(value);
    if (slug && product.pageSlugs.includes(slug)) return true;
    const lowered = value.toLowerCase();
    return product.pageSlugs.some((pageSlug) => lowered.includes(`pay/${pageSlug}`));
  });
}

function metadataMatchesProduct(
  meta: Record<string, unknown> | undefined,
  product: DigitalSkillXRouterProduct
): boolean {
  if (!meta) return false;

  const productKey = (metadataString(meta, "product_key") ?? metadataString(meta, "product"))?.toLowerCase();
  if (productKey === product.key) return true;
  const paymentPage = (
    metadataString(meta, "payment_page") ??
    metadataString(meta, "payment_page_slug") ??
    metadataString(meta, "page_slug")
  )?.toLowerCase();
  if (paymentPage && product.pageSlugs.some((slug) => paymentPage.includes(slug))) return true;

  const customFields = meta.custom_fields;
  if (Array.isArray(customFields)) {
    for (const field of customFields) {
      if (!field || typeof field !== "object") continue;
      const row = field as { variable_name?: string; value?: unknown };
      const name = String(row.variable_name ?? "").toLowerCase();
      const value = String(row.value ?? "").toLowerCase();
      if (value.includes(product.key)) return true;
      if (product.pageSlugs.some((slug) => value.includes(slug))) return true;
    }
  }

  const haystack: string[] = [];
  collectStrings(meta, haystack);
  return hasProductPageIdentity(haystack, product);
}

function hasLegacyGenericDigitalSkillXTag(meta: Record<string, unknown> | undefined): boolean {
  if (!meta) return false;
  const productKey = (metadataString(meta, "product_key") ?? metadataString(meta, "product"))?.toLowerCase();
  if (productKey === "digitalskillx") return true;

  const customFields = meta.custom_fields;
  if (!Array.isArray(customFields)) return false;
  return customFields.some((field) => {
    if (!field || typeof field !== "object") return false;
    const row = field as { variable_name?: string; value?: unknown };
    return String(row.variable_name ?? "").toLowerCase().includes("product") &&
      String(row.value ?? "").toLowerCase().includes("digitalskillx");
  });
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

type EvidenceKind = "metadata" | "page";

type EventData = NonNullable<DigitalSkillXPaystackEvent["data"]>;

function evidenceForProduct(
  data: EventData,
  meta: Record<string, unknown> | undefined,
  product: DigitalSkillXRouterProduct
): EvidenceKind | null {
  if (metadataMatchesProduct(meta, product)) return "metadata";
  const pageSlug = data.page?.slug?.toLowerCase();
  if (pageSlug && product.pageSlugs.some((slug) => pageSlug.includes(slug))) return "page";
  return null;
}

/**
 * Products that have identity evidence in the payload (metadata, referrer URL
 * or page slug). Amount is NOT checked here and never counts as evidence.
 */
export function findDigitalSkillXProductCandidates(
  data: EventData | undefined | null
): DigitalSkillXRouterProduct[] {
  if (!data) return [];
  const meta = parsePaystackMetadata(data.metadata);
  return DIGITALSKILLX_ROUTER_PRODUCTS.filter(
    (product) => evidenceForProduct(data, meta, product) !== null
  );
}

function amountAndCurrencyMatch(
  data: EventData,
  product: DigitalSkillXRouterProduct,
  evidence: EvidenceKind
): boolean {
  if (String(data.currency ?? "NGN").toUpperCase() !== product.currency) return false;
  if (evidence === "metadata") {
    return !(typeof data.amount === "number" && data.amount !== product.amountKobo);
  }
  return data.amount === product.amountKobo;
}

/**
 * Product identification, strongest signal first:
 *   1. explicit product metadata (product_key / product)
 *   2. payment page identity (page.slug, referrer URL, custom fields)
 *   3. exact amount + currency as a required corroborating check
 *
 * Amount alone never identifies the product. Two products may share a price.
 */
export function resolveDigitalSkillXProduct(
  data: EventData | undefined | null
): DigitalSkillXRouterProduct | null {
  if (!data) return null;
  const meta = parsePaystackMetadata(data.metadata);
  const candidates = findDigitalSkillXProductCandidates(data);
  if (candidates.length > 1) return null;
  if (candidates.length === 1) {
    const product = candidates[0];
    const evidence = evidenceForProduct(data, meta, product);
    return evidence && amountAndCurrencyMatch(data, product, evidence) ? product : null;
  }

  // Preserve the old generic DigitalSkillX marker for ai-app only. A specific
  // page or product identity always takes precedence over this weak legacy tag.
  if (hasLegacyGenericDigitalSkillXTag(meta) && DIGITALSKILLX_AIAPP_PRODUCT.acceptsGenericTag &&
      amountAndCurrencyMatch(data, DIGITALSKILLX_AIAPP_PRODUCT, "metadata")) {
    return DIGITALSKILLX_AIAPP_PRODUCT;
  }
  return null;
}

export function isDigitalSkillXPaystackEvent(event: DigitalSkillXPaystackEvent): boolean {
  return resolveDigitalSkillXProduct(event.data) !== null;
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
  verified: PaystackVerifiedTransaction,
  product: DigitalSkillXRouterProduct = DIGITALSKILLX_AIAPP_PRODUCT
): DigitalSkillXFulfillmentPayload {
  return {
    event: "charge.success",
    source: "leadthur-paystack-router",
    product_key: product.key,
    course_id: product.courseId,
    reference: verified.reference,
    amount: verified.amount,
    currency: String(verified.currency ?? product.currency).toUpperCase(),
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

  // Identify the product from verified data, not the webhook payload.
  const verifiedEventData: EventData = {
    reference: verified.reference,
    amount: verified.amount,
    currency: verifiedCurrency,
    metadata: parsePaystackMetadata(verified.metadata ?? undefined),
    page: verified.page ?? null,
  };
  const candidates = findDigitalSkillXProductCandidates(verifiedEventData);
  const verifiedMeta = parsePaystackMetadata(verified.metadata ?? undefined);

  // Conflicting specific identifiers must never be resolved by catalog order.
  if (candidates.length > 1) {
    logger.warn("DigitalSkillX routing rejected: conflicting product evidence", {
      reference,
      productKeys: candidates.map((candidate) => candidate.key),
    });
    return { outcome: "rejected", reason: "ambiguous_product_evidence" };
  }

  // Generic legacy DigitalSkillX metadata only maps to ai-app when no specific
  // product/page identity exists. A masterclass page slug therefore wins.
  const product = candidates[0] ?? (
    hasLegacyGenericDigitalSkillXTag(verifiedMeta) ? DIGITALSKILLX_AIAPP_PRODUCT : undefined
  );
  if (!product) {
    logger.warn("DigitalSkillX routing rejected: product not confirmed on verified data", {
      reference,
    });
    return { outcome: "rejected", reason: "product_not_confirmed" };
  }

  if (verifiedCurrency !== product.currency) {
    logger.warn("DigitalSkillX routing rejected: currency mismatch", {
      reference,
      productKey: product.key,
      currency: verifiedCurrency,
    });
    return { outcome: "rejected", reason: "currency_mismatch" };
  }

  if (verified.amount !== product.amountKobo) {
    logger.warn("DigitalSkillX routing rejected: amount mismatch", {
      reference,
      productKey: product.key,
      amount: verified.amount,
    });
    return { outcome: "rejected", reason: "amount_mismatch" };
  }

  const email = verified.customer?.email?.trim().toLowerCase();
  if (!email) {
    logger.error("DigitalSkillX routing rejected: verified transaction has no customer email", {
      reference,
    });
    return { outcome: "rejected", reason: "missing_customer_email" };
  }

  const payload = buildDigitalSkillXPayload({ ...verified, customer: { email } }, product);
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
      productKey: product.key,
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
      productKey: product.key,
      digitalskillxStatus: result.status,
    });
  } else {
    logger.error("DigitalSkillX rejected the forwarded charge", {
      reference,
      productKey: product.key,
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
