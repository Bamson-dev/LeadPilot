"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Check, Copy, Link2, RefreshCw, Users } from "lucide-react";
import { DiscoveryWorkspaceHeader } from "@/components/discovery/discovery-workspace-header";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Panel, PanelContent, PanelHeader, PanelTitle } from "@/components/ui/panel";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  COMMISSION_NGN,
  COMMISSION_USD,
  MIN_PAYOUT_NGN,
} from "@/constants/pricing";
import {
  fetchAffiliateBanks,
  fetchAffiliateStats,
  requestAffiliatePayout,
  resolveAffiliateAccount,
  saveAffiliateBankDetails,
} from "@/services/affiliate-api";
import type { AffiliateBank, AffiliateStats } from "@/types/affiliate";
import { maskReferredEmail } from "@/types/affiliate";
import { cn } from "@/utils/utils";

type LoadState = "loading" | "ready" | "error" | "unavailable";

function formatMoneyUsd(value: number): string {
  return `$${value.toFixed(2)}`;
}

function formatMoneyNgn(value: number): string {
  return `₦${value.toLocaleString()}`;
}

function formatDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat(undefined, {
      day: "numeric",
      month: "short",
      year: "numeric",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function commissionStatusBadge(status?: string): {
  status: "active" | "processing" | "paused" | "error";
  label: string;
} {
  switch ((status || "").toLowerCase()) {
    case "paid":
      return { status: "active", label: "Paid" };
    case "pending":
      return { status: "processing", label: "Pending" };
    case "cancelled":
    case "failed":
      return { status: "error", label: status || "Failed" };
    default:
      return { status: "paused", label: status || "Recorded" };
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

function AffiliateSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Loading affiliate">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={`aff-kpi-${i}`}
            className="rounded-xl border border-[var(--lt-border)] bg-[var(--lt-surface-2)] p-4"
          >
            <Skeleton className="h-3 w-24" />
            <Skeleton className="mt-2 h-8 w-20" />
          </div>
        ))}
      </div>
      <Skeleton className="h-40 w-full rounded-xl" />
      <Skeleton className="h-56 w-full rounded-xl" />
    </div>
  );
}

