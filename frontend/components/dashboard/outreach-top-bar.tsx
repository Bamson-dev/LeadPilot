"use client";

import Link from "next/link";
import type { OutreachBalance, OutreachMailbox } from "@/types/outreach";
import { StatusBadge } from "@/components/ui/status-badge";
import { Skeleton } from "@/components/ui/skeleton";

interface OutreachTopBarProps {
  balance: OutreachBalance | null;
  mailboxes: OutreachMailbox[];
  loading?: boolean;
}

export function OutreachTopBar({
  balance,
  mailboxes,
  loading = false,
}: OutreachTopBarProps) {
  const activeMailboxes = mailboxes.filter((m) => m.status === "active");
  const primary = activeMailboxes[0];

  if (loading && !balance) {
    return (
      <div
        className="rounded-xl border border-[var(--lt-border)] bg-[var(--lt-surface)] px-4 py-3"
        aria-label="Outreach status"
      >
        <Skeleton className="h-4 w-40" />
      </div>
    );
  }

  const sendBalance = balance?.send_balance ?? 0;
  const free = balance?.free_trial_remaining ?? 0;
  const monthly = balance?.monthly_allowance_remaining ?? 0;
  const purchased = balance?.purchased_credits ?? 0;
  const mailboxCount = balance?.mailbox_count ?? activeMailboxes.length;
  const maxMailboxes = balance?.max_mailboxes ?? 1;

  return (
    <div
      className="rounded-xl border border-[var(--lt-border)] bg-[var(--lt-surface)] px-4 py-3"
      aria-label="Outreach status"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-[var(--lt-text)]">
            {sendBalance.toLocaleString()}{" "}
            <span className="text-xs font-normal text-[var(--lt-text-muted)]">
              sends left
            </span>
          </p>
          <p className="mt-0.5 text-[11px] text-[var(--lt-text-subtle)]">
            Free trial {free} · Monthly {monthly} · Purchased {purchased}
          </p>
        </div>
        <div className="min-w-0 text-[11px] text-[var(--lt-text-muted)] sm:text-right">
          {primary ? (
            <p className="truncate">
              <span className="text-[var(--lt-text)]">{primary.email_address}</span>
              {" · "}
              {primary.daily_send_count}/{primary.daily_cap} today
            </p>
          ) : (
            <div className="flex items-center justify-end gap-2">
              <StatusBadge status="paused" label="No mailbox" />
            </div>
          )}
          <p className="mt-0.5">
            Mailboxes {mailboxCount}/{maxMailboxes}
          </p>
          <p className="mt-1">
            <Link
              href="/dashboard/plans"
              className="text-[var(--lt-accent-soft)] hover:text-[var(--lt-text)] underline underline-offset-2"
            >
              Buy outreach sends
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
