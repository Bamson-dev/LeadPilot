"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { SALE_PRICE_NGN } from "@/constants/pricing";
import { AdminWorkspaceHeader } from "@/components/admin/admin-workspace-header";
import { useAdminSession } from "@/components/admin/admin-session-context";
import { isAdminDemoMode, getAdminFetchHeaders } from "@/components/admin/admin-utils";
import {
  AdminChipButton,
  AdminLoading,
  adminTableClass,
  adminTableHeadRowClass,
  adminTableRowClass,
} from "@/components/admin/admin-ui";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Panel, PanelContent } from "@/components/ui/panel";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  getOverview,
  getTrialStats,
  getObservabilityOverview,
  getObservabilityFunnels,
  getObservabilityEvents,
  getObservabilitySearches,
  getObservabilityInfrastructure,
  getObservabilityErrors,
  getObservabilityAlerts,
  getObservabilityKpis,
  getObservabilityEventsCsvUrl,
  getObservabilityCohorts,
  getObservabilityTimeline,
  getObservabilityAttribution,
  getObservabilitySearchQuality,
  getObservabilityLicenseHealth,
  getObservabilityOutreachHealth,
  getObservabilityEmailRevenue,
  patchObservabilityAlert,
  getAdminToken,
  type AdminOverview,
  type TrialStats,
} from "@/services/admin-api";

type AnalyticsTab =
  | "overview"
  | "funnels"
  | "users"
  | "timeline"
  | "cohorts"
  | "searches"
  | "revenue"
  | "email-revenue"
  | "attribution"
  | "infrastructure"
  | "errors"
  | "workers"
  | "queues"
  | "smtp"
  | "search-health"
  | "license-health"
  | "outreach-health"
  | "alerts";

const TABS: { id: AnalyticsTab; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "funnels", label: "Funnels" },
  { id: "users", label: "Users" },
  { id: "timeline", label: "Timeline" },
  { id: "cohorts", label: "Cohorts" },
  { id: "searches", label: "Searches" },
  { id: "revenue", label: "Revenue" },
  { id: "email-revenue", label: "Email Revenue" },
  { id: "attribution", label: "Attribution" },
  { id: "infrastructure", label: "Infrastructure" },
  { id: "errors", label: "Errors" },
  { id: "workers", label: "Workers" },
  { id: "queues", label: "Queues" },
  { id: "smtp", label: "SMTP" },
  { id: "search-health", label: "Search Health" },
  { id: "license-health", label: "License Health" },
  { id: "outreach-health", label: "Outreach" },
  { id: "alerts", label: "Alerts" },
];

function defaultRange() {
  const to = new Date();
  const from = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  return { from: from.toISOString(), to: to.toISOString() };
}

function rateLabel(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return `${value}%`;
}

