import type { PredictedEmail } from "@leadpilot/shared";
import type { Lead } from "@/types/lead";

export function getVerifiedEmails(
  lead: Pick<Lead, "email" | "verified_emails" | "extracted_email">
): string[] {
  if (lead.verified_emails?.length) return lead.verified_emails;
  if (lead.extracted_email?.trim()) {
    return lead.extracted_email.split(/,\s*/).map((e) => e.trim()).filter(Boolean);
  }
  if (lead.email?.trim()) return [lead.email.trim()];
  return [];
}

export function getPredictedEmails(
  lead: Pick<Lead, "predicted_emails">
): PredictedEmail[] {
  return lead.predicted_emails ?? [];
}

/** Verified first, then predicted — max 2, no labels in UI. */
export function getAllEmailsForDisplay(
  lead: Pick<
    Lead,
    "email" | "extracted_email" | "verified_emails" | "predicted_emails"
  >
): string[] {
  const seen = new Set<string>();
  const out: string[] = [];

  for (const addr of [
    ...getVerifiedEmails(lead),
    ...getPredictedEmails(lead).map((p) => p.email),
  ]) {
    const key = addr.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(addr);
    if (out.length >= 1) break;
  }

  return out;
}

export function hasAnyEmail(
  lead: Pick<Lead, "email" | "extracted_email" | "verified_emails" | "predicted_emails">
): boolean {
  return getVerifiedEmails(lead).length > 0 || getPredictedEmails(lead).length > 0;
}

/** @deprecated Use getVerifiedEmails / getPredictedEmails */
export function getDisplayEmail(
  lead: Pick<Lead, "email" | "extracted_email" | "generated_email" | "verified_emails">
): string | null {
  const verified = getVerifiedEmails(lead);
  return verified[0] ?? null;
}
