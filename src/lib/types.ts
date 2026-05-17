export interface Search {
  id: string;
  search_term: string;
  location: string;
  total_results: number;
  created_at: string;
}

export type EmailSource = "extracted" | "generated";

export interface LeadEmailUpdate {
  extracted_email: string | null;
  generated_email: string | null;
  email_source: EmailSource | null;
  email: string | null;
}

export interface Lead {
  id: string;
  search_id: string;
  business_name: string;
  phone: string | null;
  /** Display field: extracted_email or generated_email */
  email: string | null;
  extracted_email: string | null;
  generated_email: string | null;
  email_source: EmailSource | null;
  website: string | null;
  address: string | null;
  rating: number | null;
  reviews_count: number | null;
  category: string | null;
  google_maps_url: string | null;
  created_at: string;
}

export type LeadInput = Omit<Lead, "id" | "search_id" | "created_at">;

export interface StreamEvent {
  type: "progress" | "phase" | "lead" | "lead_update" | "complete" | "error";
  count?: number;
  max?: number;
  phase?: string;
  lead?: Lead;
  leadId?: string;
  /** @deprecated use leadEmail */
  email?: string;
  leadEmail?: LeadEmailUpdate;
  message?: string;
  total?: number;
}
