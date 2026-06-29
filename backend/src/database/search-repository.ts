import type { BusinessLead, NearbyCitySuggestion, SearchJob, SearchStatsSummary } from "@leadthur/shared";
import {
  predictionsFromDb,
  predictionStorageFields,
} from "../utils/lead-mapper";
import { parseEmailList } from "../scraper/parsers/email-filter";
import { supabase } from "./client";

interface DbSearchJob {
  id: string;
  query: string;
  location: string;
  status: string;
  total_found: number;
  processed: number;
  is_trial?: boolean | null;
  license_email?: string | null;
  scraping_in_progress?: boolean | null;
  nearby_cities?: NearbyCitySuggestion[] | null;
  stats_summary?: SearchStatsSummary | null;
  results_email_sent?: boolean | null;
  error: string | null;
  created_at: string;
  updated_at: string;
}

export interface SearchJobAccess {
  job: SearchJob;
  licenseEmail: string | null;
  isTrial: boolean;
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
  verified_email?: string | null;
  predicted_email?: string | null;
  predicted_email_secondary?: string | null;
  prediction_confidence?: number | null;
  prediction_confidence_secondary?: number | null;
  website: string | null;
  rating: number | null;
  review_count: number | null;
  google_maps_url: string | null;
  has_website: boolean;
  has_instagram: boolean;
  email_scraped?: boolean | null;
  created_at: string;
}

function parseVerifiedEmails(row: DbBusinessLead): string[] {
  if (row.verified_email?.trim()) {
    return parseEmailList(row.verified_email);
  }
  const source = row.email_source ?? "none";
  if (
    row.email?.trim() &&
    source !== "predicted" &&
    source !== "generated"
  ) {
    return parseEmailList(row.email);
  }
  return [];
}

function dbEmailSource(lead: BusinessLead): string {
  if (lead.emailSource === "website") return "extracted";
  if (lead.emailSource === "predicted") return "predicted";
  return "none";
}

function leadToDbInsert(lead: BusinessLead): Record<string, unknown> {
  const emailFields = predictionStorageFields(lead);
  return {
    id: lead.id,
    search_id: lead.searchId,
    name: lead.name,
    category: lead.category,
    address: lead.address,
    phone: lead.phone,
    email: emailFields.verified_email,
    email_source: dbEmailSource(lead),
    verified_email: emailFields.verified_email,
    predicted_email: emailFields.predicted_email,
    predicted_email_secondary: emailFields.predicted_email_secondary,
    prediction_confidence: emailFields.prediction_confidence,
    prediction_confidence_secondary: emailFields.prediction_confidence_secondary,
    website: lead.website,
    rating: lead.rating,
    review_count: lead.reviewCount,
    google_maps_url: lead.googleMapsUrl,
    has_website: lead.hasWebsite,
    has_instagram: lead.hasInstagram,
    email_scraped: lead.emailScraped ?? false,
  };
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
    isTrial: Boolean(row.is_trial),
    scrapingInProgress: Boolean(row.scraping_in_progress),
    nearbyCities: (row.nearby_cities as NearbyCitySuggestion[] | null) ?? undefined,
    statsSummary: (row.stats_summary as SearchStatsSummary | null) ?? undefined,
  };
}

function mapBusinessLead(row: DbBusinessLead): BusinessLead {
  const source = row.email_source ?? "none";
  const verifiedEmails = parseVerifiedEmails(row);
  const predictedEmails = predictionsFromDb(row);
  const emailSource =
    source === "predicted" || source === "generated"
      ? "predicted"
      : source === "website" || source === "extracted"
        ? "website"
        : "none";

  const predictedBlock =
    emailSource === "predicted"
      ? (() => {
          const predictedAddresses =
            predictedEmails.length > 0
              ? predictedEmails.map((p) => p.email)
              : row.email
                ? parseEmailList(row.email)
                : [];
          return {
            email:
              predictedAddresses.length > 0
                ? predictedAddresses.join(", ")
                : null,
            emails: predictedAddresses,
            verifiedEmails: [] as string[],
            predictedEmails,
          };
        })()
      : {
          email: verifiedEmails[0] ?? null,
          emails: verifiedEmails,
          verifiedEmails,
          predictedEmails,
        };

  return {
    id: row.id,
    searchId: row.search_id,
    name: row.name,
    category: row.category ?? "",
    address: row.address ?? "",
    phone: row.phone,
    email: predictedBlock.email,
    emails: predictedBlock.emails,
    verifiedEmails: predictedBlock.verifiedEmails,
    predictedEmails: predictedBlock.predictedEmails,
    emailSource,
    website: row.website,
    rating: row.rating,
    reviewCount: row.review_count,
    googleMapsUrl: row.google_maps_url,
    hasWebsite: row.has_website,
    hasInstagram: row.has_instagram,
    emailScraped: Boolean(row.email_scraped),
    createdAt: row.created_at,
  };
}

function normalizeSearchText(value: string): string {
  return value.toLowerCase().trim();
}

