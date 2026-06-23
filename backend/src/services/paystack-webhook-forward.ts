import { logger } from "../utils/logger";

export const MAILTHUR_PAYSTACK_WEBHOOK_URL =
  "https://backend.mailthur.com/webhooks/paystack/billing";

const FORWARD_TIMEOUT_MS = 5_000;

export function parsePaystackMetadata(
  metadata: Record<string, unknown> | string | undefined
): Record<string, unknown> | undefined {
  if (!metadata) return undefined;
  if (typeof metadata === "string") {
    try {
      return JSON.parse(metadata) as Record<string, unknown>;
    } catch {
      return undefined;
    }
  }
  if (typeof metadata === "object") return metadata;
  return undefined;
}

export function isMailthurPaystackEvent(
  metadata: Record<string, unknown> | string | undefined
): boolean {
  const parsed = parsePaystackMetadata(metadata);
  return parsed?.product === "mailthur";
}

export async function forwardPaystackWebhookToMailthur(
  rawBody: Buffer,
  signature: string
): Promise<
  | { ok: true; status: number; body: string; contentType: string | null }
  | { ok: false; error: string }
> {
  try {
    const response = await fetch(MAILTHUR_PAYSTACK_WEBHOOK_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-paystack-signature": signature,
      },
      body: new Uint8Array(rawBody),
      signal: AbortSignal.timeout(FORWARD_TIMEOUT_MS),
    });

    const body = await response.text();
    return {
      ok: true,
      status: response.status,
      body,
      contentType: response.headers.get("content-type"),
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "unknown",
    };
  }
}

export async function handleMailthurPaystackForward(params: {
  rawBody: Buffer;
  signature: string;
  reference?: string;
  eventType?: string;
}): Promise<
  | { forwarded: true; status: number; body: string; contentType: string | null }
  | { forwarded: false; failed: true }
> {
  const result = await forwardPaystackWebhookToMailthur(params.rawBody, params.signature);

  if (!result.ok) {
    logger.error("MailThur Paystack webhook forward failed", {
      error: result.error,
      reference: params.reference,
      event: params.eventType,
      targetUrl: MAILTHUR_PAYSTACK_WEBHOOK_URL,
    });
    return { forwarded: false, failed: true };
  }

  logger.info("Paystack webhook forwarded to MailThur", {
    reference: params.reference,
    event: params.eventType,
    mailthurStatus: result.status,
  });

  return {
    forwarded: true,
    status: result.status,
    body: result.body,
    contentType: result.contentType,
  };
}
