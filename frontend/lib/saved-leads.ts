import { leadStatusKey } from "@/lib/lead-status";
import type { LeadStatusRecord } from "@/services/api";
import type { Lead } from "@/types/lead";

/** Minimal Lead built from a status row when full search results are unavailable. */
export function statusRecordToPartialLead(record: LeadStatusRecord): Lead {
  return {
    id: `status:${record.id}`,
    search_id: record.search_id || "",
    business_name: record.business_name,
    phone: record.business_phone,
    email: null,
    emails: [],
    verified_emails: [],
    predicted_emails: [],
    extracted_email: null,
    generated_email: null,
    email_source: null,
    website: null,
    address: record.business_address,
    rating: null,
    reviews_count: null,
    category: null,
    google_maps_url: null,
    created_at: record.updated_at || record.created_at,
    email_scraped: false,
  };
}

export function matchLeadToStatus(
  lead: Lead,
  record: LeadStatusRecord
): boolean {
  return (
    leadStatusKey(lead.business_name, lead.phone) ===
    leadStatusKey(record.business_name, record.business_phone)
  );
}

export type SavedListItem = {
  id: string;
  name: string;
  count: number;
  searchId: string | null;
  location: string;
  query: string;
  createdAt: string;
};

export function historyToSavedLists(
  history: Array<{
    id: string;
    query: string;
    location: string;
    total_found: number;
    created_at: string;
    search_id: string | null;
  }>
): SavedListItem[] {
  return history.map((item) => ({
    id: item.id,
    name: `${item.query} · ${item.location}`.slice(0, 48),
    count: item.total_found || 0,
    searchId: item.search_id,
    location: item.location,
    query: item.query,
    createdAt: item.created_at,
  }));
}
