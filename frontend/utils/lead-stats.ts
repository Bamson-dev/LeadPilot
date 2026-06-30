import type { Lead } from "@/types/lead";
import { isScrappableBusinessWebsite } from "@leadthur/shared";

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
  withScrappableWebsite: number;
  emailsFoundFor: number;
  emailsScrapedFor: number;
}

export function computeLeadStats(leads: Lead[]): LeadStats {
  let withPhone = 0;
  let withEmail = 0;
  let withWebsite = 0;
  let withScrappableWebsite = 0;

  for (const lead of leads) {
    if (hasContactValue(lead.phone)) withPhone++;
    if (hasContactValue(lead.website)) withWebsite++;
    if (isScrappableBusinessWebsite(lead.website)) withScrappableWebsite++;
    const hasEmail =
      hasContactValue(lead.email) ||
      (lead.verified_emails?.length ?? 0) > 0 ||
      (lead.emails?.length ?? 0) > 0;
    if (hasEmail) withEmail++;
  }

  const emailsScrapedFor = leads.filter(
    (l) => isScrappableBusinessWebsite(l.website) && l.email_scraped
  ).length;

  return {
    total: leads.length,
    withPhone,
    withEmail,
    withWebsite,
    withScrappableWebsite,
    emailsFoundFor: withEmail,
    emailsScrapedFor: Math.max(withScrappableWebsite, emailsScrapedFor),
  };
}
