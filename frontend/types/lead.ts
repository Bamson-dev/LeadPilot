import type { BusinessLead, PredictedEmail } from "@leadthur/shared";
import { getLeadSelectionId } from "@/lib/lead-selection";

/** Dashboard-compatible lead shape */
export interface Lead {
  id: string;
  search_id: string;
  business_name: string;
  phone: string | null;
  email: string | null;
  emails: string[];
  verified_emails: string[];
  predicted_emails: PredictedEmail[];
  extracted_email: string | null;
  generated_email: string | null;
  email_source: "extracted" | "predicted" | null;
  website: string | null;
  address: string | null;
  rating: number | null;
  reviews_count: number | null;
  category: string | null;
  google_maps_url: string | null;
  created_at: string;
  email_scraped?: boolean;
}

export function businessLeadToLead(lead: BusinessLead): Lead {
  const raw = lead as BusinessLead & {
    verified_emails?: string[];
    predicted_emails?: PredictedEmail[];
    email_source?: Lead["email_source"];
    extracted_email?: string | null;
  };

  const verified =
    raw.verifiedEmails?.length > 0
      ? raw.verifiedEmails
      : raw.verified_emails?.length
        ? raw.verified_emails
        : raw.emailSource === "website" && raw.emails?.length > 0
          ? raw.emails
          : raw.extracted_email?.trim()
            ? raw.extracted_email.split(/,\s*/).map((e) => e.trim()).filter(Boolean)
            : raw.emailSource !== "predicted" &&
                raw.email_source !== "predicted" &&
                raw.email
              ? raw.email.split(/,\s*/).map((e) => e.trim()).filter(Boolean)
              : [];

  const predicted = raw.predictedEmails?.length
    ? raw.predictedEmails
    : raw.predicted_emails ?? [];

  const displayVerified = verified;
  const displayPredicted = predicted.map((p) => p.email);
  const allForLegacy = [...displayVerified, ...displayPredicted];

  const base: Omit<Lead, "id"> = {
    search_id: lead.searchId,
    business_name: lead.name,
    phone: lead.phone,
    email: allForLegacy.length > 0 ? allForLegacy.join(", ") : null,
    emails: displayVerified,
    verified_emails: displayVerified,
    predicted_emails: predicted,
    extracted_email:
      displayVerified.length > 0 ? displayVerified.join(", ") : null,
    generated_email: null,
    email_source:
      displayVerified.length > 0
        ? "extracted"
        : displayPredicted.length > 0
          ? "predicted"
          : null,
    website: lead.website,
    address: lead.address,
    rating: lead.rating,
    reviews_count: lead.reviewCount,
    category: lead.category,
    google_maps_url: lead.googleMapsUrl,
    created_at: lead.createdAt,
    email_scraped: lead.emailScraped ?? false,
  };

  return {
    ...base,
    id: lead.id?.trim()
      ? lead.id.trim()
      : getLeadSelectionId({
          id: "",
          google_maps_url: lead.googleMapsUrl ?? null,
          business_name: lead.name,
          phone: lead.phone,
          address: lead.address,
        }),
  };
}

export type StreamEvent =
  | { type: "phase"; phase: string }
  | { type: "progress"; count: number; max: number }
  | { type: "lead"; lead: Lead }
  | { type: "lead_update"; leadId: string; leadEmail: Partial<Lead> }
  | { type: "complete"; total: number }
  | { type: "error"; message: string };
