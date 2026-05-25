import { supabase } from "../database/client";
import { config } from "../config/env";
import {
  COMMISSION_NGN,
  COMMISSION_USD,
  MIN_PAYOUT_NGN,
  NGN_PER_USD,
  SALE_PRICE_NGN,
  SALE_PRICE_USD,
} from "../constants/pricing";
import { sendCommissionNotification } from "./brevo-service";
import { logger } from "../utils/logger";

export function generateRefCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "LP-";
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export async function generateUniqueRefCode(): Promise<string> {
  for (let attempt = 0; attempt < 10; attempt++) {
    const code = generateRefCode();
    const { data } = await supabase
      .from("license_keys")
      .select("id")
      .eq("ref_code", code)
      .maybeSingle();
    if (!data) return code;
  }
  throw new Error("Failed to generate unique referral code");
}

export async function ensureRefCodeForEmail(email: string): Promise<string | null> {
  const normalized = email.toLowerCase().trim();
  const { data: license, error } = await supabase
    .from("license_keys")
    .select("id, ref_code")
    .eq("email", normalized)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !license) return null;
  if (license.ref_code) return license.ref_code as string;

  const refCode = await generateUniqueRefCode();
  const { error: updateError } = await supabase
    .from("license_keys")
    .update({ ref_code: refCode })
    .eq("id", license.id);

  if (updateError) throw new Error(updateError.message);
  return refCode;
}

export interface AffiliateStats {
  refCode: string | null;
  referralLink: string;
  totalReferrals: number;
  totalEarnedNgn: number;
  totalEarnedUsd: number;
  totalPaidNgn: number;
  pendingNgn: number;
  pendingUsd: number;
  canRequestPayout: boolean;
  commissions: Record<string, unknown>[];
}

export async function getAffiliateStats(email: string): Promise<AffiliateStats | null> {
  const normalized = email.toLowerCase().trim();
  const { data: license } = await supabase
    .from("license_keys")
    .select("ref_code, total_referrals, total_earned_ngn, total_paid_ngn")
    .eq("email", normalized)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!license) return null;

  let refCode = (license.ref_code as string | null) ?? null;
  if (!refCode) {
    refCode = await ensureRefCodeForEmail(normalized);
  }

  const { data: commissions } = await supabase
    .from("commissions")
    .select("*")
    .eq("referrer_email", normalized)
    .order("created_at", { ascending: false });

  const totalEarnedNgn = (license.total_earned_ngn as number) || 0;
  const totalPaidNgn = (license.total_paid_ngn as number) || 0;
  const pendingNgn = totalEarnedNgn - totalPaidNgn;

  const frontendBase = config.FRONTEND_URL.replace(/\/$/, "");
  const referralBase =
    frontendBase.includes("localhost") ? "https://www.leadpilot.live" : frontendBase;

  return {
    refCode,
    referralLink: refCode ? `${referralBase}/?ref=${refCode}` : referralBase,
    totalReferrals: (license.total_referrals as number) || 0,
    totalEarnedNgn,
    totalEarnedUsd: totalEarnedNgn / NGN_PER_USD,
    totalPaidNgn,
    pendingNgn,
    pendingUsd: pendingNgn / NGN_PER_USD,
    canRequestPayout: pendingNgn >= MIN_PAYOUT_NGN,
    commissions: commissions || [],
  };
}

export async function createCommissionForReferral(params: {
  refCode: string;
  referredEmail: string;
}): Promise<void> {
  const referredEmail = params.referredEmail.toLowerCase().trim();

  const { data: referrer } = await supabase
    .from("license_keys")
    .select("email, ref_code, total_referrals, total_earned_ngn")
    .eq("ref_code", params.refCode)
    .maybeSingle();

  if (!referrer || referrer.email === referredEmail) return;

  const { data: existing } = await supabase
    .from("commissions")
    .select("id")
    .eq("referred_email", referredEmail)
    .maybeSingle();

  if (existing) return;

  await supabase.from("commissions").insert({
    referrer_email: referrer.email,
    referrer_ref_code: params.refCode,
    referred_email: referredEmail,
    sale_amount_ngn: SALE_PRICE_NGN,
    commission_ngn: COMMISSION_NGN,
    sale_amount_usd: SALE_PRICE_USD,
    commission_usd: COMMISSION_USD,
    status: "pending",
  });

  const referrerEmail = referrer.email as string;

  await supabase
    .from("license_keys")
    .update({
      total_referrals: ((referrer.total_referrals as number) || 0) + 1,
      total_earned_ngn: ((referrer.total_earned_ngn as number) || 0) + COMMISSION_NGN,
    })
    .eq("email", referrerEmail);

  try {
    const { data: updatedLicense } = await supabase
      .from("license_keys")
      .select("total_earned_ngn, total_paid_ngn")
      .eq("email", referrerEmail)
      .maybeSingle();

    const totalEarnedNgn = (updatedLicense?.total_earned_ngn as number) || COMMISSION_NGN;
    const totalPaidNgn = (updatedLicense?.total_paid_ngn as number) || 0;
    const pendingNgn = totalEarnedNgn - totalPaidNgn;

    await sendCommissionNotification(
      referrerEmail,
      referredEmail,
      COMMISSION_NGN,
      COMMISSION_USD,
      totalEarnedNgn,
      totalEarnedNgn / NGN_PER_USD,
      pendingNgn
    );

    logger.info("Commission notification sent", { referrerEmail });
  } catch (err) {
    logger.error("Failed to send commission notification", {
      referrerEmail,
      error: err instanceof Error ? err.message : "unknown",
    });
  }
}
