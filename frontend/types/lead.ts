import type { BusinessLead, PredictedEmail } from "@leadpilot/shared";

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
}

export function businessLeadToLead(lead: BusinessLead): Lead {
  const verified =
    lead.verifiedEmails?.length > 0
      ? lead.verifiedEmails
      : lead.email
        ? lead.email.split(/,\s*/).map((e) => e.trim()).filter(Boolean)
        : [];

  const allEmails =
    lead.emails?.length > 0 ? lead.emails : verified;

  return {
    id: lead.id,
    search_id: lead.searchId,
    business_name: lead.name,
    phone: lead.phone,
    email: allEmails.length > 0 ? allEmails.join(", ") : null,
    emails: allEmails,
    verified_emails: allEmails,
    predicted_emails: lead.predictedEmails ?? [],
    extracted_email: lead.emailSource === "website" ? verified.join(", ") || null : null,
    generated_email: null,
    email_source:
      lead.emailSource === "website"
        ? "extracted"
        : lead.emailSource === "predicted"
          ? "predicted"
          : null,
    website: lead.website,
    address: lead.address,
    rating: lead.rating,
    reviews_count: lead.reviewCount,
    category: lead.category,
    google_maps_url: lead.googleMapsUrl,
    created_at: lead.createdAt,
  };
}

export type StreamEvent =
  | { type: "phase"; phase: string }
  | { type: "progress"; count: number; max: number }
  | { type: "lead"; lead: Lead }
  | { type: "lead_update"; leadId: string; leadEmail: Partial<Lead> }
  | { type: "complete"; total: number }
  | { type: "error"; message: string };
