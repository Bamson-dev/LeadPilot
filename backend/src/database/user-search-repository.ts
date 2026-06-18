import { supabase } from "./client";
import { getLicenseByKeyAndEmail } from "./license-repository";
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
    license_key: params.licenseKey.trim().toUpperCase(),
    search_id: params.searchId,
    query: params.query.trim(),
    location: params.location.trim(),
    total_found: params.totalFound,
  });

  if (error) {
    logger.error("Failed to save search history", { error: error.message });
  }
}

function normalizeLicenseKey(licenseKey: string): string {
  return licenseKey.trim().toUpperCase();
}

export async function userOwnsSearchJob(
  searchId: string,
  licenseKey: string,
  licenseEmail?: string
): Promise<boolean> {
  const normalizedKey = normalizeLicenseKey(licenseKey);
  const { data, error } = await supabase
    .from("user_searches")
    .select("id, license_key")
    .eq("search_id", searchId)
    .limit(10);

  if (error) {
    logger.error("Failed to verify search ownership", { error: error.message });
    return false;
  }

  const rows = data ?? [];
  if (rows.some((row) => normalizeLicenseKey(String(row.license_key ?? "")) === normalizedKey)) {
    return true;
  }

  if (!licenseEmail) return false;

  const normalizedEmail = licenseEmail.toLowerCase().trim();
  for (const row of rows) {
    const rowKey = normalizeLicenseKey(String(row.license_key ?? ""));
    if (!rowKey) continue;
    const license = await getLicenseByKeyAndEmail(rowKey, normalizedEmail);
    if (license) return true;
  }

  return false;
}

export async function searchJobHasOwnershipRecord(searchId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from("user_searches")
    .select("id")
    .eq("search_id", searchId)
    .limit(1);

  if (error) {
    logger.error("Failed to check search ownership records", { error: error.message });
    return false;
  }

  return (data?.length ?? 0) > 0;
}

export async function getUserSearchHistory(
  licenseKey: string,
  limit = 20
): Promise<UserSearchRow[]> {
  const { data, error } = await supabase
    .from("user_searches")
    .select("id, query, location, total_found, created_at, search_id")
    .eq("license_key", licenseKey.trim().toUpperCase())
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    logger.error("Failed to fetch search history", { error: error.message });
    return [];
  }

  return (data ?? []) as UserSearchRow[];
}
