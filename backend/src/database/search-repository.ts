import type { BusinessLead, SearchJob } from "@leadpilot/shared";
import { getSupabase } from "./client";

interface DbSearchJob {
  id: string;
  query: string;
  location: string;
  status: string;
  total_found: number;
  processed: number;
  error: string | null;
  created_at: string;
  updated_at: string;
}

interface DbBusinessLead {
  id: string;
  search_id: string;
  name: string;
  category: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  email_source: string | null;
  website: string | null;
  rating: number | null;
  review_count: number | null;
  google_maps_url: string | null;
  has_website: boolean;
  has_instagram: boolean;
  created_at: string;
}

function mapSearchJob(row: DbSearchJob): SearchJob {
  return {
    id: row.id,
    query: row.query,
    location: row.location,
    status: row.status as SearchJob["status"],
    totalFound: row.total_found,
    processed: row.processed,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    error: row.error,
  };
}

function mapBusinessLead(row: DbBusinessLead): BusinessLead {
  const source = row.email_source ?? "none";
  return {
    id: row.id,
    searchId: row.search_id,
    name: row.name,
    category: row.category ?? "",
    address: row.address ?? "",
    phone: row.phone,
    email: row.email,
    emailSource:
      source === "website" || source === "generated" || source === "extracted"
        ? source === "extracted"
          ? "website"
          : (source as "generated" | "website")
        : "none",
    website: row.website,
    rating: row.rating,
    reviewCount: row.review_count,
    googleMapsUrl: row.google_maps_url,
    hasWebsite: row.has_website,
    hasInstagram: row.has_instagram,
    createdAt: row.created_at,
  };
}

export async function createSearchJob(
  query: string,
  location: string
): Promise<SearchJob> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("search_jobs")
    .insert({ query, location, status: "pending" })
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Failed to create search job");
  }
  return mapSearchJob(data as DbSearchJob);
}

export async function updateSearchJob(
  id: string,
  patch: Partial<{
    status: SearchJob["status"];
    totalFound: number;
    processed: number;
    error: string | null;
  }>
): Promise<void> {
  const supabase = getSupabase();
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.status) update.status = patch.status;
  if (patch.totalFound != null) update.total_found = patch.totalFound;
  if (patch.processed != null) update.processed = patch.processed;
  if (patch.error !== undefined) update.error = patch.error;

  const { error } = await supabase.from("search_jobs").update(update).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function getSearchJob(id: string): Promise<SearchJob | null> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("search_jobs")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data ? mapSearchJob(data as DbSearchJob) : null;
}

export async function insertBusinessLead(lead: BusinessLead): Promise<BusinessLead> {
  const supabase = getSupabase();
  const dbSource =
    lead.emailSource === "website"
      ? "extracted"
      : lead.emailSource === "generated"
        ? "generated"
        : "none";

  const { data, error } = await supabase
    .from("business_leads")
    .insert({
      id: lead.id,
      search_id: lead.searchId,
      name: lead.name,
      category: lead.category,
      address: lead.address,
      phone: lead.phone,
      email: lead.email,
      email_source: dbSource,
      website: lead.website,
      rating: lead.rating,
      review_count: lead.reviewCount,
      google_maps_url: lead.googleMapsUrl,
      has_website: lead.hasWebsite,
      has_instagram: lead.hasInstagram,
    })
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Failed to insert lead");
  }
  return mapBusinessLead(data as DbBusinessLead);
}

export async function insertBusinessLeads(leads: BusinessLead[]): Promise<void> {
  if (leads.length === 0) return;
  const batchSize = 50;
  for (let i = 0; i < leads.length; i += batchSize) {
    const batch = leads.slice(i, i + batchSize);
    const supabase = getSupabase();
    const rows = batch.map((lead) => ({
      id: lead.id,
      search_id: lead.searchId,
      name: lead.name,
      category: lead.category,
      address: lead.address,
      phone: lead.phone,
      email: lead.email,
      email_source:
        lead.emailSource === "website"
          ? "extracted"
          : lead.emailSource === "generated"
            ? "generated"
            : "none",
      website: lead.website,
      rating: lead.rating,
      review_count: lead.reviewCount,
      google_maps_url: lead.googleMapsUrl,
      has_website: lead.hasWebsite,
      has_instagram: lead.hasInstagram,
    }));

    const { error } = await supabase.from("business_leads").insert(rows);
    if (error) throw new Error(error.message);
  }
}

export async function getSearchResults(
  searchId: string,
  page: number,
  limit: number
): Promise<{ leads: BusinessLead[]; total: number }> {
  const supabase = getSupabase();
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  const { data, error, count } = await supabase
    .from("business_leads")
    .select("*", { count: "exact" })
    .eq("search_id", searchId)
    .order("created_at", { ascending: true })
    .range(from, to);

  if (error) throw new Error(error.message);
  return {
    leads: (data ?? []).map((row) => mapBusinessLead(row as DbBusinessLead)),
    total: count ?? 0,
  };
}

export async function markSearchComplete(
  id: string,
  totalFound: number
): Promise<void> {
  await updateSearchJob(id, {
    status: "completed",
    totalFound,
    processed: totalFound,
    error: null,
  });
}

export async function markSearchFailed(id: string, errorMessage: string): Promise<void> {
  await updateSearchJob(id, { status: "failed", error: errorMessage });
}
