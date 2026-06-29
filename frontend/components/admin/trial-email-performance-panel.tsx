"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  getEmailPerformance,
  type EmailPerformanceRow,
} from "@/services/admin-api";

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

function rateColor(rate: number | null): string {
  if (rate === null) return "#8888A8";
  if (rate > 40) return "#10B981";
  if (rate >= 20) return "#F59E0B";
  return "#EF4444";
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
    <section className="glass mt-8 rounded-2xl p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-[#F4F4FF]">Email Performance</h2>
          <p className="text-sm text-[#8888A8]">Subject performance across 15 trial emails</p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-[#C0C0D8] hover:bg-white/5"
        >
          Refresh
        </button>
      </div>

      {loading ? (
        <p className="text-sm text-[#8888A8]">Loading email performance...</p>
      ) : error ? (
        <p className="text-sm text-red-400">{error}</p>
      ) : !hasOpenData ? (
        <div className="rounded-xl border border-white/10 bg-[#111118] px-6 py-14 text-center">
          <p className="text-sm text-[#C0C0D8]">
            No email opens recorded yet. Opens will appear here as trial users receive and open
            their emails.
          </p>
        </div>
      ) : (
        <>
          <div className="mb-4 grid gap-3 md:grid-cols-3">
            <div className="rounded-xl border border-white/10 bg-[#111118] p-4">
              <p className="text-xs uppercase tracking-wide text-[#8888A8]">Total Trial Signups</p>
              <p className="mt-1 text-2xl font-bold text-[#F4F4FF]">{totalSignups}</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-[#111118] p-4">
              <p className="text-xs uppercase tracking-wide text-[#8888A8]">Average Open Rate</p>
              <p className="mt-1 text-2xl font-bold text-[#A78BFA]">{summary.averageRate}%</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-[#111118] p-4">
              <p className="text-xs uppercase tracking-wide text-[#8888A8]">Best Performing</p>
              <p className="mt-1 text-sm font-semibold text-[#F4F4FF]">
                {summary.best
                  ? `Step ${summary.best.step}: ${EMAIL_SUBJECTS[summary.best.step]}`
                  : "—"}
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-white/10 text-left text-xs uppercase tracking-wide text-[#8888A8]">
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
                  <tr key={row.step} className="border-b border-white/5">
                    <td className="px-3 py-3 font-semibold text-[#A78BFA]">{row.step}</td>
                    <td className="px-3 py-3 text-[#F4F4FF]">{EMAIL_SUBJECTS[row.step]}</td>
                    <td className="px-3 py-3 text-[#C0C0D8]">{row.sends}</td>
                    <td className="px-3 py-3 text-[#C0C0D8]">{row.opens}</td>
                    <td
                      className="px-3 py-3 font-semibold"
                      style={{ color: rateColor(row.open_rate) }}
                    >
                      {row.open_rate === null ? "—" : `${row.open_rate}%`}
                    </td>
                    <td className="px-3 py-3 text-[#8888A8]">
                      {formatLastOpened(row.last_opened_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}
