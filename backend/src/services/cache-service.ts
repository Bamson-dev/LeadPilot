import type { BusinessLead } from "@leadpilot/shared";
import { supabase } from "../database/client";
import { logger } from "../utils/logger";

function normalize(value: string): string {
  return value.toLowerCase().trim();
}

export async function getCachedResults(
  query: string,
  location: string
): Promise<BusinessLead[] | null> {
  const normalizedQuery = normalize(query);
  const normalizedLocation = normalize(location);
  const cacheExpiry = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const { data: jobs, error: jobsError } = await supabase
    .from("search_jobs")
    .select("id, created_at")
    .eq("query", normalizedQuery)
    .eq("location", normalizedLocation)
    .eq("status", "completed")
    .gte("created_at", cacheExpiry)
    .order("created_at", { ascending: false })
    .limit(1);

  if (jobsError) {
    logger.warn("Cache lookup failed", { error: jobsError.message });
    return null;
  }

  if (!jobs || jobs.length === 0) return null;

  const cachedJobId = jobs[0].id;

  const { data: rows, error: leadsError } = await supabase
    .from("business_leads")
    .select("*")
    .eq("search_id", cachedJobId)
    .limit(200);

  if (leadsError) {
    logger.warn("Cache leads fetch failed", { error: leadsError.message });
    return null;
  }

  if (!rows || rows.length === 0) return null;

  return rows.map((row) => {
    const source = (row.email_source as string | null) ?? "none";
    return {
      id: row.id as string,
      searchId: row.search_id as string,
      name: row.name as string,
      category: (row.category as string) ?? "",
      address: (row.address as string) ?? "",
      phone: row.phone as string | null,
      email: row.email as string | null,
      emailSource:
        source === "extracted"
          ? "website"
          : source === "generated"
            ? "generated"
            : "none",
      website: row.website as string | null,
      rating: row.rating as number | null,
      reviewCount: row.review_count as number | null,
      googleMapsUrl: row.google_maps_url as string | null,
      hasWebsite: Boolean(row.has_website),
      hasInstagram: Boolean(row.has_instagram),
      createdAt: row.created_at as string,
    };
  });
}
