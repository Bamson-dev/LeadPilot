import type { BusinessLead } from "@leadpilot/shared";

/** Dashboard-compatible lead shape */
export interface Lead {
  id: string;
  search_id: string;
  business_name: string;
  phone: string | null;
  email: string | null;
  extracted_email: string | null;
  generated_email: string | null;
  email_source: "extracted" | "generated" | null;
  website: string | null;
  address: string | null;
  rating: number | null;
  reviews_count: number | null;
  category: string | null;
  google_maps_url: string | null;
  created_at: string;
}

export function businessLeadToLead(lead: BusinessLead): Lead {
  return {
    id: lead.id,
    search_id: lead.searchId,
    business_name: lead.name,
    phone: lead.phone,
    email: lead.email,
    extracted_email: lead.emailSource === "website" ? lead.email : null,
    generated_email: lead.emailSource === "generated" ? lead.email : null,
    email_source:
      lead.emailSource === "website"
        ? "extracted"
        : lead.emailSource === "generated"
          ? "generated"
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
