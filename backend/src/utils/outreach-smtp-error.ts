import { trackEvent } from "../observability/track";
import { EVENT_NAMES } from "../observability/event-taxonomy";

export type OutreachSmtpFailureKind = "hard_bounce" | "soft_failure";

export class OutreachSmtpSendError extends Error {
  readonly kind: OutreachSmtpFailureKind;
  readonly smtpCode: number | null;
  readonly smtpResponse: string | null;

  constructor(params: {
    kind: OutreachSmtpFailureKind;
    message: string;
    smtpCode?: number | null;
    smtpResponse?: string | null;
  }) {
    super(params.message);
    this.name = "OutreachSmtpSendError";
    this.kind = params.kind;
    this.smtpCode = params.smtpCode ?? null;
    this.smtpResponse = params.smtpResponse ?? null;
  }
}

function readSmtpCode(err: unknown): number | null {
  if (!err || typeof err !== "object") return null;
  const code = (err as { responseCode?: unknown }).responseCode;
  if (typeof code === "number" && code >= 100 && code <= 599) return code;
  const response = (err as { response?: unknown }).response;
  if (typeof response === "string") {
    const match = response.match(/^(\d{3})\b/);
    if (match) return Number.parseInt(match[1]!, 10);
  }
  return null;
}

function readSmtpResponse(err: unknown): string | null {
  if (!err || typeof err !== "object") return null;
  const response = (err as { response?: unknown }).response;
  if (typeof response === "string" && response.trim()) return response.trim();
  if (err instanceof Error && err.message.trim()) return err.message.trim();
  return null;
}

function trackSmtpFailure(classified: OutreachSmtpSendError): void {
  trackEvent({
    eventName: EVENT_NAMES.SMTP_FAILURE,
    source: "worker",
    properties: {
      kind: classified.kind,
      smtpCode: classified.smtpCode,
      // Truncated response only — never credentials
      smtpResponse: classified.smtpResponse
        ? classified.smtpResponse.slice(0, 200)
        : null,
    },
  });
}

/** Classify SMTP failures by response code: 5xx = hard bounce, 4xx = soft, timeouts = soft. */
export function classifySmtpSendError(err: unknown): OutreachSmtpSendError {
  const smtpCode = readSmtpCode(err);
  const smtpResponse = readSmtpResponse(err);

  if (smtpCode != null && smtpCode >= 500 && smtpCode <= 599) {
    const classified = new OutreachSmtpSendError({
      kind: "hard_bounce",
      message: smtpResponse ?? `SMTP permanent failure (${smtpCode})`,
      smtpCode,
      smtpResponse,
    });
    trackSmtpFailure(classified);
    return classified;
  }

  if (smtpCode != null && smtpCode >= 400 && smtpCode <= 499) {
    const classified = new OutreachSmtpSendError({
      kind: "soft_failure",
      message: smtpResponse ?? `SMTP temporary failure (${smtpCode})`,
      smtpCode,
      smtpResponse,
    });
    trackSmtpFailure(classified);
    return classified;
  }

  const code =
    err && typeof err === "object" && typeof (err as { code?: unknown }).code === "string"
      ? (err as { code: string }).code
      : null;

  const message =
    err instanceof Error ? err.message : typeof err === "string" ? err : "Send failed";

  const isTimeout =
    code === "ETIMEDOUT" ||
    code === "ESOCKET" ||
    code === "ECONNECTION" ||
    code === "ECONNRESET" ||
    /timeout/i.test(message);

  const classified = new OutreachSmtpSendError({
    kind: "soft_failure",
    message: isTimeout ? `Connection timeout: ${message}` : message,
    smtpCode,
    smtpResponse,
  });
  trackSmtpFailure(classified);
  return classified;
}
