import { supabase } from "./client";

export interface FreeTrialSignup {
  id: string;
  email: string;
  signed_up_at: string;
  searches_used: number;
  converted: boolean;
  converted_at: string | null;
  sequence_step: number;
  sequence_paused: boolean;
  last_email_sent_at: string | null;
  created_at: string;
}

export async function getTrialSignupByEmail(
  email: string
): Promise<FreeTrialSignup | null> {
  const normalized = email.toLowerCase().trim();
  const { data, error } = await supabase
    .from("free_trial_signups")
    .select("*")
    .eq("email", normalized)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data as FreeTrialSignup | null;
}

export async function createTrialSignup(email: string): Promise<FreeTrialSignup> {
  const normalized = email.toLowerCase().trim();
  const { data, error } = await supabase
    .from("free_trial_signups")
    .insert({ email: normalized })
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return data as FreeTrialSignup;
}

export async function incrementTrialSearchesUsed(email: string): Promise<void> {
  const normalized = email.toLowerCase().trim();
  const existing = await getTrialSignupByEmail(normalized);
  if (!existing) return;

  const { error } = await supabase
    .from("free_trial_signups")
    .update({ searches_used: (existing.searches_used || 0) + 1 })
    .eq("email", normalized);

  if (error) throw new Error(error.message);
}

export async function releaseTrialSearch(email: string): Promise<void> {
  const normalized = email.toLowerCase().trim();

  for (let attempt = 0; attempt < 4; attempt++) {
    const existing = await getTrialSignupByEmail(normalized);
    if (!existing) return;

    const current = existing.searches_used ?? 0;
    if (current <= 0) return;

    const { data, error } = await supabase
      .from("free_trial_signups")
      .update({ searches_used: current - 1 })
      .eq("email", normalized)
      .eq("searches_used", current)
      .select("searches_used")
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (data) return;
  }
}

export type ClaimTrialSearchResult =
  | {
      allowed: true;
      searchesUsed: number;
      searchesRemaining: number;
    }
  | {
      allowed: false;
      reason: "not_found" | "limit";
      searchesUsed: number;
      searchesRemaining: number;
    };

export async function claimTrialSearch(email: string): Promise<ClaimTrialSearchResult> {
  const normalized = email.toLowerCase().trim();

  for (let attempt = 0; attempt < 4; attempt++) {
    const existing = await getTrialSignupByEmail(normalized);
    if (!existing) {
      return {
        allowed: false,
        reason: "not_found",
        searchesUsed: 0,
        searchesRemaining: 0,
      };
    }

    const current = existing.searches_used ?? 0;
    if (current >= 2) {
      return {
        allowed: false,
        reason: "limit",
        searchesUsed: current,
        searchesRemaining: 0,
      };
    }

    const { data, error } = await supabase
      .from("free_trial_signups")
      .update({ searches_used: current + 1 })
      .eq("email", normalized)
      .eq("searches_used", current)
      .select("searches_used")
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (data) {
      const used = Number(data.searches_used ?? current + 1);
      return {
        allowed: true,
        searchesUsed: used,
        searchesRemaining: Math.max(0, 2 - used),
      };
    }
  }

  const final = await getTrialSignupByEmail(normalized);
  const used = final?.searches_used ?? 2;
  return {
    allowed: false,
    reason: "limit",
    searchesUsed: used,
    searchesRemaining: Math.max(0, 2 - used),
  };
}

export async function getTrialSearchStatus(email: string): Promise<{
  searchesUsed: number;
  searchesRemaining: number;
  maxSearches: number;
} | null> {
  const signup = await getTrialSignupByEmail(email);
  if (!signup) return null;

  const maxSearches = 2;
  const searchesUsed = signup.searches_used ?? 0;
  return {
    searchesUsed,
    searchesRemaining: Math.max(0, maxSearches - searchesUsed),
    maxSearches,
  };
}

export async function markTrialSignupConverted(email: string): Promise<void> {
  const normalized = email.toLowerCase().trim();
  const existing = await getTrialSignupByEmail(normalized);
  if (!existing) return;

  const { error } = await supabase
    .from("free_trial_signups")
    .update({
      converted: true,
      converted_at: new Date().toISOString(),
      sequence_paused: true,
    })
    .eq("email", normalized);

  if (error) throw new Error(error.message);
}

export async function pauseTrialSequence(email: string): Promise<void> {
  const normalized = email.toLowerCase().trim();
  const { error } = await supabase
    .from("free_trial_signups")
    .update({ sequence_paused: true })
    .eq("email", normalized);

  if (error) throw new Error(error.message);
}

export async function updateTrialSequenceProgress(
  email: string,
  sequenceStep: number
): Promise<void> {
  const normalized = email.toLowerCase().trim();
  const { error } = await supabase
    .from("free_trial_signups")
    .update({
      sequence_step: sequenceStep,
      last_email_sent_at: new Date().toISOString(),
    })
    .eq("email", normalized);

  if (error) throw new Error(error.message);
}

export async function listTrialSignups(): Promise<FreeTrialSignup[]> {
  const { data, error } = await supabase
    .from("free_trial_signups")
    .select(
      "id, email, signed_up_at, searches_used, converted, converted_at, sequence_step, sequence_paused, last_email_sent_at, created_at"
    )
    .order("signed_up_at", { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as FreeTrialSignup[];
}

export async function listTrialSignupsDueForSequence(): Promise<FreeTrialSignup[]> {
  const { data, error } = await supabase
    .from("free_trial_signups")
    .select("*")
    .eq("converted", false)
    .eq("sequence_paused", false)
    .lt("sequence_step", 15);

  if (error) throw new Error(error.message);
  return (data ?? []) as FreeTrialSignup[];
}

export async function recordTrialEmailOpen(email: string, step: number): Promise<void> {
  const normalized = email.toLowerCase().trim();
  const existing = await supabase
    .from("trial_email_opens")
    .select("open_count")
    .eq("email", normalized)
    .eq("step", step)
    .maybeSingle();

  if (existing.error) throw new Error(existing.error.message);

  if (!existing.data) {
    const { error } = await supabase
      .from("trial_email_opens")
      .insert({
        email: normalized,
        step,
        open_count: 1,
        last_opened_at: new Date().toISOString(),
      });

    if (error) throw new Error(error.message);
    return;
  }

  const { error } = await supabase
    .from("trial_email_opens")
    .update({
      open_count: (existing.data.open_count || 0) + 1,
      last_opened_at: new Date().toISOString(),
    })
    .eq("email", normalized)
    .eq("step", step);

  if (error) throw new Error(error.message);
}
