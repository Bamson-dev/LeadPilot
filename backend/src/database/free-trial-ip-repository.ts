import { supabase } from "./client";

const MAX_TRIAL_SEARCHES_PER_IP = 2;

export type ClaimTrialIpSearchResult =
  | {
      allowed: true;
      searchesUsed: number;
      searchesRemaining: number;
    }
  | {
      allowed: false;
      reason: "limit";
      searchesUsed: number;
      searchesRemaining: number;
    };

export async function getTrialIpSearchStatus(ip: string): Promise<{
  searchesUsed: number;
  searchesRemaining: number;
  maxSearches: number;
}> {
  const normalized = ip.trim();
  const { data, error } = await supabase
    .from("free_trial_ip_usage")
    .select("searches_used")
    .eq("ip_address", normalized)
    .maybeSingle();

  if (error) throw new Error(error.message);

  const searchesUsed = data?.searches_used ?? 0;
  return {
    searchesUsed,
    searchesRemaining: Math.max(0, MAX_TRIAL_SEARCHES_PER_IP - searchesUsed),
    maxSearches: MAX_TRIAL_SEARCHES_PER_IP,
  };
}

export async function claimTrialIpSearch(ip: string): Promise<ClaimTrialIpSearchResult> {
  const normalized = ip.trim();

  for (let attempt = 0; attempt < 4; attempt++) {
    const existing = await supabase
      .from("free_trial_ip_usage")
      .select("searches_used")
      .eq("ip_address", normalized)
      .maybeSingle();

    if (existing.error) throw new Error(existing.error.message);

    if (!existing.data) {
      const { data, error } = await supabase
        .from("free_trial_ip_usage")
        .insert({ ip_address: normalized, searches_used: 1 })
        .select("searches_used")
        .maybeSingle();

      if (error) {
        if (error.code === "23505") continue;
        throw new Error(error.message);
      }

      if (data) {
        const used = Number(data.searches_used ?? 1);
        return {
          allowed: true,
          searchesUsed: used,
          searchesRemaining: Math.max(0, MAX_TRIAL_SEARCHES_PER_IP - used),
        };
      }
      continue;
    }

    const current = existing.data.searches_used ?? 0;
    if (current >= MAX_TRIAL_SEARCHES_PER_IP) {
      return {
        allowed: false,
        reason: "limit",
        searchesUsed: current,
        searchesRemaining: 0,
      };
    }

    const { data, error } = await supabase
      .from("free_trial_ip_usage")
      .update({ searches_used: current + 1, updated_at: new Date().toISOString() })
      .eq("ip_address", normalized)
      .eq("searches_used", current)
      .select("searches_used")
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (data) {
      const used = Number(data.searches_used ?? current + 1);
      return {
        allowed: true,
        searchesUsed: used,
        searchesRemaining: Math.max(0, MAX_TRIAL_SEARCHES_PER_IP - used),
      };
    }
  }

  const final = await getTrialIpSearchStatus(normalized);
  if (final.searchesUsed >= MAX_TRIAL_SEARCHES_PER_IP) {
    return {
      allowed: false,
      reason: "limit",
      searchesUsed: final.searchesUsed,
      searchesRemaining: 0,
    };
  }

  throw new Error("Failed to claim trial IP search slot");
}

export async function releaseTrialIpSearch(ip: string): Promise<void> {
  const normalized = ip.trim();

  for (let attempt = 0; attempt < 4; attempt++) {
    const existing = await supabase
      .from("free_trial_ip_usage")
      .select("searches_used")
      .eq("ip_address", normalized)
      .maybeSingle();

    if (existing.error) throw new Error(existing.error.message);
    if (!existing.data) return;

    const current = existing.data.searches_used ?? 0;
    if (current <= 0) return;

    const { data, error } = await supabase
      .from("free_trial_ip_usage")
      .update({ searches_used: current - 1, updated_at: new Date().toISOString() })
      .eq("ip_address", normalized)
      .eq("searches_used", current)
      .select("searches_used")
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (data) return;
  }
}
