import type { BusinessLead } from "@leadpilot/shared";
import type { RawLeadInput } from "../types/scraper";
import { crawlEmailForWebsite } from "../scraper/emailCrawler/email-crawler";
import { parseMapsEmailsFromLead, resolveLeadEmailFields } from "../scraper/utils/lead-email";

export function rawLeadToBusinessLead(
  raw: RawLeadInput,
  searchId: string
): BusinessLead {
  const mapsEmails = parseMapsEmailsFromLead(raw);
  const website = raw.website;
  const hasInstagram = Boolean(
    website?.includes("instagram.com") || website?.includes("instagr.am")
  );

  return {
    id: crypto.randomUUID(),
    searchId,
    name: raw.business_name,
    category: raw.category ?? "",
    address: raw.address ?? "",
    phone: raw.phone,
    email: raw.email,
    emailSource:
      raw.email_source === "extracted"
        ? "website"
        : raw.email_source === "generated"
          ? "generated"
          : "none",
    website,
    rating: raw.rating,
    reviewCount: raw.reviews_count,
    googleMapsUrl: raw.google_maps_url,
    hasWebsite: Boolean(website),
    hasInstagram,
    createdAt: new Date().toISOString(),
  };
}

export async function enrichLeadEmail(
  lead: BusinessLead
): Promise<BusinessLead> {
  const crawl = await crawlEmailForWebsite(
    lead.website,
    lead.category,
    lead.name
  );

  if (crawl.emailSource === "none") return lead;

  const fields = resolveLeadEmailFields({
    mapsEmails: lead.email ? [lead.email] : [],
    websiteEmails: crawl.emailSource === "website" && crawl.email
      ? crawl.email.split(", ")
      : [],
    website: lead.website,
    category: lead.category,
    businessName: lead.name,
  });

  return {
    ...lead,
    email: fields.email,
    emailSource:
      fields.email_source === "extracted"
        ? "website"
        : fields.email_source === "generated"
          ? "generated"
          : "none",
  };
}