export function AffiliatePageWorkspace() {
  const [state, setState] = useState<LoadState>("loading");
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<AffiliateStats | null>(null);
  const [banks, setBanks] = useState<AffiliateBank[]>([]);
  const [selectedBank, setSelectedBank] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [resolvedName, setResolvedName] = useState("");
  const [resolvingAccount, setResolvingAccount] = useState(false);
  const [savingBank, setSavingBank] = useState(false);
  const [payoutLoading, setPayoutLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{
    tone: "success" | "danger";
    text: string;
  } | null>(null);

  const load = useCallback(async () => {
    setState("loading");
    setError(null);
    try {
      const [statsRes, banksRes] = await Promise.all([
        fetchAffiliateStats(),
        fetchAffiliateBanks().catch(() => [] as AffiliateBank[]),
      ]);
      setBanks(banksRes);
      if (!statsRes) {
        setStats(null);
        setState("unavailable");
        return;
      }
      setStats(statsRes);
      setState("ready");
    } catch {
      setError("Could not load affiliate data. Try again.");
      setState("error");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (accountNumber.length !== 10 || !selectedBank) {
      setResolvedName("");
      return;
    }
    let cancelled = false;
    setResolvingAccount(true);
    setResolvedName("");
    void (async () => {
      try {
        const result = await resolveAffiliateAccount({
          accountNumber,
          bankCode: selectedBank,
        });
        if (!cancelled) setResolvedName(result.accountName);
      } catch (err) {
        if (!cancelled) {
          setResolvedName("");
          setStatusMsg({
            tone: "danger",
            text: err instanceof Error ? err.message : "Account resolution failed.",
          });
        }
      } finally {
        if (!cancelled) setResolvingAccount(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [accountNumber, selectedBank]);

  const whatsappHref = useMemo(() => {
    if (!stats?.referralLink) return "#";
    const text = encodeURIComponent(
      `I have been using LeadThur to find business clients and it actually works. You can find 1,000+ business contacts in any city in 60 seconds. Try it free here: ${stats.referralLink}`
    );
    return `https://wa.me/?text=${text}`;
  }, [stats?.referralLink]);

  const xHref = useMemo(() => {
    if (!stats?.referralLink) return "#";
    const text = encodeURIComponent(
      "This tool finds business contacts in 60 seconds. Any city, any niche, worldwide. Try it free 👇"
    );
    return `https://twitter.com/intent/tweet?text=${text}&url=${encodeURIComponent(stats.referralLink)}`;
  }, [stats?.referralLink]);

  async function handleCopyLink() {
    if (!stats?.referralLink) return;
    await navigator.clipboard.writeText(stats.referralLink);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }

  async function handleSaveBank() {
    if (!resolvedName || !selectedBank || !accountNumber) return;
    setSavingBank(true);
    setStatusMsg(null);
    try {
      const bankObj = banks.find((b) => b.code === selectedBank);
      await saveAffiliateBankDetails({
        accountNumber,
        bankCode: selectedBank,
        bankName: bankObj?.name || selectedBank,
        accountName: resolvedName,
      });
      setStatusMsg({ tone: "success", text: "Bank details saved successfully." });
      setAccountNumber("");
      setSelectedBank("");
      setResolvedName("");
      await load();
    } catch (err) {
      setStatusMsg({
        tone: "danger",
        text: err instanceof Error ? err.message : "Failed to save bank details.",
      });
    } finally {
      setSavingBank(false);
    }
  }

  async function handleRequestPayout() {
    if (!stats?.canRequestPayout) return;
    setPayoutLoading(true);
    setStatusMsg(null);
    try {
      const message = await requestAffiliatePayout();
      setStatusMsg({ tone: "success", text: message });
      await load();
    } catch (err) {
      setStatusMsg({
        tone: "danger",
        text: err instanceof Error ? err.message : "Failed to submit payout request.",
      });
    } finally {
      setPayoutLoading(false);
    }
  }

  const paidNgn = stats?.totalPaidNgn ?? 0;
  const commissions = stats?.commissions ?? [];

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 pb-8">
      <DiscoveryWorkspaceHeader
        title="Affiliate"
        subtitle={`Earn $${COMMISSION_USD} (₦${COMMISSION_NGN.toLocaleString()}) per paid referral. Share your link — no projections or leaderboards.`}
      />

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => void load()}
          disabled={state === "loading"}
        >
          <RefreshCw
            className={cn("h-3.5 w-3.5", state === "loading" && "animate-spin")}
          />
          Refresh
        </Button>
      </div>

      {error ? (
        <Alert variant="danger">
          <AlertTitle>Affiliate unavailable</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {statusMsg ? (
        <Alert variant={statusMsg.tone === "danger" ? "danger" : "success"}>
          <AlertTitle>
            {statusMsg.tone === "danger" ? "Action failed" : "Success"}
          </AlertTitle>
          <AlertDescription>{statusMsg.text}</AlertDescription>
        </Alert>
      ) : null}

      {state === "loading" ? <AffiliateSkeleton /> : null}

      {state === "unavailable" ? (
        <EmptyState
          icon={<Users className="h-5 w-5" />}
          title="Affiliate stats unavailable"
          description="We could not load your referral programme for this license. Check activation and try again."
          action={
            <Button type="button" size="sm" onClick={() => void load()}>
              Retry
            </Button>
          }
        />
      ) : null}

      {state === "ready" && stats ? (
        <>
          <section
            aria-label="Referral overview"
            className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
          >
            <KpiCard
              label="Referrals"
              value={stats.totalReferrals.toLocaleString()}
              hint="Paid sales attributed to your link"
            />
            <KpiCard
              label="Total earned"
              value={formatMoneyUsd(stats.totalEarnedUsd)}
              hint={formatMoneyNgn(stats.totalEarnedNgn)}
            />
            <KpiCard
              label="Pending payout"
              value={formatMoneyUsd(stats.pendingUsd)}
              hint={`${formatMoneyNgn(stats.pendingNgn)} · min ${formatMoneyNgn(MIN_PAYOUT_NGN)}`}
            />
            <KpiCard
              label="Paid to date"
              value={formatMoneyNgn(paidNgn)}
              hint="From affiliate totals (not a payout ledger)"
            />
          </section>

          {stats.canRequestPayout ? (
            <Alert variant="warning">
              <AlertTitle>Ready to withdraw</AlertTitle>
              <AlertDescription className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <span>
                  You have {formatMoneyNgn(stats.pendingNgn)} pending above the minimum
                  threshold. Save bank details first if you have not already.
                </span>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => void handleRequestPayout()}
                  disabled={payoutLoading}
                >
                  {payoutLoading ? "Requesting…" : "Request payout"}
                </Button>
              </AlertDescription>
            </Alert>
          ) : null}

          <div className="grid gap-4 lg:grid-cols-2">
            <Panel>
              <PanelHeader>
                <PanelTitle>Referral link</PanelTitle>
                {stats.refCode ? (
                  <span className="text-xs text-[var(--lt-text-subtle)]">
                    Code {stats.refCode}
                  </span>
                ) : null}
              </PanelHeader>
              <PanelContent className="space-y-4">
                <div className="rounded-lg border border-[var(--lt-border)] bg-[var(--lt-surface-2)] px-3 py-2.5 font-mono text-sm text-[var(--lt-cyan)] break-all">
                  {stats.referralLink}
                </div>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                  <Button type="button" variant="outline" size="sm" onClick={() => void handleCopyLink()}>
                    {copied ? (
                      <Check className="h-3.5 w-3.5" />
                    ) : (
                      <Copy className="h-3.5 w-3.5" />
                    )}
                    {copied ? "Copied" : "Copy"}
                  </Button>
                  <Button type="button" variant="outline" size="sm" asChild>
                    <a href={whatsappHref} target="_blank" rel="noopener noreferrer">
                      WhatsApp
                    </a>
                  </Button>
                  <Button type="button" variant="outline" size="sm" asChild>
                    <a href={xHref} target="_blank" rel="noopener noreferrer">
                      Post on X
                    </a>
                  </Button>
                </div>
                <p className="text-xs leading-relaxed text-[var(--lt-text-subtle)]">
                  Share anywhere. Earn ${COMMISSION_USD} (₦
                  {COMMISSION_NGN.toLocaleString()}) for every person who buys through
                  your link. No cap.
                </p>
              </PanelContent>
            </Panel>

            <Panel>
              <PanelHeader>
                <PanelTitle>Bank details for payout</PanelTitle>
              </PanelHeader>
              <PanelContent className="space-y-3">
                <p className="text-xs text-[var(--lt-text-muted)]">
                  Saved bank details are not returned by the affiliate stats API. Re-enter
                  to update Paystack recipient details when needed.
                </p>
                <label className="block space-y-1.5 text-sm">
                  <span className="text-[var(--lt-text-muted)]">Bank</span>
                  <select
                    value={selectedBank}
                    onChange={(e) => setSelectedBank(e.target.value)}
                    className="w-full rounded-md border border-[var(--lt-border)] bg-[var(--lt-surface-2)] px-3 py-2 text-[var(--lt-text)] outline-none"
                  >
                    <option value="">Select your bank</option>
                    {banks.map((bank) => (
                      <option key={bank.code} value={bank.code}>
                        {bank.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block space-y-1.5 text-sm">
                  <span className="text-[var(--lt-text-muted)]">Account number</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    autoComplete="off"
                    placeholder="10 digits"
                    value={accountNumber}
                    onChange={(e) =>
                      setAccountNumber(e.target.value.replace(/\D/g, "").slice(0, 10))
                    }
                    className="w-full rounded-md border border-[var(--lt-border)] bg-[var(--lt-surface-2)] px-3 py-2 text-[var(--lt-text)] outline-none"
                  />
                </label>
                {resolvingAccount ? (
                  <p className="text-xs text-[var(--lt-text-subtle)]">Verifying account…</p>
                ) : null}
                {resolvedName ? (
                  <div className="rounded-md border border-[var(--lt-success)]/30 bg-[var(--lt-success-soft)] px-3 py-2 text-sm font-medium text-[var(--lt-success)]">
                    {resolvedName}
                  </div>
                ) : null}
                <Button
                  type="button"
                  size="sm"
                  disabled={!resolvedName || savingBank}
                  onClick={() => void handleSaveBank()}
                >
                  {savingBank ? "Saving…" : "Save bank details"}
                </Button>
              </PanelContent>
            </Panel>
          </div>

          <Panel>
            <PanelHeader>
              <PanelTitle>Earnings summary</PanelTitle>
            </PanelHeader>
            <PanelContent>
              <dl className="grid gap-3 text-sm sm:grid-cols-3">
                <div>
                  <dt className="text-[var(--lt-text-muted)]">Earned</dt>
                  <dd className="mt-0.5 font-semibold tabular-nums text-[var(--lt-text)]">
                    {formatMoneyUsd(stats.totalEarnedUsd)} ·{" "}
                    {formatMoneyNgn(stats.totalEarnedNgn)}
                  </dd>
                </div>
                <div>
                  <dt className="text-[var(--lt-text-muted)]">Pending</dt>
                  <dd className="mt-0.5 font-semibold tabular-nums text-[var(--lt-text)]">
                    {formatMoneyUsd(stats.pendingUsd)} · {formatMoneyNgn(stats.pendingNgn)}
                  </dd>
                </div>
                <div>
                  <dt className="text-[var(--lt-text-muted)]">Paid (total)</dt>
                  <dd className="mt-0.5 font-semibold tabular-nums text-[var(--lt-text)]">
                    {formatMoneyNgn(paidNgn)}
                  </dd>
                </div>
              </dl>
            </PanelContent>
          </Panel>

          <Panel>
            <PanelHeader>
              <PanelTitle>Withdrawal history</PanelTitle>
            </PanelHeader>
            <PanelContent>
              <EmptyState
                className="py-8"
                icon={<Link2 className="h-5 w-5" />}
                title="Payout request history unavailable"
                description={`There is no user API for payout_requests. Paid to date from your affiliate totals: ${formatMoneyNgn(paidNgn)}. Admins review payouts separately.`}
              />
            </PanelContent>
          </Panel>

          <Panel>
            <PanelHeader>
              <PanelTitle>Referrals</PanelTitle>
              <span className="text-xs text-[var(--lt-text-subtle)]">
                {commissions.length} commission
                {commissions.length === 1 ? "" : "s"}
              </span>
            </PanelHeader>
            <PanelContent className="p-0">
              {commissions.length === 0 ? (
                <div className="p-4">
                  <EmptyState
                    icon={<Users className="h-5 w-5" />}
                    title="No referrals yet"
                    description={`Share your link to earn $${COMMISSION_USD} on each paid sale. WhatsApp, X, or anywhere your audience is.`}
                  />
                </div>
              ) : (
                <>
                  <div className="hidden overflow-x-auto md:block">
                    <table className="w-full min-w-[640px] text-left text-sm">
                      <thead className="border-b border-[var(--lt-border)] bg-[var(--lt-surface-2)] text-xs uppercase tracking-wide text-[var(--lt-text-muted)]">
                        <tr>
                          <th className="px-4 py-3 font-medium">Referred</th>
                          <th className="px-4 py-3 font-medium">Commission</th>
                          <th className="px-4 py-3 font-medium">Status</th>
                          <th className="px-4 py-3 font-medium">Date</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--lt-border)]">
                        {commissions.map((c, index) => {
                          const badge = commissionStatusBadge(c.status);
                          const usd =
                            typeof c.commission_usd === "number"
                              ? c.commission_usd
                              : COMMISSION_USD;
                          const ngn =
                            typeof c.commission_ngn === "number"
                              ? c.commission_ngn
                              : COMMISSION_NGN;
                          return (
                            <tr key={c.id ?? `${c.referred_email}-${c.created_at}-${index}`}>
                              <td className="px-4 py-3 text-[var(--lt-text)]">
                                {maskReferredEmail(c.referred_email)}
                              </td>
                              <td className="px-4 py-3 tabular-nums text-[var(--lt-success)]">
                                +{formatMoneyUsd(usd)}
                                <span className="ml-1 text-xs text-[var(--lt-text-subtle)]">
                                  ({formatMoneyNgn(ngn)})
                                </span>
                              </td>
                              <td className="px-4 py-3">
                                <StatusBadge status={badge.status} label={badge.label} />
                              </td>
                              <td className="px-4 py-3 text-[var(--lt-text-muted)]">
                                {formatDate(c.created_at)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  <ul className="divide-y divide-[var(--lt-border)] md:hidden">
                    {commissions.map((c, index) => {
                      const badge = commissionStatusBadge(c.status);
                      const usd =
                        typeof c.commission_usd === "number"
                          ? c.commission_usd
                          : COMMISSION_USD;
                      return (
                        <li
                          key={c.id ?? `m-${c.referred_email}-${index}`}
                          className="flex items-start justify-between gap-3 px-4 py-3"
                        >
                          <div className="min-w-0">
                            <p className="truncate font-medium text-[var(--lt-text)]">
                              {maskReferredEmail(c.referred_email)}
                            </p>
                            <p className="text-xs text-[var(--lt-text-subtle)]">
                              {formatDate(c.created_at)}
                            </p>
                          </div>
                          <div className="shrink-0 text-right">
                            <p className="font-semibold tabular-nums text-[var(--lt-success)]">
                              +{formatMoneyUsd(usd)}
                            </p>
                            <StatusBadge status={badge.status} label={badge.label} />
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </>
              )}
            </PanelContent>
          </Panel>

          <Alert>
            <AlertTitle>Unsupported on this workspace</AlertTitle>
            <AlertDescription>
              No commission projections, payout forecasts, leaderboards, click funnels, or
              charts — those APIs do not exist. Discovery still embeds the legacy
              Affiliate Programme panel; this page is the first-class RC1 surface.{" "}
              <Link href="/dashboard" className="text-[var(--lt-cyan)] underline-offset-2 hover:underline">
                Back to Discovery
              </Link>
            </AlertDescription>
          </Alert>
        </>
      ) : null}
    </div>
  );
}
