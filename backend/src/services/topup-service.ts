import { supabase } from "../database/client";
import { sendTopUpConfirmationEmail } from "./email";
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

/** Resolve tier id from Paystack/Flutterwave reference when metadata is missing. */
export function parseTopUpTierIdFromReference(reference: string): string | null {
  const flw = parseTopUpTierIdFromFlwRef(reference);
  if (flw) return flw;
  if (!reference.startsWith("topup_")) return null;
  // topup_<tierId>_<timestamp> e.g. topup_topup_300_1712345678
  const withoutPrefix = reference.slice("topup_".length);
  for (const tier of TOPUP_TIERS) {
    if (withoutPrefix.startsWith(`${tier.id}_`)) return tier.id;
  }
  return null;
}

export function isTopUpPaymentReference(reference: string): boolean {
  return reference.startsWith("topup_");
}

/**
 * Credits and paid amount are derived only from the server-side tier catalog.
 * Client/webhook `metadata.credits` is never trusted.
 */
export function resolveVerifiedTopUpTier(params: {
  reference: string;
  amount: number;
  channel?: string;
  metadata: Record<string, unknown>;
}):
  | {
      ok: true;
      tier: (typeof TOPUP_TIERS)[number];
      licenseId: string;
      email: string;
      credits: number;
      amountNgn: number;
    }
  | { ok: false; reason: string } {
  const metadata = params.metadata;
  const licenseId = String(metadata.licenseId ?? "").trim();
  const email = String(metadata.email ?? "").toLowerCase().trim();
  const tierId =
    String(metadata.tierId ?? "").trim() ||
    parseTopUpTierIdFromReference(params.reference) ||
    "";
  const tier = tierId ? getTopUpTier(tierId) : undefined;

  if (!tier) {
    return { ok: false, reason: "Unknown or missing top-up tier" };
  }
  if (!licenseId || !email.includes("@")) {
    return { ok: false, reason: "Missing licenseId or email" };
  }

  const channel = (params.channel ?? "paystack").toLowerCase();
  const amount = Number(params.amount ?? 0);

  if (channel === "flutterwave") {
    // Flutterwave charge.completed amounts are major units (USD).
    if (amount + 0.001 < tier.amountUsd) {
      return {
        ok: false,
        reason: `Flutterwave amount too low: paid ${amount} USD, expected >= ${tier.amountUsd}`,
      };
    }
  } else {
    // Paystack amounts are kobo.
    if (amount < tier.amountKobo) {
      return {
        ok: false,
        reason: `Paystack amount too low: paid ${amount} kobo, expected >= ${tier.amountKobo}`,
      };
    }
  }

  return {
    ok: true,
    tier,
    licenseId,
    email,
    credits: tier.credits,
    amountNgn: tier.amountNgn,
  };
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

  const verified = resolveVerifiedTopUpTier(params);
  if (!verified.ok) {
    logger.error("Top up payment rejected — credit/amount verification failed", {
      reason: verified.reason,
      reference: params.reference,
      amount: params.amount,
      channel: params.channel,
      metadataTierId: metadata.tierId,
      metadataCredits: metadata.credits,
    });
    return { processed: false, duplicate: false };
  }

  const { licenseId, email, credits, amountNgn } = verified;

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

  logger.info("Top up credits added successfully", {
    email,
    credits,
    licenseId,
    tierId: verified.tier.id,
  });
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
