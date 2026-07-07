"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type {
  OutreachBalance,
  OutreachCreditPack,
  OutreachSubscriptionTier,
} from "@/types/outreach";
import {
  fetchOutreachBalance,
  initializeOutreachPackCheckout,
  initializeOutreachSubscriptionCheckout,
} from "@/services/outreach-api";
import { useOutreach } from "@/hooks/useOutreach";

const OUTREACH_SUBSCRIPTION_TIERS: OutreachSubscriptionTier[] = [
  {
    id: "starter",
    label: "Starter",
    amount_ngn: 5000,
    monthly_allowance: 1500,
    max_mailboxes: 1,
  },
  {
    id: "growth",
    label: "Growth",
    amount_ngn: 10000,
    monthly_allowance: 5000,
    max_mailboxes: 3,
  },
  {
    id: "scale",
    label: "Scale",
    amount_ngn: 20000,
    monthly_allowance: 15000,
    max_mailboxes: 5,
  },
];

const OUTREACH_CREDIT_PACKS: OutreachCreditPack[] = [
  { id: "small", label: "Small Pack", amount_ngn: 5000, credits: 1000 },
  { id: "medium", label: "Medium Pack", amount_ngn: 10000, credits: 3500 },
  { id: "large", label: "Large Pack", amount_ngn: 20000, credits: 10000 },
];

interface StoredOutreachCheckout {
  reference: string;
  type: "subscription" | "pack";
  tier?: string;
  pack_id?: string;
  pack_credits?: number;
  balance_before: number;
  created_at: number;
}

function formatNgn(amount: number): string {
  return `₦${amount.toLocaleString()}`;
}

function formatDate(value: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-NG", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function savePendingOutreachCheckout(entry: StoredOutreachCheckout): void {
  localStorage.setItem("leadthur_outreach_checkout", JSON.stringify(entry));
}

