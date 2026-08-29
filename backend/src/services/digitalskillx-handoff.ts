import crypto from "crypto";

/**
 * Signed internal handoff for LeadThur -> DigitalSkillX fulfillment.
 *
 * Mirrors the Paystack webhook security model already used in this codebase:
 * an HMAC over the exact bytes that are transmitted, verified by the receiver.
 * Timestamp + nonce are folded into the signed material so a captured request
 * cannot be replayed after the freshness window.
 */

export const DIGITALSKILLX_SIGNATURE_HEADER = "x-leadthur-signature";
export const DIGITALSKILLX_TIMESTAMP_HEADER = "x-leadthur-timestamp";
export const DIGITALSKILLX_NONCE_HEADER = "x-leadthur-nonce";
export const DIGITALSKILLX_EVENT_ID_HEADER = "x-leadthur-event-id";
export const DIGITALSKILLX_PRODUCT_HEADER = "x-leadthur-product-key";

/** Receiver must reject anything older than this. */
export const DIGITALSKILLX_MAX_CLOCK_SKEW_SECONDS = 300;

export function getDigitalSkillXForwardSecret(): string {
  return process.env.DIGITALSKILLX_FORWARD_SECRET?.trim() ?? "";
}

/**
 * Signed material is `${timestamp}.${nonce}.${body}`. Binding the timestamp and
 * nonce into the MAC prevents an attacker from replaying a valid body with a
 * fresh timestamp.
 */
export function buildSignedPayload(params: {
  timestamp: string;
  nonce: string;
  body: string;
}): string {
  return `${params.timestamp}.${params.nonce}.${params.body}`;
}

export function signDigitalSkillXPayload(params: {
  secret: string;
  timestamp: string;
  nonce: string;
  body: string;
}): string {
  const signed = buildSignedPayload({
    timestamp: params.timestamp,
    nonce: params.nonce,
    body: params.body,
  });
  return crypto.createHmac("sha256", params.secret).update(signed).digest("hex");
}

/** Constant-time hex digest comparison. */
export function safeEqualHex(a: string, b: string): boolean {
  if (typeof a !== "string" || typeof b !== "string") return false;
  if (a.length !== b.length || a.length === 0) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(a, "utf8"), Buffer.from(b, "utf8"));
  } catch {
    return false;
  }
}

export type HandoffVerification =
  | { valid: true }
  | { valid: false; reason: "not_configured" | "missing_headers" | "stale_timestamp" | "bad_signature" };

/**
 * Reference implementation of the receiver-side check. DigitalSkillX must run
 * the equivalent of this before enrolling, plus its own nonce replay store.
 */
export function verifyDigitalSkillXHandoff(params: {
  secret: string;
  signature?: string;
  timestamp?: string;
  nonce?: string;
  body: string;
  nowSeconds?: number;
  maxSkewSeconds?: number;
}): HandoffVerification {
  if (!params.secret) return { valid: false, reason: "not_configured" };
  if (!params.signature || !params.timestamp || !params.nonce) {
    return { valid: false, reason: "missing_headers" };
  }

  const ts = Number(params.timestamp);
  if (!Number.isFinite(ts)) return { valid: false, reason: "stale_timestamp" };

  const now = params.nowSeconds ?? Math.floor(Date.now() / 1000);
  const skew = Math.abs(now - ts);
  if (skew > (params.maxSkewSeconds ?? DIGITALSKILLX_MAX_CLOCK_SKEW_SECONDS)) {
    return { valid: false, reason: "stale_timestamp" };
  }

  const expected = signDigitalSkillXPayload({
    secret: params.secret,
    timestamp: params.timestamp,
    nonce: params.nonce,
    body: params.body,
  });

  if (!safeEqualHex(expected, params.signature)) {
    return { valid: false, reason: "bad_signature" };
  }

  return { valid: true };
}

export function buildDigitalSkillXHandoffHeaders(params: {
  secret: string;
  body: string;
  eventId: string;
  productKey: string;
  nowSeconds?: number;
  nonce?: string;
}): Record<string, string> {
  const timestamp = String(params.nowSeconds ?? Math.floor(Date.now() / 1000));
  const nonce = params.nonce ?? crypto.randomUUID();
  const signature = signDigitalSkillXPayload({
    secret: params.secret,
    timestamp,
    nonce,
    body: params.body,
  });

  return {
    [DIGITALSKILLX_SIGNATURE_HEADER]: `sha256=${signature}`,
    [DIGITALSKILLX_TIMESTAMP_HEADER]: timestamp,
    [DIGITALSKILLX_NONCE_HEADER]: nonce,
    [DIGITALSKILLX_EVENT_ID_HEADER]: params.eventId,
    [DIGITALSKILLX_PRODUCT_HEADER]: params.productKey,
  };
}
