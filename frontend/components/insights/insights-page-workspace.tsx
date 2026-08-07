"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { BarChart3, RefreshCw } from "lucide-react";
import { DiscoveryWorkspaceHeader } from "@/components/discovery/discovery-workspace-header";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Panel, PanelContent, PanelHeader, PanelTitle } from "@/components/ui/panel";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  dailyUsagePercent,
  mailboxHealth,
  mailboxHealthBadge,
  mailboxHealthLabel,
  mailboxStatusBadge,
  mailboxStatusLabel,
} from "@/lib/mailbox-display";
import { getLicenseUsage, getSearchHistory, type LicenseUsage } from "@/services/api";
import {
  fetchMailboxes,
  fetchOutreachBalance,
  fetchSendsReport,
} from "@/services/outreach-api";
import type {
  OutreachBalance,
  OutreachMailbox,
  OutreachSendsSummary,
  OutreachSentEmail,
} from "@/types/outreach";
import { cn } from "@/utils/utils";

type LoadState = "loading" | "ready" | "error";

function formatRate(rate: number): string {
  return `${Number.isFinite(rate) ? rate.toFixed(1) : "0.0"}%`;
}

function formatWhen(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function KpiCard({
  label,
  value,
  hint,
  className,
}: {
  label: string;
  value: string;
  hint?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border border-[var(--lt-border)] bg-[var(--lt-surface-2)] p-4",
        className
      )}
    >
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

function InsightsSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Loading insights">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={`kpi-sk-${i}`}
            className="rounded-xl border border-[var(--lt-border)] bg-[var(--lt-surface-2)] p-4"
          >
            <Skeleton className="h-3 w-24" />
            <Skeleton className="mt-2 h-8 w-16" />
          </div>
        ))}
      </div>
      <Skeleton className="h-40 w-full rounded-xl" />
      <Skeleton className="h-48 w-full rounded-xl" />
    </div>
  );
}

