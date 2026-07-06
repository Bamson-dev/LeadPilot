/** Shared outreach helpers — exported for unit tests and UI. */

const APP_PASSWORD_RE = /^[a-z0-9]{16}$/i;

export function normalizeAppPassword(raw: string): string {
  return raw.replace(/\s+/g, "").trim();
}

export function isValidAppPassword(raw: string): boolean {
  return APP_PASSWORD_RE.test(normalizeAppPassword(raw));
}

export function applyBusinessNameMerge(text: string, businessName?: string | null): string {
  const name = businessName?.trim() || "there";
  return text.replace(/\[Business Name\]/gi, name);
}

export function formatSubscriptionLabel(
  tier: string | null,
  status: string
): string | null {
  if (!tier && status === "none") return null;
  const tierLabel = tier ? tier.charAt(0).toUpperCase() + tier.slice(1) : "None";
  const statusLabel = status.replace(/_/g, " ");
  return `${tierLabel} · ${statusLabel}`;
}
