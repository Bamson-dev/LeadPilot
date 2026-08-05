"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CreditCard, RefreshCw } from "lucide-react";
import SearchLimitModal from "@/components/SearchLimitModal";
import { DiscoveryWorkspaceHeader } from "@/components/discovery/discovery-workspace-header";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Panel, PanelContent, PanelHeader, PanelTitle } from "@/components/ui/panel";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/ui/status-badge";
import { useOutreach } from "@/hooks/useOutreach";
import { getLicenseUsage, type LicenseUsage } from "@/services/api";
import {
  fetchOutreachBalance,
  initializeOutreachPackCheckout,
  initializeOutreachSubscriptionCheckout,
} from "@/services/outreach-api";
import type {
  OutreachBalance,
  OutreachCreditPack,
  OutreachSubscriptionTier,
} from "@/types/outreach";
import { cn } from "@/utils/utils";

/** Mirrors existing `/dashboard/plans` catalogs — do not invent new prices. */
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

function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return value;
  }
}

function savePendingOutreachCheckout(entry: StoredOutreachCheckout): void {
  localStorage.setItem("leadthur_outreach_checkout", JSON.stringify(entry));
}

function subscriptionBadge(
  status: string | undefined
): { status: "active" | "processing" | "paused" | "error"; label: string } {
  switch ((status || "").toLowerCase()) {
    case "active":
      return { status: "active", label: "Active" };
    case "grace":
    case "past_due":
      return { status: "processing", label: status || "Grace" };
    case "cancelled":
    case "canceled":
    case "disabled":
      return { status: "error", label: status || "Cancelled" };
    default:
      return { status: "paused", label: status || "None" };
  }
}

function KpiCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-xl border border-[var(--lt-border)] bg-[var(--lt-surface-2)] p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-[var(--lt-text-muted)]">
        {label}
      </p>
      <p className="mt-2 text-2xl font-semibold tabular-nums tracking-tight text-[var(--lt-text)]">
        {value}
      </p>
      {hint ? (
        <p className="mt-1 text-xs text-[var(--lt-text-subtle)]">{hint}</p>
      ) : null}
    </div>
  );
}

function BillingSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Loading billing">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={`bill-kpi-${i}`}
            className="rounded-xl border border-[var(--lt-border)] bg-[var(--lt-surface-2)] p-4"
          >
            <Skeleton className="h-3 w-24" />
            <Skeleton className="mt-2 h-8 w-20" />
          </div>
        ))}
      </div>
      <Skeleton className="h-48 w-full rounded-xl" />
      <Skeleton className="h-56 w-full rounded-xl" />
    </div>
  );
}

