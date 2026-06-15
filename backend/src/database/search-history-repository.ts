import { supabase } from "./client";

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
