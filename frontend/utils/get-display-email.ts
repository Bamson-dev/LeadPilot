import type { PredictedEmail } from "@leadthur/shared";
import type { Lead } from "@/types/lead";

export function getVerifiedEmails(
  lead: Pick<
    Lead,
    "email" | "verified_emails" | "extracted_email" | "emails"
  > & {
    verifiedEmails?: string[];
  }
): string[] {
  if (lead.emails && lead.emails.length > 0) return lead.emails;
  if (lead.verifiedEmails?.length) return lead.verifiedEmails;
  if (lead.verified_emails?.length) return lead.verified_emails;
  if (lead.extracted_email?.trim()) {
    return lead.extracted_email.split(/,\s*/).map((e) => e.trim()).filter(Boolean);
  }
  if (lead.email?.trim()) return lead.email.split(/,\s*/).map((e) => e.trim()).filter(Boolean);
  return [];
}

export function getPredictedEmails(
  lead: Pick<Lead, "predicted_emails"> & { predictedEmails?: PredictedEmail[] }
): PredictedEmail[] {
  if (lead.predicted_emails?.length) return lead.predicted_emails;
  return lead.predictedEmails ?? [];
}

/** All verified emails, then predicted — no cap, no labels in UI. */
export function getAllEmailsForDisplay(
  lead: Pick<
    Lead,
    "email" | "extracted_email" | "verified_emails" | "predicted_emails" | "emails"
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
  }

  return out;
}

export function hasAnyEmail(
  lead: Pick<Lead, "email" | "extracted_email" | "verified_emails" | "predicted_emails" | "emails">
): boolean {
  return getAllEmailsForDisplay(lead).length > 0;
}

export { getLeadSelectionId } from "@/lib/lead-selection";

export function canSelectLeadForEmail(lead: Parameters<typeof hasAnyEmail>[0]): boolean {
  return hasAnyEmail(lead);
}

/** @deprecated Use getVerifiedEmails / getPredictedEmails */
export function getDisplayEmail(
  lead: Pick<Lead, "email" | "extracted_email" | "generated_email" | "verified_emails" | "emails">
): string | null {
  const verified = getVerifiedEmails(lead);
  return verified[0] ?? null;
}