export function AnalyticsWorkspace() {
  const { handleSessionError, handleSessionExpired } = useAdminSession();
  const [tab, setTab] = useState<AnalyticsTab>("overview");
  const [range] = useState(defaultRange);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [trialStats, setTrialStats] = useState<TrialStats | null>(null);
  const [obsOverview, setObsOverview] = useState<{
    counts: Record<string, number>;
    openAlerts: number;
    note?: string;
  } | null>(null);
  const [funnelSteps, setFunnelSteps] = useState<
    Array<{
      step: string;
      count: number;
      conversionFromPrev: number;
      dropOffFromPrev?: number;
      avgDurationMs?: number | null;
      medianDurationMs?: number | null;
    }>
  >([]);
  const [events, setEvents] = useState<Array<Record<string, unknown>>>([]);
  const [eventsTotal, setEventsTotal] = useState(0);
  const [searchSummary, setSearchSummary] = useState({
    started: 0,
    completed: 0,
    failed: 0,
  });
  const [infra, setInfra] = useState<Record<string, unknown> | null>(null);
  const [errors, setErrors] = useState<Array<Record<string, unknown>>>([]);
  const [alerts, setAlerts] = useState<Array<Record<string, unknown>>>([]);
  const [alertCatalogue, setAlertCatalogue] = useState<
    Array<{ key: string; title: string; severity: string; description: string }>
  >([]);
  const [kpis, setKpis] = useState<Record<string, unknown> | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [timelineEmail, setTimelineEmail] = useState("");
  const [timelineEvents, setTimelineEvents] = useState<Array<Record<string, unknown>>>([]);
  const [cohorts, setCohorts] = useState<Record<string, unknown> | null>(null);
  const [attribution, setAttribution] = useState<
    Array<{ source: string; medium: string; campaign: string; purchases: number }>
  >([]);
  const [searchQuality, setSearchQuality] = useState<Record<string, unknown> | null>(null);
  const [licenseHealth, setLicenseHealth] = useState<Record<string, number>>({});
  const [outreachHealth, setOutreachHealth] = useState<Record<string, unknown> | null>(null);
  const [emailRevenue, setEmailRevenue] = useState<{
    metricsAvailableFrom?: string;
    attributionModel?: string;
    attributionWindowDays?: number;
    rows: Array<Record<string, unknown>>;
    totals?: Record<string, unknown>;
  } | null>(null);

  const isDemoMode = isAdminDemoMode();

  const load = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const [overviewData, statsData, obs, funnels, kpiData, infraData, alertData] =
        await Promise.all([
          getOverview(),
          getTrialStats(),
          getObservabilityOverview(range.from, range.to).catch(() => null),
          getObservabilityFunnels(range.from, range.to).catch(() => null),
          getObservabilityKpis(range.from, range.to).catch(() => null),
          getObservabilityInfrastructure().catch(() => null),
          getObservabilityAlerts("open").catch(() => null),
        ]);

      setOverview(overviewData);
      setTrialStats(statsData);
      if (obs) setObsOverview(obs);
      if (funnels) setFunnelSteps(funnels.steps || []);
      if (kpiData) setKpis(kpiData.kpis as Record<string, unknown>);
      if (infraData) {
        setInfra(infraData.snapshot);
        setAlertCatalogue(infraData.catalogue || []);
      }
      if (alertData) {
        setAlerts(alertData.alerts || []);
        if (alertData.catalogue?.length) setAlertCatalogue(alertData.catalogue);
      }
    } catch (err) {
      if (!handleSessionError(err)) {
        setErrorMsg(err instanceof Error ? err.message : "Failed to load analytics");
      }
    } finally {
      setLoading(false);
    }
  }, [handleSessionError, range.from, range.to]);

  const loadTabData = useCallback(async () => {
    try {
      if (tab === "users" || tab === "overview") {
        const data = await getObservabilityEvents({
          from: range.from,
          to: range.to,
          q: query || undefined,
          limit: 50,
          offset: 0,
        });
        setEvents(data.events || []);
        setEventsTotal(data.total || 0);
      }
      if (tab === "searches" || tab === "search-health") {
        const data = await getObservabilitySearches(range.from, range.to);
        setSearchSummary(data.summary);
        setEvents(data.events || []);
        setEventsTotal(data.total || 0);
      }
      if (tab === "errors") {
        const data = await getObservabilityErrors(range.from, range.to);
        setErrors(data.events || []);
      }
      if (tab === "alerts") {
        const data = await getObservabilityAlerts("all");
        setAlerts(data.alerts || []);
        setAlertCatalogue(data.catalogue || []);
      }
      if (tab === "cohorts") {
        const data = await getObservabilityCohorts();
        setCohorts(data as unknown as Record<string, unknown>);
      }
      if (tab === "attribution") {
        const data = await getObservabilityAttribution(range.from, range.to);
        setAttribution(data.attributed || []);
      }
      if (tab === "search-health") {
        const data = await getObservabilitySearchQuality(range.from, range.to);
        setSearchQuality(data as unknown as Record<string, unknown>);
      }
      if (tab === "license-health") {
        const data = await getObservabilityLicenseHealth(range.from, range.to);
        setLicenseHealth(data.counts || {});
      }
      if (tab === "outreach-health" || tab === "smtp") {
        const data = await getObservabilityOutreachHealth(range.from, range.to);
        setOutreachHealth(data as unknown as Record<string, unknown>);
      }
      if (tab === "email-revenue") {
        const data = await getObservabilityEmailRevenue({
          from: range.from,
          to: range.to,
        });
        setEmailRevenue(data as unknown as typeof emailRevenue);
      }
    } catch (err) {
      handleSessionError(err);
    }
  }, [tab, range.from, range.to, query, handleSessionError]);

  useEffect(() => {
    void load();
    const interval = setInterval(() => void load(), 120_000);
    return () => clearInterval(interval);
  }, [load]);

  useEffect(() => {
    void loadTabData();
  }, [loadTabData]);

  const csvHref = useMemo(() => {
    const token = getAdminToken();
    if (!token) return null;
    return getObservabilityEventsCsvUrl(range.from, range.to);
  }, [range.from, range.to]);

  async function downloadCsv() {
    if (!csvHref) return;
    try {
      const res = await fetch(csvHref, { headers: getAdminFetchHeaders() });
      if (res.status === 401) {
        handleSessionExpired();
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "analytics-events.csv";
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setErrorMsg("CSV export failed");
    }
  }

  return (
    <>
      <AdminWorkspaceHeader
        title="Analytics"
        description="Product intelligence from tracked events and existing admin metrics. No synthetic data."
        badges={
          obsOverview ? (
            <StatusBadge
              status={obsOverview.openAlerts > 0 ? "error" : "active"}
              label={`${obsOverview.openAlerts} open alerts`}
            />
          ) : null
        }
        actions={
          <>
            <Button type="button" variant="outline" size="sm" onClick={() => void load()}>
              Refresh
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => void downloadCsv()}>
              Export CSV
            </Button>
          </>
        }
      />

      <div className="mb-4 flex flex-wrap gap-2">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search events…"
          className="max-w-xs"
        />
      </div>

      <div className="mb-5 flex flex-wrap gap-1 rounded-lg border border-[var(--lt-border)] bg-[var(--lt-surface-2)] p-1">
        {TABS.map((item) => (
          <AdminChipButton
            key={item.id}
            active={tab === item.id}
            onClick={() => setTab(item.id)}
          >
            {item.label}
          </AdminChipButton>
        ))}
      </div>

      {errorMsg ? (
        <p className="mb-4 text-sm text-[var(--lt-danger)]">{errorMsg}</p>
      ) : null}

      {loading ? (
        <AdminLoading label="Loading analytics..." />
      ) : (
        <>
          {tab === "overview" && (
            <>
              <div className="mb-6 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                {overview
                  ? [
                      { label: "Total Users", value: isDemoMode ? 782 : overview.totalUsers },
                      { label: "Active Users", value: isDemoMode ? 681 : overview.activeUsers },
                      {
                        label: "Est. Revenue",
                        value: isDemoMode
                          ? "₦15,120,000"
                          : `₦${overview.estimatedRevenue.toLocaleString()}`,
                        sub: isDemoMode
                          ? "443 at ₦15,000 · 339 at ₦25,000"
                          : `at ₦${SALE_PRICE_NGN.toLocaleString()} per user`,
                      },
                      {
                        label: "Paid Searches",
                        value: isDemoMode ? "9,460" : overview.totalSearches,
                      },
                      {
                        label: "Trial Searches",
                        value: isDemoMode ? "2,035" : overview.totalTrialSearches,
                      },
                    ].map((stat) => (
                      <Panel key={stat.label}>
                        <PanelContent className="p-4">
                          <p className="text-xs text-[var(--lt-text-subtle)]">{stat.label}</p>
                          <p className="mt-1 text-2xl font-bold text-[var(--lt-text)]">{stat.value}</p>
                          {"sub" in stat && stat.sub ? (
                            <p className="mt-1 text-[10px] text-[var(--lt-text-muted)]">{stat.sub}</p>
                          ) : null}
                        </PanelContent>
                      </Panel>
                    ))
                  : null}
                {trialStats
                  ? [
                      { label: "Trial Searches Today", value: trialStats.trialsToday },
                      { label: "Trial Searches This Week", value: trialStats.trialsThisWeek },
                      {
                        label: "Est. Conversion Rate",
                        value: `${trialStats.conversionRate}%`,
                      },
                    ].map((stat) => (
                      <Panel key={stat.label}>
                        <PanelContent className="p-4">
                          <p className="text-xs text-[var(--lt-text-subtle)]">{stat.label}</p>
                          <p className="mt-1 text-2xl font-bold text-[var(--lt-accent-soft)]">
                            {stat.value}
                          </p>
                        </PanelContent>
                      </Panel>
                    ))
                  : null}
              </div>

              {obsOverview?.note ? (
                <p className="mb-4 text-xs text-[var(--lt-text-subtle)]">{obsOverview.note}</p>
              ) : null}

              {obsOverview && (
                <div className="mb-6 grid gap-3 md:grid-cols-3 lg:grid-cols-4">
                  {Object.entries(obsOverview.counts).map(([name, count]) => (
                    <Panel key={name}>
                      <PanelContent className="p-3">
                        <p className="truncate text-[10px] text-[var(--lt-text-subtle)]">{name}</p>
                        <p className="mt-1 text-xl font-bold text-[var(--lt-text)]">{count}</p>
                      </PanelContent>
                    </Panel>
                  ))}
                </div>
              )}

              <Panel>
                <PanelContent className="space-y-3 p-5">
                  <p className="m-0 text-sm text-[var(--lt-text-muted)]">
                    Related workspaces for deeper operational detail.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" asChild>
                      <Link href="/admin/accounts">Activation tracker</Link>
                    </Button>
                    <Button variant="outline" size="sm" asChild>
                      <Link href="/admin/trial">Trial workspace</Link>
                    </Button>
                    <Button variant="outline" size="sm" asChild>
                      <Link href="/admin/payments">Payments</Link>
                    </Button>
                  </div>
                </PanelContent>
              </Panel>
            </>
          )}

          {tab === "funnels" && (
            <div className="overflow-hidden rounded-xl border border-[var(--lt-border)] bg-[var(--lt-surface)]">
              {funnelSteps.length === 0 ? (
                <EmptyState
                  title="No funnel events yet"
                  description="Counts appear after client/server tracking starts recording."
                />
              ) : (
                <table className={adminTableClass}>
                  <thead>
                    <tr className={adminTableHeadRowClass}>
                      <th className="px-3 py-2">Step</th>
                      <th className="px-3 py-2">Count</th>
                      <th className="px-3 py-2">Conv. %</th>
                      <th className="px-3 py-2">Drop-off %</th>
                      <th className="px-3 py-2">Avg ms</th>
                      <th className="px-3 py-2">Median ms</th>
                    </tr>
                  </thead>
                  <tbody>
                    {funnelSteps.map((step) => (
                      <tr key={step.step} className={adminTableRowClass}>
                        <td className="px-3 py-2 font-medium text-[var(--lt-text)]">{step.step}</td>
                        <td className="px-3 py-2 text-[var(--lt-text-muted)]">{step.count}</td>
                        <td className="px-3 py-2 text-[var(--lt-accent-soft)]">
                          {step.conversionFromPrev}%
                        </td>
                        <td className="px-3 py-2 text-[var(--lt-text-muted)]">
                          {step.dropOffFromPrev ?? 0}%
                        </td>
                        <td className="px-3 py-2 text-[var(--lt-text-muted)]">
                          {step.avgDurationMs ?? "—"}
                        </td>
                        <td className="px-3 py-2 text-[var(--lt-text-muted)]">
                          {step.medianDurationMs ?? "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {tab === "timeline" && (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <Input
                  value={timelineEmail}
                  onChange={(e) => setTimelineEmail(e.target.value)}
                  placeholder="Customer email for timeline"
                  className="max-w-sm"
                />
                <Button
                  type="button"
                  size="sm"
                  onClick={() => {
                    void (async () => {
                      try {
                        const data = await getObservabilityTimeline({ email: timelineEmail });
                        setTimelineEvents(data.events || []);
                      } catch (err) {
                        handleSessionError(err);
                      }
                    })();
                  }}
                >
                  Load timeline
                </Button>
              </div>
              <EventsTable
                events={timelineEvents}
                total={timelineEvents.length}
                emptyTitle="Enter an email to load the customer journey"
              />
            </div>
          )}

          {tab === "cohorts" && (
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {cohorts ? (
                Object.entries(
                  (cohorts.cohorts as Record<string, Record<string, number>>) || {}
                ).flatMap(([name, windowCounts]) =>
                  Object.entries(windowCounts || {}).map(([window, value]) => (
                    <Panel key={`${name}-${window}`}>
                      <PanelContent className="p-4">
                        <p className="text-xs text-[var(--lt-text-subtle)]">
                          {name} · {window}
                        </p>
                        <p className="mt-1 text-2xl font-bold text-[var(--lt-text)]">{value}</p>
                      </PanelContent>
                    </Panel>
                  ))
                )
              ) : (
                <EmptyState title="No cohort data" description="Cohorts appear after tracked users exist." />
              )}
            </div>
          )}

          {tab === "attribution" && (
            <div className="overflow-hidden rounded-xl border border-[var(--lt-border)] bg-[var(--lt-surface)]">
              {attribution.length === 0 ? (
                <EmptyState
                  title="No attributed purchases"
                  description="Purchases with UTM/click IDs appear here."
                />
              ) : (
                <table className={adminTableClass}>
                  <thead>
                    <tr className={adminTableHeadRowClass}>
                      <th className="px-3 py-2">Source</th>
                      <th className="px-3 py-2">Medium</th>
                      <th className="px-3 py-2">Campaign</th>
                      <th className="px-3 py-2">Purchases</th>
                    </tr>
                  </thead>
                  <tbody>
                    {attribution.map((row) => (
                      <tr
                        key={`${row.source}-${row.medium}-${row.campaign}`}
                        className={adminTableRowClass}
                      >
                        <td className="px-3 py-2">{row.source}</td>
                        <td className="px-3 py-2">{row.medium}</td>
                        <td className="px-3 py-2">{row.campaign}</td>
                        <td className="px-3 py-2">{row.purchases}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {tab === "email-revenue" && (
            <div className="space-y-3">
              <p className="text-sm text-[var(--lt-text-subtle)]">
                {emailRevenue?.metricsAvailableFrom ||
                  "Email click attribution available from Phase 2.2 onward."}{" "}
                Model: {emailRevenue?.attributionModel || "last_email_click"} · Window:{" "}
                {emailRevenue?.attributionWindowDays ?? 30} days. First-touch UTM attribution remains
                on the Attribution tab.
              </p>
              {!emailRevenue?.rows?.length ? (
                <EmptyState
                  title="No nurture email metrics yet"
                  description="Sends, opens, and clicks appear after Phase 2.2 nurture tracking is live."
                />
              ) : (
                <div className="overflow-x-auto rounded-xl border border-[var(--lt-border)] bg-[var(--lt-surface)]">
                  <table className={adminTableClass}>
                    <thead>
                      <tr className={adminTableHeadRowClass}>
                        <th className="px-3 py-2">Email</th>
                        <th className="px-3 py-2 text-right">Sends</th>
                        <th className="px-3 py-2 text-right">Unique Opens</th>
                        <th className="px-3 py-2 text-right">Clicks</th>
                        <th className="px-3 py-2 text-right">Searches</th>
                        <th className="px-3 py-2 text-right">Checkouts</th>
                        <th className="px-3 py-2 text-right">Purchases</th>
                        <th className="px-3 py-2 text-right">Revenue</th>
                      </tr>
                    </thead>
                    <tbody>
                      {emailRevenue.rows.map((row) => (
                        <tr key={String(row.email)} className={adminTableRowClass}>
                          <td className="px-3 py-2">{String(row.email)}</td>
                          <td className="px-3 py-2 text-right">{Number(row.sends)}</td>
                          <td className="px-3 py-2 text-right">{Number(row.uniqueOpens)}</td>
                          <td className="px-3 py-2 text-right">{Number(row.clicks)}</td>
                          <td className="px-3 py-2 text-right">{Number(row.searches)}</td>
                          <td className="px-3 py-2 text-right">{Number(row.checkouts)}</td>
                          <td className="px-3 py-2 text-right">{Number(row.purchases)}</td>
                          <td className="px-3 py-2 text-right">
                            ${Number(row.revenueUsd || 0).toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {tab === "license-health" && (
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {Object.keys(licenseHealth).length === 0 ? (
                <EmptyState title="No license health events" description="Activation outcomes appear here." />
              ) : (
                Object.entries(licenseHealth).map(([key, value]) => (
                  <Panel key={key}>
                    <PanelContent className="p-4">
                      <p className="text-xs text-[var(--lt-text-subtle)]">{key}</p>
                      <p className="mt-1 text-2xl font-bold text-[var(--lt-text)]">{value}</p>
                    </PanelContent>
                  </Panel>
                ))
              )}
            </div>
          )}

          {tab === "outreach-health" && (
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {outreachHealth?.counts
                ? Object.entries(outreachHealth.counts as Record<string, number>).map(
                    ([key, value]) => (
                      <Panel key={key}>
                        <PanelContent className="p-4">
                          <p className="text-xs text-[var(--lt-text-subtle)]">{key}</p>
                          <p className="mt-1 text-2xl font-bold text-[var(--lt-text)]">{value}</p>
                        </PanelContent>
                      </Panel>
                    )
                  )
                : (
                  <EmptyState title="No outreach metrics" description="Sent/open/fail events appear here." />
                )}
            </div>
          )}

          {tab === "revenue" && kpis && (
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {[
                { label: "Trial → Paid", value: rateLabel(kpis.trialToPaidRate as number | null) },
                {
                  label: "Paid → Activation",
                  value: rateLabel(kpis.paidToActivationRate as number | null),
                },
                {
                  label: "Activation → First Search",
                  value: rateLabel(kpis.activationToFirstSearchRate as number | null),
                },
                {
                  label: "Checkout abandon",
                  value: rateLabel(kpis.checkoutAbandonRate as number | null),
                },
                {
                  label: "Payment success",
                  value: rateLabel(kpis.paymentSuccessRate as number | null),
                },
                {
                  label: "Mailbox adoption",
                  value: rateLabel(kpis.mailboxAdoptionRate as number | null),
                },
              ].map((stat) => (
                <Panel key={stat.label}>
                  <PanelContent className="p-4">
                    <p className="text-xs text-[var(--lt-text-subtle)]">{stat.label}</p>
                    <p className="mt-1 text-2xl font-bold text-[var(--lt-text)]">{stat.value}</p>
                  </PanelContent>
                </Panel>
              ))}
            </div>
          )}

          {(tab === "users" || tab === "searches" || tab === "search-health") && (
            <>
              {(tab === "searches" || tab === "search-health") && (
                <div className="mb-4 grid gap-3 md:grid-cols-3">
                  {[
                    { label: "Started", value: searchSummary.started },
                    { label: "Completed", value: searchSummary.completed },
                    { label: "Failed", value: searchSummary.failed },
                  ].map((stat) => (
                    <Panel key={stat.label}>
                      <PanelContent className="p-4">
                        <p className="text-xs text-[var(--lt-text-subtle)]">{stat.label}</p>
                        <p className="mt-1 text-2xl font-bold text-[var(--lt-text)]">{stat.value}</p>
                      </PanelContent>
                    </Panel>
                  ))}
                </div>
              )}
              {tab === "search-health" && searchQuality?.summary ? (
                <div className="mb-4 grid gap-3 md:grid-cols-3">
                  {Object.entries(searchQuality.summary as Record<string, number | null>).map(
                    ([key, value]) => (
                      <Panel key={key}>
                        <PanelContent className="p-4">
                          <p className="text-xs text-[var(--lt-text-subtle)]">{key}</p>
                          <p className="mt-1 text-2xl font-bold text-[var(--lt-text)]">
                            {value ?? "—"}
                          </p>
                        </PanelContent>
                      </Panel>
                    )
                  )}
                </div>
              ) : null}
              <EventsTable events={events} total={eventsTotal} emptyTitle="No events in range" />
            </>
          )}

          {(tab === "infrastructure" ||
            tab === "workers" ||
            tab === "queues" ||
            tab === "smtp") && (
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {infra
                ? Object.entries(infra).map(([key, value]) => (
                    <Panel key={key}>
                      <PanelContent className="p-4">
                        <p className="text-xs text-[var(--lt-text-subtle)]">{key}</p>
                        <p className="mt-1 text-lg font-bold text-[var(--lt-text)]">
                          {String(value)}
                        </p>
                      </PanelContent>
                    </Panel>
                  ))
                : (
                  <EmptyState
                    title="No infrastructure snapshot"
                    description="Open this tab after observability tables are migrated."
                  />
                )}
            </div>
          )}

          {tab === "errors" && (
            <EventsTable events={errors} total={errors.length} emptyTitle="No errors tracked" />
          )}

          {tab === "alerts" && (
            <>
              <div className="mb-4 overflow-hidden rounded-xl border border-[var(--lt-border)] bg-[var(--lt-surface)]">
                {alerts.length === 0 ? (
                  <EmptyState title="No alerts" description="Open alerts appear when thresholds are breached." />
                ) : (
                  <table className={adminTableClass}>
                    <thead>
                      <tr className={adminTableHeadRowClass}>
                        <th className="px-3 py-2">Severity</th>
                        <th className="px-3 py-2">Title</th>
                        <th className="px-3 py-2">Message</th>
                        <th className="px-3 py-2">Status</th>
                        <th className="px-3 py-2">Last seen</th>
                        <th className="px-3 py-2">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {alerts.map((alert) => (
                        <tr key={String(alert.id)} className={adminTableRowClass}>
                          <td className="px-3 py-2">
                            <StatusBadge
                              status={
                                alert.severity === "critical"
                                  ? "error"
                                  : alert.severity === "warning"
                                    ? "processing"
                                    : "paused"
                              }
                              label={String(alert.severity)}
                            />
                          </td>
                          <td className="px-3 py-2 text-[var(--lt-text)]">{String(alert.title)}</td>
                          <td className="px-3 py-2 text-[var(--lt-text-muted)]">
                            {String(alert.message)}
                          </td>
                          <td className="px-3 py-2 text-[var(--lt-text-muted)]">
                            {String(alert.status)}
                          </td>
                          <td className="px-3 py-2 text-[var(--lt-text-subtle)]">
                            {String(alert.last_seen_at || "")}
                          </td>
                          <td className="px-3 py-2">
                            <div className="flex flex-wrap gap-1">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="h-7 text-[11px]"
                                onClick={() => {
                                  void (async () => {
                                    await patchObservabilityAlert(String(alert.id), "acknowledged");
                                    const data = await getObservabilityAlerts("all");
                                    setAlerts(data.alerts || []);
                                  })().catch(handleSessionError);
                                }}
                              >
                                Ack
                              </Button>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="h-7 text-[11px]"
                                onClick={() => {
                                  void (async () => {
                                    await patchObservabilityAlert(String(alert.id), "resolved");
                                    const data = await getObservabilityAlerts("all");
                                    setAlerts(data.alerts || []);
                                  })().catch(handleSessionError);
                                }}
                              >
                                Resolve
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              <Panel>
                <PanelContent className="p-4">
                  <h3 className="mb-3 text-sm font-bold text-[var(--lt-text)]">Alert catalogue</h3>
                  <div className="space-y-2">
                    {alertCatalogue.map((item) => (
                      <div key={item.key} className="text-sm">
                        <span className="font-semibold text-[var(--lt-text)]">{item.title}</span>
                        <span className="text-[var(--lt-text-subtle)]"> — {item.description}</span>
                      </div>
                    ))}
                  </div>
                </PanelContent>
              </Panel>
            </>
          )}
        </>
      )}
    </>
  );
}

function EventsTable({
  events,
  total,
  emptyTitle,
}: {
  events: Array<Record<string, unknown>>;
  total: number;
  emptyTitle: string;
}) {
  if (events.length === 0) {
    return <EmptyState title={emptyTitle} description="Tracked events will appear here." />;
  }

  return (
    <div className="overflow-hidden rounded-xl border border-[var(--lt-border)] bg-[var(--lt-surface)]">
      <div className="border-b border-[var(--lt-border)] px-4 py-2 text-xs text-[var(--lt-text-subtle)]">
        Showing {events.length} of {total}
      </div>
      <div className="overflow-x-auto">
        <table className={adminTableClass}>
          <thead>
            <tr className={adminTableHeadRowClass}>
              <th className="px-3 py-2">Time</th>
              <th className="px-3 py-2">Event</th>
              <th className="px-3 py-2">Category</th>
              <th className="px-3 py-2">Source</th>
              <th className="px-3 py-2">Path</th>
              <th className="px-3 py-2">Search ID</th>
            </tr>
          </thead>
          <tbody>
            {events.map((row) => (
              <tr key={String(row.id)} className={adminTableRowClass}>
                <td className="whitespace-nowrap px-3 py-2 text-[var(--lt-text-subtle)]">
                  {String(row.occurred_at || "")}
                </td>
                <td className="px-3 py-2 font-medium text-[var(--lt-text)]">
                  {String(row.event_name || "")}
                </td>
                <td className="px-3 py-2 text-[var(--lt-text-muted)]">
                  {String(row.event_category || "")}
                </td>
                <td className="px-3 py-2 text-[var(--lt-text-muted)]">{String(row.source || "")}</td>
                <td className="max-w-[180px] truncate px-3 py-2 text-[var(--lt-text-muted)]">
                  {String(row.page_path || "—")}
                </td>
                <td className="px-3 py-2 font-mono text-xs text-[var(--lt-text-subtle)]">
                  {String(row.search_id || "—")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
