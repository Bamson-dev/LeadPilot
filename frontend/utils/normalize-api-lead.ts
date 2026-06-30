import type { BusinessLead, PredictedEmail } from "@leadthur/shared";
import type { Lead } from "@/types/lead";

type ApiLeadLike = Partial<BusinessLead> &
  Partial<Lead> & {
    search_id?: string;
    business_name?: string;
    verified_emails?: string[];
    predicted_emails?: PredictedEmail[];
    email_source?: Lead["email_source"];
    review_count?: number | null;
    google_maps_url?: string | null;
    email_scraped?: boolean;
    created_at?: string;
  };

function readPredictedEmails(raw: ApiLeadLike): PredictedEmail[] {
  if (raw.predictedEmails?.length) return raw.predictedEmails;
  if (raw.predicted_emails?.length) return raw.predicted_emails;
  return [];
}

function readVerifiedEmails(raw: ApiLeadLike): string[] {
  if (raw.verifiedEmails?.length) return raw.verifiedEmails;
  if (raw.verified_emails?.length) return raw.verified_emails;
  if (raw.emails?.length) return raw.emails;
  if (raw.extracted_email?.trim()) {
    return raw.extracted_email.split(/,\s*/).map((e) => e.trim()).filter(Boolean);
  }
  const source = raw.emailSource ?? raw.email_source ?? null;
  if (source !== "predicted" && raw.email?.trim()) {
    return raw.email.split(/,\s*/).map((e) => e.trim()).filter(Boolean);
  }
  return [];
}

function readEmailSource(raw: ApiLeadLike): BusinessLead["emailSource"] {
  const source = raw.emailSource ?? raw.email_source;
  if (source === "website" || source === "extracted") return "website";
  if (source === "predicted") return "predicted";
  if (readPredictedEmails(raw).length > 0 && readVerifiedEmails(raw).length === 0) {
    return "predicted";
  }
  if (readVerifiedEmails(raw).length > 0) return "website";
  return "none";
}

/** Normalize poll/API payloads that may use camelCase or snake_case field names. */
export function normalizeApiBusinessLead(raw: ApiLeadLike): BusinessLead {
  const verifiedEmails = readVerifiedEmails(raw);
  const predictedEmails = readPredictedEmails(raw);
  const emailSource = readEmailSource(raw);
  const allAddresses = [
    ...verifiedEmails,
    ...predictedEmails.map((p) => p.email),
  ];

  return {
    id: raw.id ?? "",
    searchId: raw.searchId ?? raw.search_id ?? "",
    name: raw.name ?? raw.business_name ?? "",
    category: raw.category ?? "",
    address: raw.address ?? "",
    phone: raw.phone ?? null,
    email: allAddresses.length > 0 ? allAddresses.join(", ") : raw.email ?? null,
    emails: verifiedEmails,
    verifiedEmails,
    predictedEmails,
    emailSource,
    website: raw.website ?? null,
    rating: raw.rating ?? null,
    reviewCount: raw.reviewCount ?? raw.review_count ?? null,
    googleMapsUrl: raw.googleMapsUrl ?? raw.google_maps_url ?? null,
    hasWebsite: raw.hasWebsite ?? Boolean(raw.website),
    hasInstagram: raw.hasInstagram ?? false,
    emailScraped: raw.emailScraped ?? raw.email_scraped ?? false,
    createdAt: raw.createdAt ?? raw.created_at ?? new Date().toISOString(),
  };
}

export function normalizeApiBusinessLeads(
  leads: ApiLeadLike[]
): BusinessLead[] {
  return leads.map(normalizeApiBusinessLead);
}