export default function OutreachPlansPage() {
  const outreach = useOutreach();
  const [loadingKey, setLoadingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const activeTierLabel = useMemo(() => {
    if (!outreach.balance?.subscription_tier) return "No active plan";
    const tier = OUTREACH_SUBSCRIPTION_TIERS.find(
      (item) => item.id === outreach.balance?.subscription_tier
    );
    return tier?.label ?? outreach.balance.subscription_tier;
  }, [outreach.balance]);

  async function startSubscriptionCheckout(tier: OutreachSubscriptionTier) {
    setError(null);
    const key = `subscription:${tier.id}`;
    setLoadingKey(key);
    try {
      const checkout = await initializeOutreachSubscriptionCheckout(tier.id);
      const latestBalance = (await fetchOutreachBalance()) ?? outreach.balance;
      savePendingOutreachCheckout({
        reference: checkout.reference,
        type: "subscription",
        tier: tier.id,
        balance_before: latestBalance?.send_balance ?? 0,
        created_at: Date.now(),
      });
      window.location.href = checkout.authorization_url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to start subscription checkout.");
      setLoadingKey(null);
    }
  }

  async function startPackCheckout(pack: OutreachCreditPack) {
    setError(null);
    const key = `pack:${pack.id}`;
    setLoadingKey(key);
    try {
      const checkout = await initializeOutreachPackCheckout(pack.id);
      const latestBalance = (await fetchOutreachBalance()) ?? outreach.balance;
      savePendingOutreachCheckout({
        reference: checkout.reference,
        type: "pack",
        pack_id: pack.id,
        pack_credits: pack.credits,
        balance_before: latestBalance?.send_balance ?? 0,
        created_at: Date.now(),
      });
      window.location.href = checkout.authorization_url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to start pack checkout.");
      setLoadingKey(null);
    }
  }

  const balance: OutreachBalance | null = outreach.balance;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <div className="mb-6 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#F4F4FF]">Outreach billing</h1>
          <p className="mt-1 text-sm text-[#8888A8]">
            Buy email outreach sends only. This does not purchase search credits.
          </p>
        </div>
        <Link href="/dashboard" className="text-sm text-[#A855F7] underline">
          Back to dashboard
        </Link>
      </div>

      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-white/10 bg-[#111118] p-4">
          <p className="text-xs uppercase tracking-wide text-[#6B6B80]">Send balance</p>
          <p className="mt-1 text-2xl font-bold text-[#F4F4FF]">
            {(balance?.send_balance ?? 0).toLocaleString()}
          </p>
        </div>
        <div className="rounded-xl border border-white/10 bg-[#111118] p-4">
          <p className="text-xs uppercase tracking-wide text-[#6B6B80]">Current plan</p>
          <p className="mt-1 text-lg font-semibold text-[#F4F4FF]">{activeTierLabel}</p>
          <p className="mt-1 text-xs text-[#8888A8]">
            Renews: {formatDate(balance?.subscription_renews_at ?? null)}
          </p>
        </div>
        <div className="rounded-xl border border-white/10 bg-[#111118] p-4">
          <p className="text-xs uppercase tracking-wide text-[#6B6B80]">Monthly sends</p>
          <p className="mt-1 text-2xl font-bold text-[#F4F4FF]">
            {(balance?.monthly_allowance_remaining ?? 0).toLocaleString()}
          </p>
          <p className="mt-1 text-xs text-[#8888A8]">
            Purchased: {(balance?.purchased_credits ?? 0).toLocaleString()}
          </p>
        </div>
        <div className="rounded-xl border border-white/10 bg-[#111118] p-4">
          <p className="text-xs uppercase tracking-wide text-[#6B6B80]">Mailboxes</p>
          <p className="mt-1 text-2xl font-bold text-[#F4F4FF]">
            {(balance?.mailbox_count ?? 0).toLocaleString()}/
            {(balance?.max_mailboxes ?? 1).toLocaleString()}
          </p>
          <p className="mt-1 text-xs text-[#8888A8]">
            Free trial: {(balance?.free_trial_remaining ?? 0).toLocaleString()}
          </p>
        </div>
      </div>

      {error && (
        <div className="mb-5 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      <section className="mb-8">
        <h2 className="mb-3 text-lg font-semibold text-[#F4F4FF]">Subscriptions</h2>
        <p className="mb-4 text-sm text-[#8888A8]">
          Monthly outreach plans for email sends and mailbox slots.
        </p>
        <div className="grid gap-4 md:grid-cols-3">
          {OUTREACH_SUBSCRIPTION_TIERS.map((tier) => {
            const key = `subscription:${tier.id}`;
            const isLoading = loadingKey === key;
            const isCurrent = balance?.subscription_tier === tier.id;
            return (
              <article
                key={tier.id}
                className="rounded-xl border border-white/10 bg-[#111118] p-5"
              >
                <p className="text-sm font-semibold text-[#F4F4FF]">{tier.label}</p>
                <p className="mt-2 text-2xl font-bold text-[#F4F4FF]">
                  {formatNgn(tier.amount_ngn)}
                  <span className="ml-1 text-sm font-normal text-[#8888A8]">/month</span>
                </p>
                <ul className="mt-4 space-y-2 text-sm text-[#C0C0D8]">
                  <li>{tier.monthly_allowance.toLocaleString()} outreach sends/month</li>
                  <li>{tier.max_mailboxes} mailbox slot(s)</li>
                  <li>Outreach sends only (separate from search credits)</li>
                </ul>
                <button
                  type="button"
                  onClick={() => void startSubscriptionCheckout(tier)}
                  disabled={isLoading}
                  className="mt-5 w-full rounded-lg border border-[#A855F7]/50 bg-[#A855F7]/20 px-3 py-2 text-sm font-medium text-[#F4F4FF] hover:bg-[#A855F7]/30 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isLoading
                    ? "Opening Paystack..."
                    : isCurrent
                      ? "Change subscription"
                      : "Subscribe"}
                </button>
              </article>
            );
          })}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold text-[#F4F4FF]">Credit packs</h2>
        <p className="mb-4 text-sm text-[#8888A8]">
          One-time outreach send credits. These add to outreach balance, not searches.
        </p>
        <div className="grid gap-4 md:grid-cols-3">
          {OUTREACH_CREDIT_PACKS.map((pack) => {
            const key = `pack:${pack.id}`;
            const isLoading = loadingKey === key;
            return (
              <article
                key={pack.id}
                className="rounded-xl border border-white/10 bg-[#111118] p-5"
              >
                <p className="text-sm font-semibold text-[#F4F4FF]">{pack.label}</p>
                <p className="mt-2 text-2xl font-bold text-[#F4F4FF]">
                  {formatNgn(pack.amount_ngn)}
                </p>
                <p className="mt-2 text-sm text-[#C0C0D8]">
                  {pack.credits.toLocaleString()} outreach sends
                </p>
                <button
                  type="button"
                  onClick={() => void startPackCheckout(pack)}
                  disabled={isLoading}
                  className="mt-5 w-full rounded-lg border border-[#A855F7]/50 bg-[#A855F7]/20 px-3 py-2 text-sm font-medium text-[#F4F4FF] hover:bg-[#A855F7]/30 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isLoading ? "Opening Paystack..." : "Buy credits"}
                </button>
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}
