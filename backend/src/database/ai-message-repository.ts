import { supabase } from "./client";

const AI_CREDIT_COST = 3;
const AI_BONUS_CREDITS = 10;

export async function getSearchCreditsBalance(
  licenseId: string
): Promise<number | null> {
  const { data, error } = await supabase
    .from("license_keys")
    .select("search_credits")
    .eq("id", licenseId)
    .maybeSingle();

  if (error || !data) return null;
  return (data.search_credits as number | undefined) ?? 0;
}

export async function deductAiMessageCredits(
  licenseId: string
): Promise<{ success: boolean; balance: number }> {
  const current = await getSearchCreditsBalance(licenseId);
  if (current === null || current < AI_CREDIT_COST) {
    return { success: false, balance: current ?? 0 };
  }

  const nextBalance = current - AI_CREDIT_COST;
  const { data, error } = await supabase
    .from("license_keys")
    .update({ search_credits: nextBalance })
    .eq("id", licenseId)
    .eq("search_credits", current)
    .select("search_credits")
    .maybeSingle();

  if (error || !data) {
    return { success: false, balance: current };
  }

  return {
    success: true,
    balance: (data.search_credits as number | undefined) ?? nextBalance,
  };
}

export async function refundAiMessageCredits(
  licenseId: string
): Promise<number | null> {
  const current = await getSearchCreditsBalance(licenseId);
  if (current === null) return null;

  const nextBalance = current + AI_CREDIT_COST;
  const { data, error } = await supabase
    .from("license_keys")
    .update({ search_credits: nextBalance })
    .eq("id", licenseId)
    .select("search_credits")
    .maybeSingle();

  if (error || !data) return null;
  return (data.search_credits as number | undefined) ?? nextBalance;
}

export async function logAiMessageGeneration(params: {
  email: string;
  business_name: string;
  niche: string | null;
}): Promise<void> {
  await supabase.from("ai_message_log").insert({
    email: params.email.toLowerCase().trim(),
    business_name: params.business_name.trim(),
    niche: params.niche,
  });
}

export async function applyAiBonusIfEligible(licenseId: string): Promise<{
  applied: boolean;
  search_credits: number;
}> {
  const { data: license, error } = await supabase
    .from("license_keys")
    .select("search_credits, ai_bonus_applied, activated")
    .eq("id", licenseId)
    .maybeSingle();

  if (error || !license) {
    return { applied: false, search_credits: 0 };
  }

  const currentCredits = (license.search_credits as number | undefined) ?? 0;
  const bonusApplied = Boolean(license.ai_bonus_applied);
  const activated = Boolean(license.activated);

  if (!activated || bonusApplied) {
    return { applied: false, search_credits: currentCredits };
  }

  const nextCredits = currentCredits + AI_BONUS_CREDITS;
  const { data: updated, error: updateError } = await supabase
    .from("license_keys")
    .update({
      search_credits: nextCredits,
      ai_bonus_applied: true,
    })
    .eq("id", licenseId)
    .eq("ai_bonus_applied", false)
    .select("search_credits")
    .maybeSingle();

  if (updateError || !updated) {
    return { applied: false, search_credits: currentCredits };
  }

  return {
    applied: true,
    search_credits: (updated.search_credits as number | undefined) ?? nextCredits,
  };
}
