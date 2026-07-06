export type OutreachSubscriptionTier = "starter" | "growth" | "scale";
export type OutreachCreditPackId = "small" | "medium" | "large";

export interface OutreachSubscriptionTierConfig {
  id: OutreachSubscriptionTier;
  label: string;
  amountNgn: number;
  amountKobo: number;
  monthlyAllowance: number;
  maxMailboxes: number;
}

export interface OutreachCreditPackConfig {
  id: OutreachCreditPackId;
  label: string;
  amountNgn: number;
  amountKobo: number;
  credits: number;
}

export const OUTREACH_SUBSCRIPTION_TIERS: OutreachSubscriptionTierConfig[] = [
  {
    id: "starter",
    label: "Starter",
    amountNgn: 5_000,
    amountKobo: 500_000,
    monthlyAllowance: 1_500,
    maxMailboxes: 1,
  },
  {
    id: "growth",
    label: "Growth",
    amountNgn: 10_000,
    amountKobo: 1_000_000,
    monthlyAllowance: 5_000,
    maxMailboxes: 3,
  },
  {
    id: "scale",
    label: "Scale",
    amountNgn: 20_000,
    amountKobo: 2_000_000,
    monthlyAllowance: 15_000,
    maxMailboxes: 5,
  },
];

export const OUTREACH_CREDIT_PACKS: OutreachCreditPackConfig[] = [
  {
    id: "small",
    label: "Small Pack",
    amountNgn: 5_000,
    amountKobo: 500_000,
    credits: 1_000,
  },
  {
    id: "medium",
    label: "Medium Pack",
    amountNgn: 10_000,
    amountKobo: 1_000_000,
    credits: 3_500,
  },
  {
    id: "large",
    label: "Large Pack",
    amountNgn: 20_000,
    amountKobo: 2_000_000,
    credits: 10_000,
  },
];

export function getOutreachSubscriptionTier(tierId: string): OutreachSubscriptionTierConfig | undefined {
  return OUTREACH_SUBSCRIPTION_TIERS.find((t) => t.id === tierId);
}

export function getOutreachCreditPack(packId: string): OutreachCreditPackConfig | undefined {
  return OUTREACH_CREDIT_PACKS.find((p) => p.id === packId);
}

export const OUTREACH_GRACE_DAYS = 3;
