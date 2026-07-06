"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { fetchSendsReport } from "@/services/outreach-api";
import type { OutreachSendStatusFilter, OutreachSendsReport } from "@/types/outreach";

const PAGE_SIZE = 25;

interface OutreachSendsReportProps {
  refreshKey?: number;
}

function statusColor(status: string): string {
  switch (status) {
    case "sent":
      return "#10B981";
    case "failed":
      return "#F87171";
    case "queued":
    case "sending":
      return "#FBBF24";
    default:
      return "#6B6B80";
  }
}

function rateColor(rate: number): string {
  if (rate > 40) return "#10B981";
  if (rate >= 20) return "#F59E0B";
  return "#EF4444";
}

function formatSentTime(value: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatOpenedAt(value: string): string {
  return new Date(value).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function OutreachSendsReport({ refreshKey = 0 }: OutreachSendsReportProps) {
  const [report, setReport] = useState<OutreachSendsReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<OutreachSendStatusFilter>("all");
  const [offset, setOffset] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchSendsReport({
        limit: PAGE_SIZE,
        offset,
        status: statusFilter,
        sort: "recent",
      });
      setReport(data);
    } catch (err) {
      setReport(null);
      setError(err instanceof Error ? err.message : "Failed to load sends report");
    } finally {
      setLoading(false);
    }
  }, [offset, statusFilter]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  const total = report?.pagination.total ?? 0;
  const pageStart = total === 0 ? 0 : offset + 1;
  const pageEnd = Math.min(offset + PAGE_SIZE, total);
  const canPrev = offset > 0;
  const canNext = offset + PAGE_SIZE < total;

  return (
    <section className="glass rounded-2xl p-4 sm:p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-[#F4F4FF]">Sends report</h2>
          <p className="text-sm text-[#8888A8]">
            Per-recipient delivery and open tracking for your outreach emails.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-[#C0C0D8] hover:bg-white/5"
        >
          Refresh
        </button>
      </div>

      {report && (
        <div className="mb-4 grid gap-3 md:grid-cols-3">
          <div className="rounded-xl border border-white/10 bg-[#111118] p-4">
            <p className="text-xs uppercase tracking-wide text-[#8888A8]">Total sent</p>
            <p className="mt-1 text-2xl font-bold text-[#F4F4FF]">{report.summary.total_sent}</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-[#111118] p-4">
            <p className="text-xs uppercase tracking-wide text-[#8888A8]">Total opened</p>
            <p className="mt-1 text-2xl font-bold text-[#F4F4FF]">{report.summary.total_opened}</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-[#111118] p-4">
            <p className="text-xs uppercase tracking-wide text-[#8888A8]">Open rate</p>
            <p
              className="mt-1 text-2xl font-bold"
              style={{ color: rateColor(report.summary.open_rate) }}
            >
              {report.summary.open_rate}%
            </p>
          </div>
        </div>
      )}

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm text-[#8888A8]">
          Status
          <select
            value={statusFilter}
            onChange={(e) => {
              setOffset(0);
              setStatusFilter(e.target.value as OutreachSendStatusFilter);
            }}
            className="rounded-lg border border-white/10 bg-[#111118] px-2 py-1.5 text-sm text-[#F4F4FF]"
          >
            <option value="all">All</option>
            <option value="queued">Queued</option>
            <option value="sending">Sending</option>
            <option value="sent">Sent</option>
            <option value="failed">Failed</option>
          </select>
        </label>
        <span className="text-xs text-[#6B6B80]">Sorted by most recent</span>
      </div>

      {loading && !report ? (
        <p className="text-sm text-[#8888A8]">Loading sends report…</p>
      ) : error ? (
        <p className="text-sm text-red-400">{error}</p>
      ) : !report || report.sends.length === 0 ? (
        <div className="rounded-xl border border-white/10 bg-[#111118] px-6 py-14 text-center">
          <p className="text-sm text-[#C0C0D8]">
            No emails match this filter yet. Select leads with an email and use Send email above.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-white/10 text-left text-xs uppercase tracking-wide text-[#8888A8]">
                <th className="px-3 py-2">Recipient</th>
                <th className="px-3 py-2">Business</th>
                <th className="px-3 py-2">Subject</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Sent</th>
                <th className="px-3 py-2">Open status</th>
                <th className="px-3 py-2">Mailbox</th>
              </tr>
            </thead>
            <tbody>
              {report.sends.map((row) => (
                <tr key={row.id} className="border-b border-white/5">
                  <td className="px-3 py-3 text-[#F4F4FF]">{row.recipient_email}</td>
                  <td className="px-3 py-3 text-[#C0C0D8]">{row.business_name || "—"}</td>
                  <td className="px-3 py-3 max-w-[200px] truncate text-[#C0C0D8]">
                    {row.subject || "—"}
                  </td>
                  <td className="px-3 py-3">
                    <span style={{ color: statusColor(row.status), fontWeight: 600 }}>
                      {row.status}
                    </span>
                    {row.error_message && (
                      <p className="mt-0.5 max-w-[180px] truncate text-xs text-red-400">
                        {row.error_message}
                      </p>
                    )}
                  </td>
                  <td className="px-3 py-3 text-[#8888A8]">{formatSentTime(row.sent_at)}</td>
                  <td className="px-3 py-3">
                    {row.opened_at ? (
                      <span className="font-medium text-[#10B981]">
                        Opened · {formatOpenedAt(row.opened_at)}
                        {row.open_count > 1 ? ` (${row.open_count}×)` : ""}
                      </span>
                    ) : row.status === "sent" ? (
                      <span className="text-[#8888A8]">Not opened yet</span>
                    ) : (
                      <span className="text-[#6B6B80]">—</span>
                    )}
                  </td>
                  <td className="px-3 py-3 text-[#8888A8]">
                    {row.mailbox_email || "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {report && total > 0 && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-[#6B6B80]">
            Showing {pageStart}–{pageEnd} of {total}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={!canPrev || loading}
              onClick={() => setOffset((value) => Math.max(0, value - PAGE_SIZE))}
              className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-[#C0C0D8] hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Previous
            </button>
            <button
              type="button"
              disabled={!canNext || loading}
              onClick={() => setOffset((value) => value + PAGE_SIZE)}
              className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-[#C0C0D8] hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      )}

      <p className="mt-3 text-xs text-[#6B6B80]">
        Need more sends?{" "}
        <Link href="/dashboard/plans" className="text-[#A855F7] underline">
          View plans
        </Link>
      </p>
    </section>
  );
}
