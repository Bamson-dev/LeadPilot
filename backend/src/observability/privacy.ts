import { createHash, randomUUID } from "crypto";

const SENSITIVE_KEYS = new Set([
  "password",
  "passwd",
  "license",
  "licensekey",
  "license_key",
  "key",
  "card",
  "cardnumber",
  "cvv",
  "cvc",
  "pan",
  "smtp_password",
  "smtppassword",
  "oauth",
  "oauth_secret",
  "client_secret",
  "jwt",
  "token",
  "authorization",
  "apikey",
  "api_key",
  "secret",
  "private_key",
]);

export function hashEmail(email: string | null | undefined): string | null {
  if (!email) return null;
  const normalized = email.trim().toLowerCase();
  if (!normalized.includes("@")) return null;
  return createHash("sha256").update(normalized).digest("hex").slice(0, 32);
}

export function maskEmail(email: string | null | undefined): string | null {
  if (!email || !email.includes("@")) return null;
  const [local, domain] = email.trim().toLowerCase().split("@");
  if (!local || !domain) return null;
  const visible = local.slice(0, Math.min(2, local.length));
  return `${visible}***@${domain}`;
}

function isSensitiveKey(key: string): boolean {
  const k = key.toLowerCase().replace(/[^a-z0-9_]/g, "");
  if (SENSITIVE_KEYS.has(k)) return true;
  return (
    k.includes("password") ||
    k.includes("secret") ||
    k.includes("licensekey") ||
    k.includes("card") ||
    k.includes("cvv") ||
    k.includes("token")
  );
}

export function sanitizeProperties(
  input: Record<string, unknown> | null | undefined
): Record<string, unknown> {
  if (!input) return {};
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (isSensitiveKey(key)) continue;
    if (value === undefined) continue;
    if (typeof value === "string" && value.length > 2000) {
      out[key] = `${value.slice(0, 2000)}…`;
      continue;
    }
    if (value && typeof value === "object" && !Array.isArray(value)) {
      out[key] = sanitizeProperties(value as Record<string, unknown>);
      continue;
    }
    out[key] = value;
  }
  return out;
}

export function newCorrelationId(): string {
  return randomUUID();
}

export function getEnvironment(): string {
  if (process.env.NODE_ENV === "production") {
    if (process.env.COOLIFY_BRANCH === "staging" || process.env.APP_ENV === "staging") {
      return "staging";
    }
    return "production";
  }
  return process.env.APP_ENV || "development";
}
