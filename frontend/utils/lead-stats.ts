import type { Lead } from "@/types/lead";

function hasContactValue(value: string | null | undefined): boolean {
  if (!value) return false;
  const trimmed = value.trim();
  return trimmed.length > 0 && trimmed !== "—" && trimmed !== "-";
}

export interface LeadStats {
  total: number;
  withPhone: number;
  withEmail: number;
  withWebsite: number;
  emailsFoundFor: number;
  emailsScrapedFor: number;
}

export function computeLeadStats(leads: Lead[]): LeadStats {
  let withPhone = 0;
  let withEmail = 0;
  let withWebsite = 0;

  for (const lead of leads) {
    if (hasContactValue(lead.phone)) withPhone++;
    if (hasContactValue(lead.website)) withWebsite++;
    const hasEmail =
      hasContactValue(lead.email) ||
      (lead.verified_emails?.length ?? 0) > 0 ||
      (lead.emails?.length ?? 0) > 0;
    if (hasEmail) withEmail++;
  }

  const withWebsiteForScrape = leads.filter((l) => hasContactValue(l.website)).length;
  const emailsScrapedFor = leads.filter(
    (l) => hasContactValue(l.website) && l.email_scraped
  ).length;

  return {
    total: leads.length,
    withPhone,
    withEmail,
    withWebsite,
    emailsFoundFor: withEmail,
    emailsScrapedFor: Math.max(withWebsiteForScrape, emailsScrapedFor),
  };
}
