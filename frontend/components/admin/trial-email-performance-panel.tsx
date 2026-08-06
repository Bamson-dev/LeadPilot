"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  getEmailPerformance,
  type EmailPerformanceRow,
} from "@/services/admin-api";
import {
  AdminLoading,
  AdminPanel,
  adminErrorClass,
  adminTableClass,
  adminTableHeadRowClass,
  adminTableRowClass,
  rateStatusClass,
} from "@/components/admin/admin-ui";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Panel, PanelContent } from "@/components/ui/panel";
import { cn } from "@/utils/utils";

const EMAIL_SUBJECTS: Record<number, string> = {
  1: "you are 60 seconds from your first client",
  2: "i noticed something from yesterday",
  3: "she closed a client in 6 days",
  4: "imagine never chasing clients again",
  5: "can i be honest with you?",
  6: "it was never your skill",
  7: "people keep saying the same thing",
  8: "one week in. honest question",
  9: "one client. that is all it takes",
  10: "feast or famine. here is the difference",
  11: "picture tomorrow morning",
  12: "this is going away soon",
  13: "can i ask you something real?",
  14: "tomorrow this changes",
  15: "my last email to you",
};

function formatLastOpened(value: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function TrialEmailPerformancePanel({
  onSessionExpired,
}: {
  onSessionExpired: () => void;
}) {
  const [rows, setRows] = useState<EmailPerformanceRow[]>([]);
  const [totalSignups, setTotalSignups] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getEmailPerformance();
      setRows(data.rows);
      setTotalSignups(data.total_signups);
    } catch (err) {
      if (err instanceof Error && err.message === "SESSION_EXPIRED") {
        onSessionExpired();
        return;
      }
      setError(err instanceof Error ? err.message : "Failed to load email performance");
    } finally {
      setLoading(false);
    }
  }, [onSessionExpired]);

  useEffect(() => {
    void load();
  }, [load]);

  const hasOpenData = useMemo(
    () => rows.some((row) => row.opens > 0),
    [rows]
  );

  const summary = useMemo(() => {
    const withSends = rows.filter((row) => row.sends > 0);
    const avg =
      withSends.length > 0
        ? withSends.reduce((sum, row) => sum + (row.open_rate ?? 0), 0) / withSends.length
        : 0;
    const best = withSends.reduce<EmailPerformanceRow | null>((top, row) => {
      if (!top) return row;
      return (row.open_rate ?? 0) > (top.open_rate ?? 0) ? row : top;
    }, null);
    return {
      averageRate: Math.round(avg * 10) / 10,
      best,
    };
  }, [rows]);

  return (
    <AdminPanel
      title="Email Performance"
      description="Subject performance across 15 trial emails"
      action={
        <Button type="button" variant="outline" size="sm" onClick={() => void load()}>
          Refresh
        </Button>
      }
      className="mt-0"
    >
      {loading ? (
        <AdminLoading label="Loading email performance..." />
      ) : error ? (
        <p className={adminErrorClass}>{error}</p>
      ) : !hasOpenData ? (
        <EmptyState
          title="No email opens recorded yet"
          description="Opens will appear here as trial users receive and open their emails."
        />
      ) : (
        <>
          <div className="mb-4 grid gap-3 md:grid-cols-3">
            {[
              { label: "Total Trial Signups", value: totalSignups, className: "text-[var(--lt-text)]" },
              {
                label: "Average Open Rate",
                value: `${summary.averageRate}%`,
                className: "text-[var(--lt-accent-soft)]",
              },
              {
                label: "Best Performing",
                value: summary.best
                  ? `Step ${summary.best.step}: ${EMAIL_SUBJECTS[summary.best.step]}`
                  : "—",
                className: "text-sm font-semibold text-[var(--lt-text)]",
              },
            ].map((stat) => (
              <Panel key={stat.label}>
                <PanelContent className="p-4">
                  <p className="text-xs uppercase tracking-wide text-[var(--lt-text-subtle)]">
                    {stat.label}
                  </p>
                  <p className={cn("mt-1 text-2xl font-bold", stat.className)}>{stat.value}</p>
                </PanelContent>
              </Panel>
            ))}
          </div>

          <div className="overflow-x-auto">
            <table className={adminTableClass}>
              <thead>
                <tr className={adminTableHeadRowClass}>
                  <th className="px-3 py-2">Step</th>
                  <th className="px-3 py-2">Subject</th>
                  <th className="px-3 py-2">Sends</th>
                  <th className="px-3 py-2">Opens</th>
                  <th className="px-3 py-2">Open Rate</th>
                  <th className="px-3 py-2">Last Opened</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.step} className={adminTableRowClass}>
                    <td className="px-3 py-3 font-semibold text-[var(--lt-accent-soft)]">
                      {row.step}
                    </td>
                    <td className="px-3 py-3 text-[var(--lt-text)]">
                      {EMAIL_SUBJECTS[row.step]}
                    </td>
                    <td className="px-3 py-3 text-[var(--lt-text-muted)]">{row.sends}</td>
                    <td className="px-3 py-3 text-[var(--lt-text-muted)]">{row.opens}</td>
                    <td className={cn("px-3 py-3 font-semibold", rateStatusClass(row.open_rate))}>
                      {row.open_rate === null ? "—" : `${row.open_rate}%`}
                    </td>
                    <td className="px-3 py-3 text-[var(--lt-text-subtle)]">
                      {formatLastOpened(row.last_opened_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </AdminPanel>
  );
}
