import {
  OUTREACH_SUBSCRIPTION_TIERS,
  type OutreachSubscriptionTier,
} from "../constants/outreach-pricing";
import {
  getOutreachPaystackPlanCode,
  listOutreachPaystackPlans,
  upsertOutreachPaystackPlan,
} from "../database/outreach-repository";
import { createPaystackPlan, listPaystackPlans } from "./paystack-client";
import { logger } from "../utils/logger";

const PLAN_NAME_PREFIX = "LeadThur Outreach";

function planNameForTier(tier: OutreachSubscriptionTier): string {
  const config = OUTREACH_SUBSCRIPTION_TIERS.find((t) => t.id === tier);
  return `${PLAN_NAME_PREFIX} ${config?.label ?? tier}`;
}

export async function ensureOutreachPaystackPlans(): Promise<Record<string, string>> {
  const codes: Record<string, string> = {};

  for (const tier of OUTREACH_SUBSCRIPTION_TIERS) {
    const existing = await getOutreachPaystackPlanCode(tier.id);
    if (existing?.plan_code) {
      codes[tier.id] = existing.plan_code;
      continue;
    }

    const remotePlans = await listPaystackPlans();
    const name = planNameForTier(tier.id);
    const matched = remotePlans.find(
      (p) => p.name === name && p.amount === tier.amountKobo && p.interval === "monthly"
    );

    const planCode = matched
      ? matched.plan_code
      : (
          await createPaystackPlan({
            name,
            amountKobo: tier.amountKobo,
            interval: "monthly",
            description: `${tier.monthlyAllowance} sends/month, ${tier.maxMailboxes} mailbox(es)`,
          })
        ).plan_code;

    await upsertOutreachPaystackPlan({
      tier: tier.id,
      planCode,
      amountKobo: tier.amountKobo,
      monthlyAllowance: tier.monthlyAllowance,
      maxMailboxes: tier.maxMailboxes,
    });

    codes[tier.id] = planCode;
    logger.info("Outreach Paystack plan ensured", { tier: tier.id, planCode });
  }

  return codes;
}

export async function getOutreachPlanCodeForTier(tierId: string): Promise<string | null> {
  const row = await getOutreachPaystackPlanCode(tierId);
  return row?.plan_code ?? null;
}

export async function getAllStoredOutreachPlanCodes(): Promise<Record<string, string>> {
  const rows = await listOutreachPaystackPlans();
  const codes: Record<string, string> = {};
  for (const row of rows) {
    codes[row.tier] = row.plan_code;
  }
  return codes;
}
