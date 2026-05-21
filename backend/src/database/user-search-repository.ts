import { supabase } from "./client";
import { logger } from "../utils/logger";

export interface UserSearchRow {
  id: string;
  license_key: string;
  search_id: string | null;
  query: string;
  location: string;
  total_found: number;
  created_at: string;
}

export async function saveUserSearch(params: {
  licenseKey: string;
  searchId: string;
  query: string;
  location: string;
  totalFound: number;
}): Promise<void> {
  const { error } = await supabase.from("user_searches").insert({
    license_key: params.licenseKey.trim(),
    search_id: params.searchId,
    query: params.query.trim(),
    location: params.location.trim(),
    total_found: params.totalFound,
  });

  if (error) {
    logger.error("Failed to save search history", { error: error.message });
  }
}

export async function getUserSearchHistory(
  licenseKey: string,
  limit = 20
): Promise<UserSearchRow[]> {
  const { data, error } = await supabase
    .from("user_searches")
    .select("id, query, location, total_found, created_at, search_id")
    .eq("license_key", licenseKey.trim())
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    logger.error("Failed to fetch search history", { error: error.message });
    return [];
  }

  return (data ?? []) as UserSearchRow[];
}
