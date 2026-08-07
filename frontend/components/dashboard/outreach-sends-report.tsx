"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import {
  StatusBadge,
  type StatusBadgeStatus,
} from "@/components/ui/status-badge";
import { fetchSendsReport, markSentEmailReplied } from "@/services/outreach-api";
import type { OutreachSendStatusFilter, OutreachSendsReport } from "@/types/outreach";

const PAGE_SIZE = 25;

const FILTER_SELECT_CLASS =
  "rounded-md border border-[var(--lt-border)] bg-[var(--lt-surface-2)] px-2.5 py-1.5 text-sm text-[var(--lt-text)] cursor-pointer outline-none appearance-none";

interface OutreachSendsReportProps {
  refreshKey?: number;
  isActive?: boolean;
}

function statusLabel(status: string): string {
  if (status === "bounced") return "bounced (address dead)";
  if (status === "failed") return "failed (may retry)";
  return status;
}

function getSendStatusBadgeProps(
  status: string,
  repliedAt: string | null | undefined
): { status: StatusBadgeStatus; label: string } {
  if (repliedAt) {
    return { status: "replied", label: "Replied" };
  }
  switch (status) {
    case "sent":
      return { status: "active", label: "Sent" };
    case "queued":
      return { status: "processing", label: "Queued" };
    case "sending":
      return { status: "processing", label: "Sending" };
    case "bounced":
      return { status: "error", label: statusLabel(status) };
    case "failed":
      return { status: "error", label: statusLabel(status) };
    default:
      return { status: "paused", label: statusLabel(status) };
  }
}

function rateColor(rate: number): string {
  if (rate > 40) return "text-[var(--lt-success)]";
  if (rate >= 20) return "text-[var(--lt-warning)]";
  return "text-[var(--lt-danger)]";
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

function SendsReportSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={`summary-skeleton-${i}`}
            className="rounded-xl border border-[var(--lt-border)] bg-[var(--lt-surface-2)] p-4"
          >
            <Skeleton className="h-3 w-20" />
            <Skeleton className="mt-2 h-8 w-16" />
          </div>
        ))}
      </div>
      <div className="overflow-hidden rounded-xl border border-[var(--lt-border)]">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton
            key={`row-skeleton-${i}`}
            className="h-12 w-full rounded-none border-b border-[var(--lt-border)] last:border-b-0"
          />
        ))}
      </div>
    </div>
  );
}