export async function createSearchJob(
  query: string,
  location: string,
  options?: { isTrial?: boolean; licenseEmail?: string | null }
): Promise<SearchJob> {
  const licenseEmail = options?.licenseEmail?.toLowerCase().trim() || null;
  const { data, error } = await supabase
    .from("search_jobs")
    .insert({
      query: normalizeSearchText(query),
      location: normalizeSearchText(location),
      status: "pending",
      is_trial: options?.isTrial ?? false,
      license_email: options?.isTrial ? null : licenseEmail,
    })
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
    scrapingInProgress: boolean;
    nearbyCities: NearbyCitySuggestion[] | null;
    statsSummary: SearchStatsSummary | null;
    resultsEmailSent: boolean;
  }>
): Promise<void> {
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.status) update.status = patch.status;
  if (patch.totalFound != null) update.total_found = patch.totalFound;
  if (patch.processed != null) update.processed = patch.processed;
  if (patch.error !== undefined) update.error = patch.error;
  if (patch.scrapingInProgress !== undefined) {
    update.scraping_in_progress = patch.scrapingInProgress;
  }
  if (patch.nearbyCities !== undefined) update.nearby_cities = patch.nearbyCities;
  if (patch.statsSummary !== undefined) update.stats_summary = patch.statsSummary;
  if (patch.resultsEmailSent !== undefined) {
    update.results_email_sent = patch.resultsEmailSent;
  }

  const { error } = await supabase.from("search_jobs").update(update).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function getSearchJob(id: string): Promise<SearchJob | null> {
  const access = await getSearchJobAccess(id);
  return access?.job ?? null;
}

export async function setSearchJobLicenseEmail(
  id: string,
  licenseEmail: string
): Promise<void> {
  const email = licenseEmail.toLowerCase().trim();
  const { error } = await supabase
    .from("search_jobs")
    .update({ license_email: email })
    .eq("id", id);

  if (error) throw new Error(error.message);
}

export async function getSearchJobAccess(id: string): Promise<SearchJobAccess | null> {
  const { data, error } = await supabase
    .from("search_jobs")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;

  const row = data as DbSearchJob;
  return {
    job: mapSearchJob(row),
    licenseEmail: row.license_email?.toLowerCase().trim() || null,
    isTrial: Boolean(row.is_trial),
  };
}

export async function insertBusinessLead(lead: BusinessLead): Promise<BusinessLead> {
  const { data, error } = await supabase
    .from("business_leads")
    .upsert(leadToDbInsert(lead), { onConflict: "id" })
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Failed to upsert lead");
  }
  return mapBusinessLead(data as DbBusinessLead);
}

export async function updateBusinessLeadEmails(
  businessId: string,
  emails: string[],
  source: "extracted" | "predicted" = "extracted"
): Promise<void> {
  const verified = emails.filter(Boolean);
  const primary = verified.length > 0 ? verified.join(", ") : null;

  const update =
    source === "predicted"
      ? {
          email: primary,
          verified_email: null,
          predicted_email: verified[0] ?? null,
          predicted_email_secondary: verified[1] ?? null,
          prediction_confidence: null,
          prediction_confidence_secondary: null,
          email_source: "predicted",
          email_scraped: true,
        }
      : {
          email: primary,
          verified_email: primary,
          predicted_email: null,
          predicted_email_secondary: null,
          prediction_confidence: null,
          prediction_confidence_secondary: null,
          email_source: verified.length > 0 ? "extracted" : "none",
          email_scraped: true,
        };

  const { error } = await supabase
    .from("business_leads")
    .update(update)
    .eq("id", businessId);

  if (error) throw new Error(error.message);
}

export async function markBusinessLeadEmailScraped(
  businessId: string,
  emails: string[] = []
): Promise<void> {
  const verified = emails.filter(Boolean);
  const primary = verified.length > 0 ? verified.join(", ") : null;
  const { error } = await supabase
    .from("business_leads")
    .update({
      email: primary,
      verified_email: primary,
      email_source: verified.length > 0 ? "extracted" : "none",
      email_scraped: true,
    })
    .eq("id", businessId);

  if (error) throw new Error(error.message);
}

export async function getLeadsNeedingEmailScrape(
  searchId: string
): Promise<BusinessLead[]> {
  const { data, error } = await supabase
    .from("business_leads")
    .select("*")
    .eq("search_id", searchId)
    .eq("email_scraped", false)
    .not("website", "is", null);

  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => mapBusinessLead(row as DbBusinessLead));
}

export async function countSearchLeads(searchId: string): Promise<number> {
  const { count, error } = await supabase
    .from("business_leads")
    .select("*", { count: "exact", head: true })
    .eq("search_id", searchId);

  if (error) throw new Error(error.message);
  return count ?? 0;
}

export async function getAllSearchLeads(searchId: string): Promise<BusinessLead[]> {
  const { data, error } = await supabase
    .from("business_leads")
    .select("*")
    .eq("search_id", searchId)
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => mapBusinessLead(row as DbBusinessLead));
}

export async function tryClaimResultsEmailSend(searchId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from("search_jobs")
    .update({ results_email_sent: true })
    .eq("id", searchId)
    .eq("results_email_sent", false)
    .select("id")
    .maybeSingle();

  if (error) throw new Error(error.message);
  return Boolean(data);
}

export async function insertBusinessLeads(leads: BusinessLead[]): Promise<void> {
  if (leads.length === 0) return;
  const batchSize = 50;
  for (let i = 0; i < leads.length; i += batchSize) {
    const batch = leads.slice(i, i + batchSize);
    const rows = batch.map((lead) => leadToDbInsert(lead));

    const { error } = await supabase.from("business_leads").insert(rows);
    if (error) throw new Error(error.message);
  }
}

export async function getSearchResults(
  searchId: string,
  page: number,
  limit: number
): Promise<{ leads: BusinessLead[]; total: number }> {
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

/** Copy cached leads into a new search job (new IDs). */
export async function copyLeadsToSearch(
  searchId: string,
  leads: BusinessLead[]
): Promise<void> {
  const { randomUUID } = await import("crypto");
  await insertBusinessLeads(
    leads.map((lead) => ({
      ...lead,
      id: randomUUID(),
      searchId,
    }))
  );
}
