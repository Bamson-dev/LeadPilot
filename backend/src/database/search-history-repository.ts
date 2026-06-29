import { supabase } from "./client";
import { logger } from "../utils/logger";
import { parseSearchLocation } from "../utils/search-location";

export type SearchHistoryRow = {
  id: string;
  email: string;
  business_type: string;
  city: string;
  country: string | null;
  results_count: number;
  created_at: string;
};

export async function insertSearchHistory(input: {
  email: string;
  business_type: string;
  city: string;
  country?: string | null;
  results_count: number;
}): Promise<SearchHistoryRow> {
  const { data, error } = await supabase
    .from("search_history")
    .insert({
      email: input.email.toLowerCase().trim(),
      business_type: input.business_type,
      city: input.city,
      country: input.country ?? null,
      results_count: input.results_count,
    })
    .select("*")
    .single();

  if (error) throw error;
  return data as SearchHistoryRow;
}

/** Update an existing row for the same email + niche + city, or insert if none exists. */
export async function upsertSearchHistory(input: {
  email: string;
  business_type: string;
  city: string;
  country?: string | null;
  results_count: number;
}): Promise<SearchHistoryRow> {
  const email = input.email.toLowerCase().trim();
  const business_type = input.business_type.trim();
  const city = input.city.trim();

  const { data: existing, error: lookupError } = await supabase
    .from("search_history")
    .select("id")
    .eq("email", email)
    .eq("business_type", business_type)
    .eq("city", city)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (lookupError) throw lookupError;

  if (existing?.id) {
    const { data, error } = await supabase
      .from("search_history")
      .update({
        results_count: input.results_count,
        country: input.country ?? null,
        created_at: new Date().toISOString(),
      })
      .eq("id", existing.id)
      .select("*")
      .single();

    if (error) throw error;
    return data as SearchHistoryRow;
  }

  return insertSearchHistory({ ...input, email, business_type, city });
}

export async function getSearchHistoryByEmail(
  email: string,
  limit = 50
): Promise<SearchHistoryRow[]> {
  const { data, error } = await supabase
    .from("search_history")
    .select("id, business_type, city, country, results_count, created_at")
    .eq("email", email.toLowerCase().trim())
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data ?? []) as SearchHistoryRow[];
}

export async function recordSearchHistorySafe(input: {
  email: string;
  business_type: string;
  location: string;
  results_count: number;
}): Promise<void> {
  if (!input.email?.trim() || !input.business_type?.trim() || !input.location?.trim()) {
    return;
  }
  if (input.results_count <= 0) return;

  try {
    const { city, country } = parseSearchLocation(input.location);
    await upsertSearchHistory({
      email: input.email,
      business_type: input.business_type.trim(),
      city: city || input.location.trim(),
      country: country ?? null,
      results_count: input.results_count,
    });
  } catch (err) {
    logger.error("Failed to record search history", {
      email: input.email,
      business_type: input.business_type,
      error: err instanceof Error ? err.message : "unknown",
    });
  }
}