export function BillingPageWorkspace() {
  const outreach = useOutreach();
  const [usage, setUsage] = useState<LicenseUsage | null>(null);
  const [usageLoading, setUsageLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [topupOpen, setTopupOpen] = useState(false);
  const [loadingKey, setLoadingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadUsage = useCallback(async () => {
    setUsageLoading(true);
    try {
      const next = await getLicenseUsage();
      setUsage(next);
    } finally {
      setUsageLoading(false);
    }
  }, []);

  useEffect(() => {
    setEmail(localStorage.getItem("leadthur_email") || "");
    void loadUsage();
  }, [loadUsage]);

  const refreshAll = useCallback(async () => {
    setError(null);
    await Promise.all([loadUsage(), outreach.refresh()]);
  }, [loadUsage, outreach]);

  const balance: OutreachBalance | null = outreach.balance;

  const activeTierLabel = useMemo(() => {
    if (!balance?.subscription_tier) return "No active plan";
    const tier = OUTREACH_SUBSCRIPTION_TIERS.find(
      (item) => item.id === balance.subscription_tier
    );
    return tier?.label ?? balance.subscription_tier;
  }, [balance]);

  const subBadge = subscriptionBadge(balance?.subscription_status);

  const monthlyLimit = usage?.monthly_search_limit ?? 0;
  const searchesUsed = usage?.searches_used ?? 0;
  const searchUsagePct =
    monthlyLimit > 0
      ? Math.min(100, Math.round((searchesUsed / monthlyLimit) * 100))
      : 0;

  async function startSubscriptionCheckout(tier: OutreachSubscriptionTier) {
    setError(null);
    const hasActivePlan = balance?.subscription_status === "active";
    const currentTier = balance?.subscription_tier;
    if (hasActivePlan && currentTier && currentTier !== tier.id) {
      setError(
        `You already have an active ${currentTier} subscription. Plan switching is blocked in this release — manage your current plan first, then subscribe to ${tier.label}.`
      );
      return;
    }
    const key = `subscription:${tier.id}`;
    setLoadingKey(key);
    try {
      const checkout = await initializeOutreachSubscriptionCheckout(tier.id);
      const latestBalance = (await fetchOutreachBalance()) ?? balance;
      savePendingOutreachCheckout({
        reference: checkout.reference,
        type: "subscription",
        tier: tier.id,
        balance_before: latestBalance?.send_balance ?? 0,
        created_at: Date.now(),
      });
      window.location.href = checkout.authorization_url;
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to start subscription checkout."
      );
      setLoadingKey(null);
    }
  }

  async function startPackCheckout(pack: OutreachCreditPack) {
    setError(null);
    const key = `pack:${pack.id}`;
    setLoadingKey(key);
    try {
      const checkout = await initializeOutreachPackCheckout(pack.id);
      const latestBalance = (await fetchOutreachBalance()) ?? balance;
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

  const loading = usageLoading && outreach.loading;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 pb-8">
      <DiscoveryWorkspaceHeader
        title="Billing"
        subtitle="Search credits and outreach sends are separate wallets. Receipts come from Paystack or Flutterwave — not this app."
      />

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => void refreshAll()}
          disabled={loading}
        >
          <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
          Refresh
        </Button>
        <Button type="button" variant="soft" size="sm" asChild>
          <Link href="/dashboard/outreach">Outreach</Link>
        </Button>
        <Button type="button" variant="outline" size="sm" asChild>
          <Link href="/dashboard">Discovery</Link>
        </Button>
      </div>

      {error ? (
        <Alert variant="danger">
          <AlertTitle>Checkout issue</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {loading ? <BillingSkeleton /> : null}

      {!loading ? (
        <>
          <section
            aria-label="Balances"
            className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
          >
            <KpiCard
              label="Search credits"
              value={
                typeof usage?.search_credits === "number"
                  ? usage.search_credits.toLocaleString()
                  : "—"
              }
              hint={
                usage
                  ? `${usage.creditSearchesRemaining} searches from credits`
                  : undefined
              }
            />
            <KpiCard
              label="Free searches left"
              value={
                typeof usage?.freeSearchesRemaining === "number"
                  ? usage.freeSearchesRemaining.toLocaleString()
                  : "—"
              }
              hint={
                usage && monthlyLimit
                  ? `${searchesUsed}/${monthlyLimit} used this period`
                  : undefined
              }
            />
            <KpiCard
              label="Outreach send balance"
              value={(balance?.send_balance ?? 0).toLocaleString()}
              hint={`${activeTierLabel} · ${subBadge.label}`}
            />
            <KpiCard
              label="Mailboxes"
              value={`${balance?.mailbox_count ?? 0}/${balance?.max_mailboxes ?? 1}`}
              hint={`Free trial sends: ${(balance?.free_trial_remaining ?? 0).toLocaleString()}`}
            />
          </section>

          <div className="grid gap-4 lg:grid-cols-2">
            <Panel>
              <PanelHeader>
                <PanelTitle>Discovery usage</PanelTitle>
                <Button
                  type="button"
                  size="sm"
                  variant="soft"
                  onClick={() => setTopupOpen(true)}
                  disabled={!email}
                >
                  Purchase search credits
                </Button>
              </PanelHeader>
              <PanelContent className="space-y-4">
                {!usage ? (
                  <EmptyState
                    icon={<CreditCard className="h-5 w-5" />}
                    title="Usage unavailable"
                    description="Could not load search credits for this license."
                  />
                ) : (
                  <>
                    {monthlyLimit > 0 ? (
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-[var(--lt-text-muted)]">
                            Monthly free searches
                          </span>
                          <span className="tabular-nums">
                            {searchesUsed} / {monthlyLimit}
                          </span>
                        </div>
                        <Progress
                          value={searchUsagePct}
                          aria-label="Monthly free search usage"
                        />
                      </div>
                    ) : null}
                    <dl className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <dt className="text-[var(--lt-text-muted)]">Search credits</dt>
                        <dd className="mt-0.5 font-semibold tabular-nums">
                          {usage.search_credits.toLocaleString()}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-[var(--lt-text-muted)]">
                          Searches from credits
                        </dt>
                        <dd className="mt-0.5 font-semibold tabular-nums">
                          {usage.creditSearchesRemaining.toLocaleString()}
                        </dd>
                      </div>
                    </dl>
                    <p className="text-xs text-[var(--lt-text-subtle)]">
                      Search and AI messages use search credits (3 per action). This does
                      not buy outreach sends.
                    </p>
                  </>
                )}
              </PanelContent>
            </Panel>

            <Panel>
              <PanelHeader>
                <PanelTitle>Current outreach plan</PanelTitle>
                <StatusBadge status={subBadge.status} label={subBadge.label} />
              </PanelHeader>
              <PanelContent className="space-y-3 text-sm">
                {!balance ? (
                  <EmptyState
                    icon={<CreditCard className="h-5 w-5" />}
                    title="Balance unavailable"
                    description="Could not load outreach billing for this license."
                  />
                ) : (
                  <dl className="grid grid-cols-2 gap-3">
                    <div>
                      <dt className="text-[var(--lt-text-muted)]">Plan</dt>
                      <dd className="mt-0.5 font-semibold">{activeTierLabel}</dd>
                    </div>
                    <div>
                      <dt className="text-[var(--lt-text-muted)]">Renews</dt>
                      <dd className="mt-0.5 font-semibold">
                        {formatDate(balance.subscription_renews_at)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[var(--lt-text-muted)]">Monthly remaining</dt>
                      <dd className="mt-0.5 font-semibold tabular-nums">
                        {balance.monthly_allowance_remaining.toLocaleString()}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[var(--lt-text-muted)]">Purchased sends</dt>
                      <dd className="mt-0.5 font-semibold tabular-nums">
                        {balance.purchased_credits.toLocaleString()}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[var(--lt-text-muted)]">Allowance resets</dt>
                      <dd className="mt-0.5 font-semibold">
                        {formatDate(balance.monthly_allowance_reset_at)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[var(--lt-text-muted)]">Grace until</dt>
                      <dd className="mt-0.5 font-semibold">
                        {formatDate(balance.grace_until)}
                      </dd>
                    </div>
                  </dl>
                )}
                <p className="text-xs text-[var(--lt-text-subtle)]">
                  Cancel / upgrade / downgrade from the app is not supported. Plan switching
                  while another tier is active remains blocked. Lifecycle updates come from
                  Paystack webhooks.
                </p>
              </PanelContent>
            </Panel>
          </div>

          <Panel>
            <PanelHeader>
              <PanelTitle>Outreach subscriptions</PanelTitle>
            </PanelHeader>
            <PanelContent>
              <p className="mb-4 text-sm text-[var(--lt-text-muted)]">
                Monthly outreach plans for email sends and mailbox slots (Paystack). Does
                not purchase search credits.
              </p>
              <div className="grid gap-4 md:grid-cols-3">
                {OUTREACH_SUBSCRIPTION_TIERS.map((tier) => {
                  const key = `subscription:${tier.id}`;
                  const isLoading = loadingKey === key;
                  const isCurrent = balance?.subscription_tier === tier.id;
                  const blockedByActivePlan =
                    balance?.subscription_status === "active" &&
                    Boolean(balance?.subscription_tier) &&
                    !isCurrent;
                  return (
                    <article
                      key={tier.id}
                      className="flex flex-col rounded-xl border border-[var(--lt-border)] bg-[var(--lt-surface-2)] p-5"
                    >
                      <p className="text-sm font-semibold text-[var(--lt-text)]">
                        {tier.label}
                      </p>
                      <p className="mt-2 text-2xl font-semibold tabular-nums text-[var(--lt-text)]">
                        {formatNgn(tier.amount_ngn)}
                        <span className="ml-1 text-sm font-normal text-[var(--lt-text-muted)]">
                          /month
                        </span>
                      </p>
                      <ul className="mt-4 flex-1 space-y-2 text-sm text-[var(--lt-text-muted)]">
                        <li>
                          {tier.monthly_allowance.toLocaleString()} outreach sends/month
                        </li>
                        <li>{tier.max_mailboxes} mailbox slot(s)</li>
                      </ul>
                      <Button
                        type="button"
                        className="mt-5 w-full"
                        variant={isCurrent ? "soft" : "default"}
                        disabled={isLoading}
                        onClick={() => void startSubscriptionCheckout(tier)}
                      >
                        {isLoading
                          ? "Opening Paystack…"
                          : blockedByActivePlan
                            ? "Manage current plan first"
                            : isCurrent
                              ? "Current plan"
                              : "Subscribe"}
                      </Button>
                    </article>
                  );
                })}
              </div>
            </PanelContent>
          </Panel>

          <Panel>
            <PanelHeader>
              <PanelTitle>Outreach credit packs</PanelTitle>
            </PanelHeader>
            <PanelContent>
              <p className="mb-4 text-sm text-[var(--lt-text-muted)]">
                One-time outreach send credits. These add to outreach balance, not Discovery
                searches.
              </p>
              <div className="grid gap-4 md:grid-cols-3">
                {OUTREACH_CREDIT_PACKS.map((pack) => {
                  const key = `pack:${pack.id}`;
                  const isLoading = loadingKey === key;
                  return (
                    <article
                      key={pack.id}
                      className="flex flex-col rounded-xl border border-[var(--lt-border)] bg-[var(--lt-surface-2)] p-5"
                    >
                      <p className="text-sm font-semibold text-[var(--lt-text)]">
                        {pack.label}
                      </p>
                      <p className="mt-2 text-2xl font-semibold tabular-nums">
                        {formatNgn(pack.amount_ngn)}
                      </p>
                      <p className="mt-2 flex-1 text-sm text-[var(--lt-text-muted)]">
                        {pack.credits.toLocaleString()} outreach sends
                      </p>
                      <Button
                        type="button"
                        className="mt-5 w-full"
                        disabled={isLoading}
                        onClick={() => void startPackCheckout(pack)}
                      >
                        {isLoading ? "Opening Paystack…" : "Buy outreach credits"}
                      </Button>
                    </article>
                  );
                })}
              </div>
            </PanelContent>
          </Panel>

          <div className="grid gap-4 lg:grid-cols-2">
            <Panel>
              <PanelHeader>
                <PanelTitle>Billing history</PanelTitle>
              </PanelHeader>
              <PanelContent>
                <EmptyState
                  className="py-8"
                  icon={<CreditCard className="h-5 w-5" />}
                  title="No in-app billing history"
                  description="There is no user API for invoices, receipts, or purchase history. Check your Paystack or Flutterwave email receipts."
                />
              </PanelContent>
            </Panel>
            <Panel>
              <PanelHeader>
                <PanelTitle>Payment methods</PanelTitle>
              </PanelHeader>
              <PanelContent>
                <EmptyState
                  className="py-8"
                  icon={<CreditCard className="h-5 w-5" />}
                  title="Payment methods not managed here"
                  description="Cards are collected by Paystack (outreach + NG top-ups) or Flutterwave (non-NG search top-ups). No vault or cancel-subscription API exists for users."
                />
              </PanelContent>
            </Panel>
          </div>

          <Alert>
            <AlertTitle>Unsupported on Billing</AlertTitle>
            <AlertDescription>
              Invoices, downloadable receipts, transaction lists, forecasts, coupons, tax,
              multi-provider picker for outreach, and in-app cancel/upgrade/downgrade are
              omitted because those backends do not exist. Lifetime license purchase stays
              on{" "}
              <Link
                href="/checkout"
                className="text-[var(--lt-cyan)] underline-offset-2 hover:underline"
              >
                /checkout
              </Link>{" "}
              for new buyers.
            </AlertDescription>
          </Alert>
        </>
      ) : null}

      {topupOpen && email ? (
        <SearchLimitModal email={email} onClose={() => setTopupOpen(false)} />
      ) : null}
    </div>
  );
}
