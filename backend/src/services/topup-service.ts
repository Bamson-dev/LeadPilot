import { supabase } from "../database/client";
import { sendTopUpConfirmationEmail } from "./brevo-service";
import { logger } from "../utils/logger";

export const TOPUP_TIERS = [
  {
    id: "topup_300",
    credits: 300,
    amountKobo: 1_500_000,
    amountNgn: 15_000,
    amountUsd: 15,
    label: "Starter Top Up",
    searches: 100,
  },
  {
    id: "topup_750",
    credits: 750,
    amountKobo: 2_500_000,
    amountNgn: 25_000,
    amountUsd: 25,
    label: "Growth Top Up",
    searches: 250,
  },
  {
    id: "topup_1200",
    credits: 1200,
    amountKobo: 4_000_000,
    amountNgn: 40_000,
    amountUsd: 40,
    label: "Pro Top Up",
    searches: 400,
  },
  {
    id: "topup_2100",
    credits: 2100,
    amountKobo: 6_000_000,
    amountNgn: 60_000,
    amountUsd: 60,
    label: "Agency Top Up",
    searches: 700,
  },
] as const;

export type TopUpTierId = (typeof TOPUP_TIERS)[number]["id"];

export function getTopUpTier(tierId: string) {
  return TOPUP_TIERS.find((t) => t.id === tierId);
}

export function parseTopUpTierIdFromFlwRef(reference: string): string | null {
  if (!reference.startsWith("topup_flw_")) return null;
  const rest = reference.slice("topup_flw_".length);
  const lastUnderscore = rest.lastIndexOf("_");
  if (lastUnderscore <= 0) return null;
  return rest.slice(0, lastUnderscore);
}

export function isTopUpPaymentReference(reference: string): boolean {
  return reference.startsWith("topup_");
}

export async function fulfillTopUpPayment(params: {
  reference: string;
  amount: number;
  channel?: string;
  metadata: Record<string, unknown>;
}): Promise<{ processed: boolean; duplicate: boolean }> {
  const metadata = params.metadata;
  if (metadata.type !== "topup") {
    return { processed: false, duplicate: false };
  }

  const licenseId = String(metadata.licenseId ?? "");
  const credits = Number(metadata.credits ?? 0);
  const email = String(metadata.email ?? "").toLowerCase().trim();
  const tierId = String(metadata.tierId ?? "");
  const tier = tierId ? getTopUpTier(tierId) : undefined;
  const amountNgn =
    Number(metadata.amountNgn ?? 0) ||
    tier?.amountNgn ||
    Math.round((params.amount ?? 0) / 100);

  if (!licenseId || !credits || !email) {
    logger.error("Top up webhook missing metadata", { metadata, reference: params.reference });
    return { processed: false, duplicate: false };
  }

  const { data: existing } = await supabase
    .from("topup_purchases")
    .select("id")
    .eq("payment_reference", params.reference)
    .maybeSingle();

  if (existing) {
    logger.info("Duplicate top up webhook ignored", { reference: params.reference });
    return { processed: true, duplicate: true };
  }

  const { data: license } = await supabase
    .from("license_keys")
    .select("search_credits, total_credits_purchased")
    .eq("id", licenseId)
    .single();

  if (!license) {
    logger.error("Top up license not found", { licenseId, reference: params.reference });
    return { processed: false, duplicate: false };
  }

  const currentCredits = (license.search_credits as number) ?? 0;
  const totalPurchased = (license.total_credits_purchased as number) ?? 0;

  await supabase
    .from("license_keys")
    .update({
      search_credits: currentCredits + credits,
      total_credits_purchased: totalPurchased + credits,
    })
    .eq("id", licenseId);

  await supabase.from("topup_purchases").insert({
    email,
    license_id: licenseId,
    credits_purchased: credits,
    amount_ngn: amountNgn,
    payment_reference: params.reference,
    payment_channel: params.channel ?? "paystack",
  });

  void sendTopUpConfirmationEmail({
    email,
    credits,
    amountNgn,
  }).catch((err) =>
    logger.error("Failed to send top up confirmation email", {
      error: err instanceof Error ? err.message : "unknown",
      email,
    })
  );

  logger.info("Top up credits added successfully", { email, credits, licenseId });
  return { processed: true, duplicate: false };
}

export async function getLicenseUsage(licenseId: string): Promise<{
  monthly_search_limit: number;
  searches_used: number;
  search_credits: number;
  freeSearchesRemaining: number;
  creditSearchesRemaining: number;
} | null> {
  const { data: license, error } = await supabase
    .from("license_keys")
    .select(
      "searches_used, search_count, monthly_search_limit, search_credits, last_reset_at"
    )
    .eq("id", licenseId)
    .single();

  if (error || !license) return null;

  const now = new Date();
  const lastResetRaw = license.last_reset_at as string | null;
  const lastReset = lastResetRaw ? new Date(lastResetRaw) : now;
  const monthsSinceReset =
    (now.getFullYear() - lastReset.getFullYear()) * 12 +
    (now.getMonth() - lastReset.getMonth());

  let searchesUsed =
    (license.search_count as number | undefined) ??
    (license.searches_used as number | undefined) ??
    0;

  if (monthsSinceReset >= 1) {
    searchesUsed = 0;
  }

  const monthlyLimit = (license.monthly_search_limit as number | undefined) ?? 100;
  const searchCredits = (license.search_credits as number | undefined) ?? 0;
  const freeSearchesRemaining = Math.max(0, monthlyLimit - searchesUsed);

  return {
    monthly_search_limit: monthlyLimit,
    searches_used: searchesUsed,
    search_credits: searchCredits,
    freeSearchesRemaining,
    creditSearchesRemaining: Math.floor(searchCredits / 3),
  };
}