export function OutreachSendsReport({
  refreshKey = 0,
  isActive = false,
}: OutreachSendsReportProps) {
  const [report, setReport] = useState<OutreachSendsReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<OutreachSendStatusFilter>("all");
  const [offset, setOffset] = useState(0);
  const [markingReplyId, setMarkingReplyId] = useState<string | null>(null);

  const load = useCallback(async (options?: { silent?: boolean }) => {
    if (!options?.silent) {
      setLoading(true);
    }
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
      if (!options?.silent) {
        setReport(null);
      }
      setError(err instanceof Error ? err.message : "Failed to load sends report");
    } finally {
      if (!options?.silent) {
        setLoading(false);
      }
    }
  }, [offset, statusFilter]);

  useEffect(() => {
    if (!isActive) {
      setLoading(false);
      return;
    }
    void load();
  }, [isActive, load, refreshKey]);

  const inProgress = report?.summary.in_progress ?? 0;

  useEffect(() => {
    if (!isActive || inProgress <= 0) return;
    const timer = window.setInterval(() => {
      void load({ silent: true });
    }, 5000);
    return () => window.clearInterval(timer);
  }, [isActive, inProgress, load]);

  const total = report?.pagination.total ?? 0;
  const pageStart = total === 0 ? 0 : offset + 1;
  const pageEnd = Math.min(offset + PAGE_SIZE, total);
  const canPrev = offset > 0;
  const canNext = offset + PAGE_SIZE < total;

  async function markReplied(id: string) {
    setMarkingReplyId(id);
    try {
      await markSentEmailReplied(id);
      await load();
    } finally {
      setMarkingReplyId(null);
    }
  }

  return (
    <section className="rounded-xl border border-[var(--lt-border)] bg-[var(--lt-surface)] p-4 sm:p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-[var(--lt-text)]">Sends report</h2>
          <p className="text-sm text-[var(--lt-text-muted)]">
            Per-recipient delivery and open tracking for your outreach emails.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => void load()}
          disabled={loading}
        >
          Refresh
        </Button>
      </div>

      {report && (
        <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-xl border border-[var(--lt-border)] bg-[var(--lt-surface-2)] p-4">
            <p className="text-xs uppercase tracking-wide text-[var(--lt-text-muted)]">
              Total sent
            </p>
            <p className="mt-1 text-2xl font-bold text-[var(--lt-text)]">
              {report.summary.total_sent}
            </p>
            {report.summary.in_progress > 0 && (
              <p className="mt-1 text-xs text-[var(--lt-warning)]">
                {report.summary.in_progress} delivering…
              </p>
            )}
          </div>
          <div className="rounded-xl border border-[var(--lt-border)] bg-[var(--lt-surface-2)] p-4">
            <p className="text-xs uppercase tracking-wide text-[var(--lt-text-muted)]">
              Delivering now
            </p>
            <p className="mt-1 text-2xl font-bold text-[var(--lt-warning)]">
              {report.summary.in_progress}
            </p>
          </div>
          <div className="rounded-xl border border-[var(--lt-border)] bg-[var(--lt-surface-2)] p-4">
            <p className="text-xs uppercase tracking-wide text-[var(--lt-text-muted)]">
              Total opened
            </p>
            <p className="mt-1 text-2xl font-bold text-[var(--lt-text)]">
              {report.summary.total_opened}
            </p>
          </div>
          <div className="rounded-xl border border-[var(--lt-border)] bg-[var(--lt-surface-2)] p-4">
            <p className="text-xs uppercase tracking-wide text-[var(--lt-text-muted)]">
              Open rate
            </p>
            <p
              className={`mt-1 text-2xl font-bold ${rateColor(report.summary.open_rate)}`}
            >
              {report.summary.open_rate}%
            </p>
          </div>
        </div>
      )}

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm text-[var(--lt-text-muted)]">
          Status
          <select
            value={statusFilter}
            onChange={(e) => {
              setOffset(0);
              setStatusFilter(e.target.value as OutreachSendStatusFilter);
            }}
            className={FILTER_SELECT_CLASS}
          >
            <option value="all">All</option>
            <option value="queued">Queued</option>
            <option value="sending">Sending</option>
            <option value="sent">Sent</option>
            <option value="bounced">Bounced (dead address)</option>
            <option value="failed">Failed (temporary)</option>
          </select>
        </label>
        <span className="text-xs text-[var(--lt-text-subtle)]">Sorted by most recent</span>
      </div>

      {loading && !report ? (
        <SendsReportSkeleton />
      ) : error ? (
        <Alert variant="danger">
          <AlertTitle>Could not load sends report</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-3"
            onClick={() => void load()}
          >
            Try again
          </Button>
        </Alert>
      ) : !report || total === 0 ? (
        <EmptyState
          title="No sends yet"
          description="No emails match this filter yet. Select leads with an email and use Send email above."
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-[var(--lt-border)]">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-[var(--lt-border)] bg-[var(--lt-surface-2)] text-left text-xs uppercase tracking-wide text-[var(--lt-text-muted)]">
                <th className="px-3 py-2">Recipient</th>
                <th className="px-3 py-2">Business</th>
                <th className="px-3 py-2">Subject</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Sent</th>
                <th className="px-3 py-2">Open status</th>
                <th className="px-3 py-2">Mailbox</th>
                <th className="px-3 py-2">Follow up</th>
                <th className="px-3 py-2">Action</th>
              </tr>
            </thead>
            <tbody>
              {report.sends.map((row) => {
                const badgeProps = getSendStatusBadgeProps(row.status, row.replied_at);
                return (
                  <tr
                    key={row.id}
                    className="border-b border-[var(--lt-border)] last:border-b-0 hover:bg-[var(--lt-surface-3)]"
                  >
                    <td className="px-3 py-3 text-[var(--lt-text)]">{row.recipient_email}</td>
                    <td className="px-3 py-3 text-[var(--lt-text-muted)]">
                      {row.business_name || "—"}
                    </td>
                    <td className="max-w-[200px] truncate px-3 py-3 text-[var(--lt-text-muted)]">
                      {row.subject || "—"}
                    </td>
                    <td className="px-3 py-3">
                      <StatusBadge status={badgeProps.status} label={badgeProps.label} />
                      {row.error_message && (
                        <p className="mt-1 max-w-[180px] truncate text-xs text-[var(--lt-danger)]">
                          {row.error_message}
                        </p>
                      )}
                    </td>
                    <td className="px-3 py-3 text-[var(--lt-text-muted)]">
                      {formatSentTime(row.sent_at)}
                    </td>
                    <td className="px-3 py-3">
                      {row.opened_at ? (
                        <span className="font-medium text-[var(--lt-success)]">
                          Opened · {formatOpenedAt(row.opened_at)}
                          {row.open_count > 1 ? ` (${row.open_count}×)` : ""}
                        </span>
                      ) : row.status === "sent" ? (
                        <span className="text-[var(--lt-text-muted)]">Not opened yet</span>
                      ) : (
                        <span className="text-[var(--lt-text-subtle)]">—</span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-[var(--lt-text-muted)]">
                      {row.mailbox_email || "—"}
                    </td>
                    <td className="px-3 py-3 text-xs text-[var(--lt-text-muted)]">
                      {row.send_kind === "followup"
                        ? `Step ${row.followup_step_number ?? "?"}`
                        : "Initial"}
                      <div className="mt-1 text-[var(--lt-text-subtle)]">
                        Next:{" "}
                        {row.followup_due_at
                          ? new Date(row.followup_due_at).toLocaleString()
                          : "—"}
                      </div>
                      <div className="mt-1 text-[var(--lt-danger)]">
                        Stop: {row.followup_stop_reason ?? "—"}
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={markingReplyId === row.id}
                        onClick={() => void markReplied(row.id)}
                      >
                        {markingReplyId === row.id ? "Saving..." : "Mark replied"}
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {report && total > 0 && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-[var(--lt-text-subtle)]">
            Showing {pageStart}–{pageEnd} of {total}
          </p>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!canPrev || loading}
              onClick={() => setOffset((value) => Math.max(0, value - PAGE_SIZE))}
            >
              Previous
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!canNext || loading}
              onClick={() => setOffset((value) => value + PAGE_SIZE)}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      <p className="mt-3 text-xs text-[var(--lt-text-subtle)]">
        Need more sends?{" "}
        <Link
          href="/dashboard/plans"
          className="text-[var(--lt-accent-soft)] underline underline-offset-2 hover:text-[var(--lt-text)]"
        >
          View plans
        </Link>
      </p>
    </section>
  );
}
