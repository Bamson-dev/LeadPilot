"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { SALE_PRICE_NGN } from "@/constants/pricing";
import { AdminQueueStatusBar } from "@/components/admin/queue-status-bar";
import { AdminWorkspaceHeader } from "@/components/admin/admin-workspace-header";
import { useAdminSession } from "@/components/admin/admin-session-context";
import { isAdminDemoMode } from "@/components/admin/admin-utils";
import {
  adminTableClass,
  adminTableHeadRowClass,
  adminTableRowClass,
} from "@/components/admin/admin-ui";
import { Button } from "@/components/ui/button";
import { Panel, PanelContent } from "@/components/ui/panel";
import { StatusBadge, type StatusBadgeStatus } from "@/components/ui/status-badge";
import {
  getOverview,
  getRecentUsers,
  getObservabilityExecutive,
  getObservabilityInfrastructure,
  getObservabilityKpis,
  type AdminOverview,
  type RecentAdminUser,
} from "@/services/admin-api";

export function DashboardWorkspace() {
  const { handleSessionError } = useAdminSession();
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [recentUsers, setRecentUsers] = useState<RecentAdminUser[]>([]);
  const [executive, setExecutive] = useState<{
    todaysRevenueEvents: number;
    todaysSearches: number;
    trialUsers: number;
    payingUsers: number;
    activatedUsers: number;
    conversionRate: number | null;
    openAlerts: number;
    errors: number;
    smtpHealth: { sent: number; failed: number };
  } | null>(null);
  const [infra, setInfra] = useState<Record<string, unknown> | null>(null);
  const [kpis, setKpis] = useState<Record<string, unknown> | null>(null);

  const load = useCallback(async () => {
    try {
      const [overviewData, recentData, execData, infraData, kpiData] = await Promise.all([
        getOverview(),
        getRecentUsers(),
        getObservabilityExecutive().catch(() => null),
        getObservabilityInfrastructure().catch(() => null),
        getObservabilityKpis().catch(() => null),
      ]);
      setOverview(overviewData);
      setRecentUsers(recentData.users || []);
      setExecutive(execData?.executive ?? null);
      setInfra(infraData?.snapshot ?? null);
      setKpis((kpiData?.kpis as Record<string, unknown>) ?? null);
    } catch (err) {
      handleSessionError(err);
    }
  }, [handleSessionError]);

  useEffect(() => {
    void load();
    const interval = setInterval(() => void load(), 60_000);
    return () => clearInterval(interval);
  }, [load]);

  const isDemoMode = isAdminDemoMode();
  const snap = infra || {};

  return (
    <>
      <AdminWorkspaceHeader
        title="Executive dashboard"
        description="Live product and system KPIs from Phase 2 observability. Updates every 60 seconds."
      />

      <div className="mb-6">
        <AdminQueueStatusBar enabled />
      </div>

      {executive ? (
        <section className="mb-6">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="m-0 text-sm font-bold text-[var(--lt-text)]">Today</h2>
            <Button variant="outline" size="sm" asChild>
              <Link href="/admin/analytics">Full analytics</Link>
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
            {[
              {
                label: "Revenue events",
                value: executive.todaysRevenueEvents,
                sub: "payment_completed (24h)",
                colorClass: "text-[var(--lt-warning)]",
              },
              {
                label: "Searches",
                value: executive.todaysSearches,
                sub: "search_started (24h)",
                colorClass: "text-[var(--lt-accent)]",
              },
              {
                label: "Trial → Paid",
                value:
                  executive.conversionRate == null ? "—" : `${executive.conversionRate}%`,
                sub: `${executive.trialUsers} trials · ${executive.payingUsers} paid`,
                colorClass: "text-[var(--lt-success)]",
              },
              {
                label: "Activated",
                value: executive.activatedUsers,
                sub: `${executive.openAlerts} open alerts`,
                colorClass: "text-[var(--lt-cyan)]",
              },
              {
                label: "SMTP",
                value: `${executive.smtpHealth.sent}/${executive.smtpHealth.failed}`,
                sub: "sent / failed (24h)",
                colorClass: "text-[var(--lt-text)]",
              },
              {
                label: "Errors",
                value: executive.errors,
                sub: "exceptions + api_error (24h)",
                colorClass: "text-[var(--lt-danger)]",
              },
              {
                label: "Redis",
                value: snap.redis_connected ? "Connected" : "Down",
                sub: `Queue ${String(snap.queue_mode || "—")}`,
                colorClass: snap.redis_connected
                  ? "text-[var(--lt-success)]"
                  : "text-[var(--lt-danger)]",
              },
              {
                label: "API latency",
                value:
                  snap.api_latency &&
                  typeof snap.api_latency === "object" &&
                  (snap.api_latency as { p95Ms?: number }).p95Ms != null
                    ? `${(snap.api_latency as { p95Ms: number }).p95Ms}ms p95`
                    : "—",
                sub: `Waiting ${String(snap.queue_waiting ?? 0)}`,
                colorClass: "text-[var(--lt-text)]",
              },
            ].map((stat) => (
              <Panel key={stat.label}>
                <PanelContent className="p-4">
                  <div className={`mb-1 text-[28px] font-black leading-none ${stat.colorClass}`}>
                    {stat.value}
                  </div>
                  <div className="mb-0.5 text-xs font-bold text-[var(--lt-text)]">{stat.label}</div>
                  <div className="text-[10px] text-[var(--lt-text-subtle)]">{stat.sub}</div>
                </PanelContent>
              </Panel>
            ))}
          </div>
          {kpis ? (
            <div className="mt-3 text-[11px] text-[var(--lt-text-subtle)]">
              Payment success {String(kpis.paymentSuccessRate ?? "—")}% · Mailbox adoption{" "}
              {String(kpis.mailboxAdoptionRate ?? "—")}% · Checkout abandon{" "}
              {String(kpis.checkoutAbandonRate ?? "—")}%
            </div>
          ) : null}
        </section>
      ) : null}

      {overview ? (
        <section className="mb-6">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="m-0 text-sm font-bold text-[var(--lt-text)]">Platform overview</h2>
            <span className="text-[11px] text-[var(--lt-text-subtle)]">Updates every 60 seconds</span>
          </div>
          <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-3">
            {[
              {
                label: "Total Users",
                value: isDemoMode ? 447 : overview.totalUsers,
                sub: `${overview.newUsersToday} new today`,
                colorClass: "text-[var(--lt-accent)]",
              },
              {
                label: "Active Users",
                value: isDemoMode ? 389 : overview.activeUsers,
                sub: `${overview.suspendedUsers} suspended`,
                colorClass: "text-[var(--lt-success)]",
              },
              {
                label: "New This Week",
                value: isDemoMode ? 61 : overview.newUsersThisWeek,
                sub: "activated accounts",
                colorClass: "text-[var(--lt-cyan)]",
              },
              {
                label: "Est. Revenue",
                value: isDemoMode
                  ? "₦6,705,000"
                  : `₦${overview.estimatedRevenue.toLocaleString()}`,
                sub: isDemoMode
                  ? "at ₦15,000 per user"
                  : `at ₦${SALE_PRICE_NGN.toLocaleString()} per user`,
                colorClass: "text-[var(--lt-warning)]",
              },
              {
                label: "Paid Searches",
                value: isDemoMode ? "5,400" : overview.totalSearches,
                sub: "by paying users",
                colorClass: "text-[var(--lt-accent)]",
              },
              {
                label: "Trial Searches",
                value: isDemoMode ? "1,163" : overview.totalTrialSearches,
                sub: "free preview usage",
                colorClass: "text-[var(--lt-text-muted)]",
              },
            ].map((stat) => (
              <Panel key={stat.label}>
                <PanelContent className="p-4">
                  <div className={`mb-1 text-[28px] font-black leading-none ${stat.colorClass}`}>
                    {stat.value}
                  </div>
                  <div className="mb-0.5 text-xs font-bold text-[var(--lt-text)]">{stat.label}</div>
                  <div className="text-[10px] text-[var(--lt-text-subtle)]">{stat.sub}</div>
                </PanelContent>
              </Panel>
            ))}
          </div>
        </section>
      ) : null}

      <section className="mb-6">
        <h2 className="mb-3 text-sm font-bold text-[var(--lt-text)]">Quick actions</h2>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href="/admin/analytics">Analytics</Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link href="/admin/accounts">Manage account</Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link href="/admin/trial">Trial activity</Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link href="/admin/payments">Review payouts</Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link href="/admin/broadcast">Send broadcast</Link>
          </Button>
        </div>
      </section>

      {recentUsers.length > 0 ? (
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="m-0 text-sm font-bold text-[var(--lt-text)]">Latest activity</h2>
            <span className="text-[11px] text-[var(--lt-text-subtle)]">Last 10 signups</span>
          </div>
          <div className="overflow-hidden rounded-xl border border-[var(--lt-border)] bg-[var(--lt-surface)]">
            <div className="overflow-x-auto">
              <table className={adminTableClass}>
                <thead>
                  <tr className={adminTableHeadRowClass}>
                    {["Email", "Status", "Searches", "Joined", "Action"].map((h) => (
                      <th key={h} className="px-3.5 py-2.5 whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {recentUsers.map((user) => (
                    <tr key={user.email} className={adminTableRowClass}>
                      <td className="max-w-[180px] truncate px-3.5 py-3 font-medium text-[var(--lt-text)]">
                        {user.email}
                      </td>
                      <td className="px-3.5 py-3">
                        <StatusBadge
                          status={
                            (user.is_suspended
                              ? "error"
                              : user.activated
                                ? "active"
                                : "processing") as StatusBadgeStatus
                          }
                          label={
                            user.is_suspended
                              ? "Suspended"
                              : user.activated
                                ? "Active"
                                : "Pending"
                          }
                        />
                      </td>
                      <td className="px-3.5 py-3 text-[var(--lt-text-muted)]">
                        {user.searches_used || 0}
                      </td>
                      <td className="whitespace-nowrap px-3.5 py-3 text-[var(--lt-text-muted)]">
                        {new Date(user.created_at).toLocaleDateString("en-GB", {
                          day: "numeric",
                          month: "short",
                          year: "2-digit",
                        })}
                      </td>
                      <td className="px-3.5 py-3">
                        <Button variant="outline" size="sm" className="h-7 text-[11px]" asChild>
                          <Link href={`/admin/accounts?email=${encodeURIComponent(user.email)}`}>
                            Manage
                          </Link>
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      ) : null}
    </>
  );
}
