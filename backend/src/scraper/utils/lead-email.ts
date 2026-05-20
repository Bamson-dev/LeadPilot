import {
  formatEmailsForDisplay,
  mergeEmails,
  parseEmailList,
} from "../parsers/email-filter";
import { formatGeneratedEmails } from "../parsers/email-generator";
import {
  extractDomainLoose,
  isMessagingHost,
  resolveGenerationDomain,
} from "./domain-utils";

export type EmailSource = "extracted" | "generated";

export interface LeadEmailFields {
  extracted_email: string | null;
  generated_email: string | null;
  email_source: EmailSource | null;
  email: string | null;
}

export function resolveLeadEmailFields(options: {
  mapsEmails?: string[];
  websiteEmails?: string[];
  website?: string | null;
  category?: string | null;
  businessName?: string | null;
}): LeadEmailFields {
  const extractedList = mergeEmails(
    options.mapsEmails ?? [],
    options.websiteEmails ?? []
  );
  const extracted = formatEmailsForDisplay(extractedList);

  if (extracted) {
    return {
      extracted_email: extracted,
      generated_email: null,
      email_source: "extracted",
      email: extracted,
    };
  }

  const generated =
    options.website?.trim() && resolveGenerationDomain(options.website)
      ? formatGeneratedEmails(
          options.website,
          options.category ?? null,
          options.businessName ?? null
        )
      : null;

  if (generated) {
    return {
      extracted_email: null,
      generated_email: generated,
      email_source: "generated",
      email: generated,
    };
  }

  return {
    extracted_email: null,
    generated_email: null,
    email_source: null,
    email: null,
  };
}

export function shouldCrawlWebsiteForEmail(
  website: string | null | undefined
): boolean {
  if (!website?.trim()) return false;
  const domain = extractDomainLoose(website);
  if (!domain) return false;
  return !isMessagingHost(domain);
}

export function emailFieldsForLeadEmit(
  mapsEmails: string[],
  website: string | null | undefined,
  category: string | null | undefined,
  businessName: string | null | undefined
): LeadEmailFields {
  return resolveLeadEmailFields({
    mapsEmails,
    websiteEmails: [],
    website,
    category,
    businessName,
  });
}

export function parseMapsEmailsFromLead(lead: {
  email?: string | null;
  extracted_email?: string | null;
}): string[] {
  if (lead.extracted_email?.trim()) return parseEmailList(lead.extracted_email);
  if (lead.email?.trim()) return parseEmailList(lead.email);
  return [];
}
