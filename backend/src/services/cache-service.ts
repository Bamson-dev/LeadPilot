import { randomUUID } from "crypto";
import type { BusinessLead } from "@leadthur/shared";
import { supabase } from "../database/client";
import { predictionsFromDb, predictionStorageFields } from "../utils/lead-mapper";
import { parseEmailList } from "../scraper/parsers/email-filter";
import {
  MAX_LEADS_PER_SEARCH,
  MIN_CACHE_LEADS_TO_REUSE,
} from "../scraper/utils/constants";
import { logger } from "../utils/logger";

function mapRowToBusinessLead(row: Record<string, unknown>): BusinessLead {
  const source = (row.email_source as string | null) ?? "none";
  const verifiedEmails = row.verified_email
    ? parseEmailList(row.verified_email as string)
    : source !== "predicted" && source !== "generated" && row.email
      ? parseEmailList(row.email as string)
      : [];

  return {
    id: row.id as string,
    searchId: row.search_id as string,
    name: row.name as string,
    category: (row.category as string) ?? "",
    address: (row.address as string) ?? "",
    phone: row.phone as string | null,
    email: verifiedEmails[0] ?? null,
    emails: verifiedEmails,
    verifiedEmails,
    predictedEmails: predictionsFromDb({
      predicted_email: row.predicted_email as string | null,
      predicted_email_secondary: row.predicted_email_secondary as string | null,
      prediction_confidence: row.prediction_confidence as number | null,
      prediction_confidence_secondary: row.prediction_confidence_secondary as number | null,
    }),
    emailSource:
      source === "predicted" || source === "generated"
        ? "predicted"
        : source === "extracted" || source === "website"
          ? "website"
          : "none",
    website: row.website as string | null,
    rating: row.rating as number | null,
    reviewCount: row.review_count as number | null,
    googleMapsUrl: row.google_maps_url as string | null,
    hasWebsite: Boolean(row.has_website),
    hasInstagram: Boolean(row.has_instagram),
    createdAt: row.created_at as string,
  };
}

export async function getCachedSearch(
  query: string,
  location: string
): Promise<{ searchId: string; leads: BusinessLead[]; priorTotalFound: number } | null> {
  const normalizedQuery = query.toLowerCase().trim();
  const normalizedLocation = location.toLowerCase().trim();
  const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();

  const { data: cachedJob, error: jobError } = await supabase
    .from("search_jobs")
    .select("id, created_at, total_found")
    .ilike("query", normalizedQuery)
    .ilike("location", normalizedLocation)
    .eq("status", "completed")
    .gte("created_at", sixHoursAgo)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (jobError || !cachedJob) return null;

  const priorTotalFound = Number(cachedJob.total_found ?? 0);
  const fetchLimit = Math.min(
    MAX_LEADS_PER_SEARCH,
    Math.max(priorTotalFound > 0 ? priorTotalFound : MAX_LEADS_PER_SEARCH, MIN_CACHE_LEADS_TO_REUSE)
  );

  const { data: rows, error: leadsError } = await supabase
    .from("business_leads")
    .select("*")
    .eq("search_id", cachedJob.id)
    .limit(fetchLimit);

  if (leadsError || !rows || rows.length === 0) return null;

  if (rows.length < MIN_CACHE_LEADS_TO_REUSE) {
    logger.info("[search-diag] Cache skip — below reuse minimum", {
      priorSearchId: cachedJob.id,
      fetched: rows.length,
      minReuse: MIN_CACHE_LEADS_TO_REUSE,
    });
    return null;
  }

  // Prior search claimed more leads than we fetched — avoid silently under-delivering.
  if (
    priorTotalFound >= MIN_CACHE_LEADS_TO_REUSE &&
    rows.length < Math.floor(priorTotalFound * 0.9)
  ) {
    logger.warn("[search-diag] Cache under-delivery — skipping reuse for fresh scrape", {
      priorSearchId: cachedJob.id,
      priorTotalFound,
      fetched: rows.length,
      fetchLimit,
    });
    return null;
  }

  logger.info("[search-diag] Cache hit", {
    priorSearchId: cachedJob.id,
    priorTotalFound,
    fetched: rows.length,
    fetchLimit,
  });

  return {
    searchId: cachedJob.id as string,
    priorTotalFound,
    leads: rows.map((row) =>
      mapRowToBusinessLead(row as Record<string, unknown>)
    ),
  };
}

/** @deprecated Use getCachedSearch */
export async function getCachedResults(
  query: string,
  location: string
): Promise<BusinessLead[] | null> {
  const cached = await getCachedSearch(query, location);
  return cached?.leads ?? null;
}

export function copyCachedLeadsForInsert(
  leads: BusinessLead[],
  newSearchId: string
): Record<string, unknown>[] {
  return leads.map((lead) => {
    const fields = predictionStorageFields(lead);
    return {
      id: randomUUID(),
      search_id: newSearchId,
      name: lead.name,
      category: lead.category,
      address: lead.address,
      phone: lead.phone,
      email: fields.verified_email,
      email_source:
        lead.emailSource === "website"
          ? "extracted"
          : lead.emailSource === "predicted"
            ? "predicted"
            : "none",
      verified_email: fields.verified_email,
      predicted_email: fields.predicted_email,
      predicted_email_secondary: fields.predicted_email_secondary,
      prediction_confidence: fields.prediction_confidence,
      prediction_confidence_secondary: fields.prediction_confidence_secondary,
      website: lead.website,
      rating: lead.rating,
      review_count: lead.reviewCount,
      google_maps_url: lead.googleMapsUrl,
      has_website: lead.hasWebsite,
      has_instagram: lead.hasInstagram,
    };
  });
}
