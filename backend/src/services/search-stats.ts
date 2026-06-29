import type { BusinessLead, SearchStatsSummary } from "@leadthur/shared";

function leadHasEmail(lead: BusinessLead): boolean {
  return Boolean(
    lead.email?.trim() ||
      (lead.emails?.length ?? 0) > 0 ||
      (lead.verifiedEmails?.length ?? 0) > 0
  );
}

export function computeSearchStats(leads: BusinessLead[]): SearchStatsSummary {
  const total = leads.length;
  const withPhone = leads.filter((l) => Boolean(l.phone?.trim())).length;
  const withEmail = leads.filter(leadHasEmail).length;
  const withWebsite = leads.filter(
    (l) => Boolean(l.website?.trim()) || l.hasWebsite
  ).length;
  const emailsScrapedFor = leads.filter((l) => l.emailScraped).length;
  const emailsFoundFor = leads.filter(
    (l) => l.emailScraped && leadHasEmail(l)
  ).length;

  return {
    total,
    withPhone,
    withEmail,
    withWebsite,
    emailsFoundFor,
    emailsScrapedFor,
  };
}
