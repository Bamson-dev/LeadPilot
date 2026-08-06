"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { SALE_PRICE_NGN } from "@/constants/pricing";
import { AdminWorkspaceHeader } from "@/components/admin/admin-workspace-header";
import { useAdminSession } from "@/components/admin/admin-session-context";
import { isAdminDemoMode } from "@/components/admin/admin-utils";
import { AdminLoading } from "@/components/admin/admin-ui";
import { Button } from "@/components/ui/button";
import { Panel, PanelContent } from "@/components/ui/panel";
import {
  getOverview,
  getTrialStats,
  type AdminOverview,
  type TrialStats,
} from "@/services/admin-api";

export function AnalyticsWorkspace() {
  const { handleSessionError } = useAdminSession();
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [trialStats, setTrialStats] = useState<TrialStats | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [overviewData, statsData] = await Promise.all([getOverview(), getTrialStats()]);
      setOverview(overviewData);
      setTrialStats(statsData);
    } catch (err) {
      handleSessionError(err);
    } finally {
      setLoading(false);
    }
  }, [handleSessionError]);

  useEffect(() => {
    void load();
    const interval = setInterval(() => void load(), 120_000);
    return () => clearInterval(interval);
  }, [load]);

  const isDemoMode = isAdminDemoMode();

  return (
    <>
      <AdminWorkspaceHeader
        title="Analytics"
        description="Diagnostic metrics from existing admin APIs — no synthetic charts."
      />

      {loading ? (
        <AdminLoading label="Loading analytics..." />
      ) : (
        <>
          <div className="mb-6 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {overview
              ? [
                  {
                    label: "Total Users",
                    value: isDemoMode ? 447 : overview.totalUsers,
                  },
                  {
                    label: "Active Users",
                    value: isDemoMode ? 389 : overview.activeUsers,
                  },
                  {
                    label: "Est. Revenue",
                    value: isDemoMode
                      ? "₦6,705,000"
                      : `₦${overview.estimatedRevenue.toLocaleString()}`,
                    sub: `at ₦${SALE_PRICE_NGN.toLocaleString()} per user`,
                  },
                  {
                    label: "Paid Searches",
                    value: isDemoMode ? "5,400" : overview.totalSearches,
                  },
                  {
                    label: "Trial Searches",
                    value: isDemoMode ? "1,163" : overview.totalTrialSearches,
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
                  { label: "Est. Conversion Rate", value: `${trialStats.conversionRate}%` },
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

          <Panel>
            <PanelContent className="space-y-3 p-5">
              <p className="m-0 text-sm text-[var(--lt-text-muted)]">
                For activation trends, open Accounts. For trial search detail, open Trial. For drip
                email metrics, open Trial → Email Performance.
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
    </>
  );
}