export function InsightsPageWorkspace() {
  const [state, setState] = useState<LoadState>("loading");
  const [error, setError] = useState<string | null>(null);
  const [usage, setUsage] = useState<LicenseUsage | null>(null);
  const [balance, setBalance] = useState<OutreachBalance | null>(null);
  const [sendSummary, setSendSummary] = useState<OutreachSendsSummary | null>(null);
  const [recentSends, setRecentSends] = useState<OutreachSentEmail[]>([]);
  const [mailboxes, setMailboxes] = useState<OutreachMailbox[]>([]);
  const [history, setHistory] = useState<
    Array<{
      id: string;
      query: string;
      location: string;
      total_found: number;
      created_at: string;
      search_id: string | null;
    }>
  >([]);

  const load = useCallback(async () => {
    setState("loading");
    setError(null);
    try {
      const [usageRes, balanceRes, sendsRes, mailboxesRes, historyRes] =
        await Promise.all([
          getLicenseUsage(),
          fetchOutreachBalance(),
          fetchSendsReport({ limit: 8, offset: 0, sort: "recent" }).catch(() => null),
          fetchMailboxes().catch(() => [] as OutreachMailbox[]),
          getSearchHistory(),
        ]);

      setUsage(usageRes);
      setBalance(balanceRes);
      setSendSummary(sendsRes?.summary ?? null);
      setRecentSends(sendsRes?.sends ?? []);
      setMailboxes(mailboxesRes);
      setHistory(historyRes.history ?? []);
      setState("ready");
    } catch {
      setError("Could not load insights. Check your connection and try again.");
      setState("error");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const monthlyLimit = usage?.monthly_search_limit ?? 0;
  const searchesUsed = usage?.searches_used ?? 0;
  const searchUsagePct =
    monthlyLimit > 0
      ? Math.min(100, Math.round((searchesUsed / monthlyLimit) * 100))
      : 0;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 pb-8">
      <DiscoveryWorkspaceHeader
        title="Insights"
        subtitle="Live search credits, outreach sends, and mailbox health from your account — not estimates or ROI projections."
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
        <Button type="button" variant="soft" size="sm" asChild>
          <Link href="/dashboard/outreach?tab=sends">Open send history</Link>
        </Button>
        <Button type="button" variant="outline" size="sm" asChild>
          <Link href="/dashboard/plans">Billing & plans</Link>
        </Button>
      </div>

      {error ? (
        <Alert variant="danger">
          <AlertTitle>Insights unavailable</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {state === "loading" ? <InsightsSkeleton /> : null}

      {state === "ready" ? (
        <>
          <section aria-label="Summary" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <KpiCard
              label="Search credits"
              value={
                typeof usage?.search_credits === "number"
                  ? usage.search_credits.toLocaleString()
                  : "—"
              }
              hint={
                usage
                  ? `${usage.freeSearchesRemaining} free · ${usage.creditSearchesRemaining} purchased`
                  : undefined
              }
            />
            <KpiCard
              label="Searches used"
              value={
                usage
                  ? `${searchesUsed.toLocaleString()}${monthlyLimit ? ` / ${monthlyLimit.toLocaleString()}` : ""}`
                  : "—"
              }
              hint={monthlyLimit ? `${searchUsagePct}% of monthly allowance` : undefined}
            />
            <KpiCard
              label="Send balance"
              value={
                typeof balance?.send_balance === "number"
                  ? balance.send_balance.toLocaleString()
                  : "—"
              }
              hint={
                balance
                  ? `${balance.mailbox_count}/${balance.max_mailboxes} mailboxes · ${balance.subscription_status || "no plan"}`
                  : "Connect outreach to see balance"
              }
            />
            <KpiCard
              label="Open rate"
              value={sendSummary ? formatRate(sendSummary.open_rate) : "—"}
              hint={
                sendSummary
                  ? `${sendSummary.total_opened.toLocaleString()} opened · ${sendSummary.total_sent.toLocaleString()} sent`
                  : "No sends yet"
              }
            />
          </section>

          <div className="grid gap-4 lg:grid-cols-2">
            <Panel>
              <PanelHeader>
                <PanelTitle>Search usage</PanelTitle>
                <Button type="button" variant="ghost" size="sm" asChild>
                  <Link href="/dashboard">Discovery</Link>
                </Button>
              </PanelHeader>
              <PanelContent className="space-y-4">
                {!usage ? (
                  <EmptyState
                    icon={<BarChart3 className="h-5 w-5" />}
                    title="Usage unavailable"
                    description="Could not load search credits for this license."
                  />
                ) : (
                  <>
                    {monthlyLimit > 0 ? (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-[var(--lt-text-muted)]">Monthly searches</span>
                          <span className="tabular-nums text-[var(--lt-text)]">
                            {searchesUsed} / {monthlyLimit}
                          </span>
                        </div>
                        <Progress value={searchUsagePct} aria-label="Monthly search usage" />
                      </div>
                    ) : null}
                    <dl className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <dt className="text-[var(--lt-text-muted)]">Free remaining</dt>
                        <dd className="mt-0.5 font-medium tabular-nums text-[var(--lt-text)]">
                          {usage.freeSearchesRemaining.toLocaleString()}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-[var(--lt-text-muted)]">Credit remaining</dt>
                        <dd className="mt-0.5 font-medium tabular-nums text-[var(--lt-text)]">
                          {usage.creditSearchesRemaining.toLocaleString()}
                        </dd>
                      </div>
                    </dl>
                  </>
                )}
              </PanelContent>
            </Panel>

            <Panel>
              <PanelHeader>
                <PanelTitle>Outreach sends</PanelTitle>
                <Button type="button" variant="ghost" size="sm" asChild>
                  <Link href="/dashboard/outreach?tab=sends">History</Link>
                </Button>
              </PanelHeader>
              <PanelContent className="space-y-4">
                {!sendSummary ? (
                  <EmptyState
                    icon={<BarChart3 className="h-5 w-5" />}
                    title="No send data yet"
                    description="After you send outreach, totals and open rate appear here."
                  />
                ) : (
                  <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                    <div>
                      <dt className="text-[var(--lt-text-muted)]">Sent</dt>
                      <dd className="mt-0.5 text-lg font-semibold tabular-nums">
                        {sendSummary.total_sent.toLocaleString()}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[var(--lt-text-muted)]">Opened</dt>
                      <dd className="mt-0.5 text-lg font-semibold tabular-nums">
                        {sendSummary.total_opened.toLocaleString()}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[var(--lt-text-muted)]">Open rate</dt>
                      <dd className="mt-0.5 text-lg font-semibold tabular-nums">
                        {formatRate(sendSummary.open_rate)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[var(--lt-text-muted)]">In progress</dt>
                      <dd className="mt-0.5 text-lg font-semibold tabular-nums">
                        {sendSummary.in_progress.toLocaleString()}
                      </dd>
                    </div>
                  </dl>
                )}
                {balance ? (
                  <p className="text-xs text-[var(--lt-text-subtle)]">
                    Balance buckets: {balance.free_trial_remaining} free ·{" "}
                    {balance.monthly_allowance_remaining} monthly ·{" "}
                    {balance.purchased_credits} purchased
                  </p>
                ) : null}
              </PanelContent>
            </Panel>
          </div>

          <Panel>
            <PanelHeader>
              <PanelTitle>Mailbox health</PanelTitle>
              <Button type="button" variant="ghost" size="sm" asChild>
                <Link href="/dashboard/mailboxes">Manage</Link>
              </Button>
            </PanelHeader>
            <PanelContent>
              {mailboxes.length === 0 ? (
                <EmptyState
                  icon={<BarChart3 className="h-5 w-5" />}
                  title="No mailboxes connected"
                  description="Connect a Gmail mailbox to see daily send usage and health."
                  action={
                    <Button type="button" size="sm" asChild>
                      <Link href="/dashboard/mailboxes?connect=1">Connect mailbox</Link>
                    </Button>
                  }
                />
              ) : (
                <ul className="divide-y divide-[var(--lt-border)]">
                  {mailboxes.map((mailbox) => {
                    const health = mailboxHealth(mailbox);
                    const usagePct = dailyUsagePercent(mailbox);
                    return (
                      <li
                        key={mailbox.id}
                        className="flex flex-col gap-3 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="min-w-0">
                          <p className="truncate font-medium text-[var(--lt-text)]">
                            {mailbox.email_address}
                          </p>
                          <div className="mt-1 flex flex-wrap items-center gap-2">
                            <StatusBadge status={mailboxStatusBadge(mailbox.status)}>
                              {mailboxStatusLabel(mailbox.status)}
                            </StatusBadge>
                            <StatusBadge status={mailboxHealthBadge(health)}>
                              {mailboxHealthLabel(health)}
                            </StatusBadge>
                          </div>
                        </div>
                        <div className="w-full sm:w-48">
                          <div className="mb-1 flex justify-between text-xs text-[var(--lt-text-muted)]">
                            <span>Daily sends</span>
                            <span className="tabular-nums">
                              {mailbox.daily_send_count}/{mailbox.daily_cap}
                            </span>
                          </div>
                          <Progress
                            value={usagePct}
                            aria-label={`Daily send usage for ${mailbox.email_address}`}
                          />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </PanelContent>
          </Panel>

          <div className="grid gap-4 lg:grid-cols-2">
            <Panel>
              <PanelHeader>
                <PanelTitle>Recent searches</PanelTitle>
                <Button type="button" variant="ghost" size="sm" asChild>
                  <Link href="/dashboard/saved">Saved leads</Link>
                </Button>
              </PanelHeader>
              <PanelContent>
                {history.length === 0 ? (
                  <EmptyState
                    icon={<BarChart3 className="h-5 w-5" />}
                    title="No searches yet"
                    description="Your discovery history will list here after you run a search."
                  />
                ) : (
                  <ul className="divide-y divide-[var(--lt-border)]">
                    {history.slice(0, 8).map((item) => (
                      <li key={item.id} className="flex items-start justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
                        <div className="min-w-0">
                          {item.search_id ? (
                            <Link
                              href={`/dashboard/search/${item.search_id}`}
                              className="truncate font-medium text-[var(--lt-text)] hover:text-[var(--lt-cyan)]"
                            >
                              {item.query} · {item.location}
                            </Link>
                          ) : (
                            <p className="truncate font-medium text-[var(--lt-text)]">
                              {item.query} · {item.location}
                            </p>
                          )}
                          <p className="text-xs text-[var(--lt-text-subtle)]">
                            {formatWhen(item.created_at)}
                          </p>
                        </div>
                        <span className="shrink-0 tabular-nums text-sm text-[var(--lt-text-muted)]">
                          {item.total_found.toLocaleString()}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </PanelContent>
            </Panel>

            <Panel>
              <PanelHeader>
                <PanelTitle>Recent sends</PanelTitle>
                <Button type="button" variant="ghost" size="sm" asChild>
                  <Link href="/dashboard/outreach?tab=sends">All sends</Link>
                </Button>
              </PanelHeader>
              <PanelContent>
                {recentSends.length === 0 ? (
                  <EmptyState
                    icon={<BarChart3 className="h-5 w-5" />}
                    title="No recent sends"
                    description="Compose outreach to see recipients and open status here."
                  />
                ) : (
                  <ul className="divide-y divide-[var(--lt-border)]">
                    {recentSends.map((send) => (
                      <li key={send.id} className="flex items-start justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
                        <div className="min-w-0">
                          <p className="truncate font-medium text-[var(--lt-text)]">
                            {send.business_name || send.recipient_email}
                          </p>
                          <p className="truncate text-xs text-[var(--lt-text-subtle)]">
                            {send.subject}
                          </p>
                        </div>
                        <div className="shrink-0 text-right">
                          <StatusBadge
                            status={
                              send.replied_at
                                ? "replied"
                                : send.status === "sent"
                                  ? "active"
                                  : send.status === "bounced" || send.status === "failed"
                                    ? "error"
                                    : "processing"
                            }
                          >
                            {send.replied_at ? "Replied" : send.status}
                          </StatusBadge>
                          <p className="mt-1 text-[10px] text-[var(--lt-text-subtle)]">
                            {send.open_count > 0
                              ? `${send.open_count} open${send.open_count === 1 ? "" : "s"}`
                              : "No opens"}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </PanelContent>
            </Panel>
          </div>

          <Alert>
            <AlertTitle>What Insights does not include</AlertTitle>
            <AlertDescription>
              LeadThur does not compute credit ROI, search efficiency trends, industry lead
              sources, or mailbox open/reply charts. Those RC1 mock visuals are omitted so
              every number here maps to a live API field.
            </AlertDescription>
          </Alert>
        </>
      ) : null}
    </div>
  );
}
