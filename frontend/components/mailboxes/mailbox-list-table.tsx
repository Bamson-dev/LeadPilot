"use client";

import { Inbox, Mail } from "lucide-react";
import { cn } from "@/utils/utils";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import type { OutreachMailbox } from "@/types/outreach";
import {
  accountTypeLabel,
  dailyUsagePercent,
  mailboxHealth,
  mailboxHealthBadge,
  mailboxHealthLabel,
  mailboxStatusBadge,
  mailboxStatusLabel,
} from "@/lib/mailbox-display";

export interface MailboxListTableProps {
  mailboxes: OutreachMailbox[];
  loading?: boolean;
  activeMailboxId?: string | null;
  onSelect: (mailbox: OutreachMailbox) => void;
  onConnect: () => void;
  isMobile?: boolean;
  className?: string;
}

function MailboxRow({
  mailbox,
  active,
  onSelect,
  compact,
}: {
  mailbox: OutreachMailbox;
  active: boolean;
  onSelect: () => void;
  compact?: boolean;
}) {
  const health = mailboxHealth(mailbox);
  const usage = dailyUsagePercent(mailbox);

  if (compact) {
    return (
      <button
        type="button"
        onClick={onSelect}
        className={cn(
          "w-full rounded-xl border p-4 text-left transition-colors",
          active
            ? "border-[var(--lt-cyan)]/40 bg-[var(--lt-cyan-soft)]"
            : "border-[var(--lt-border)] bg-[var(--lt-surface-2)] hover:border-[var(--lt-border-strong)]"
        )}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate font-semibold text-[var(--lt-text)]">
              {mailbox.email_address}
            </p>
            <p className="mt-1 text-xs text-[var(--lt-text-muted)]">
              {accountTypeLabel(mailbox.account_type)}
            </p>
          </div>
          <StatusBadge status={mailboxStatusBadge(mailbox.status)}>
            {mailboxStatusLabel(mailbox.status)}
          </StatusBadge>
        </div>
        <div className="mt-3 space-y-1.5">
          <div className="flex justify-between text-xs text-[var(--lt-text-muted)]">
            <span>Daily sends</span>
            <span>
              {mailbox.daily_send_count}/{mailbox.daily_cap}
            </span>
          </div>
          <Progress value={usage} aria-hidden />
        </div>
        <div className="mt-2">
          <StatusBadge status={mailboxHealthBadge(health)}>
            {mailboxHealthLabel(health)}
          </StatusBadge>
        </div>
      </button>
    );
  }

  return (
    <tr
      className={cn(
        "cursor-pointer border-b border-[var(--lt-border)] transition-colors",
        active
          ? "bg-[var(--lt-cyan-soft)]"
          : "hover:bg-[var(--lt-surface-3)]"
      )}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect();
        }
      }}
      tabIndex={0}
      role="row"
      aria-selected={active}
    >
      <td className="px-4 py-3">
        <div className="min-w-0">
          <p className="truncate font-medium text-[var(--lt-text)]">
            {mailbox.email_address}
          </p>
          <p className="mt-0.5 text-xs text-[var(--lt-text-muted)]">
            {accountTypeLabel(mailbox.account_type)}
          </p>
        </div>
      </td>
      <td className="hidden px-4 py-3 md:table-cell">
        <StatusBadge status={mailboxStatusBadge(mailbox.status)}>
          {mailboxStatusLabel(mailbox.status)}
        </StatusBadge>
      </td>
      <td className="hidden px-4 py-3 lg:table-cell">
        <StatusBadge status={mailboxHealthBadge(health)}>
          {mailboxHealthLabel(health)}
        </StatusBadge>
      </td>
      <td className="px-4 py-3">
        <div className="min-w-[7rem] space-y-1">
          <div className="flex justify-between text-xs text-[var(--lt-text-muted)]">
            <span className="md:hidden">Sends</span>
            <span>
              {mailbox.daily_send_count}/{mailbox.daily_cap}
            </span>
          </div>
          <Progress value={usage} aria-hidden />
        </div>
      </td>
    </tr>
  );
}

export function MailboxListTable({
  mailboxes,
  loading = false,
  activeMailboxId,
  onSelect,
  onConnect,
  isMobile = false,
  className,
}: MailboxListTableProps) {
  if (loading) {
    return (
      <div className={cn("space-y-3", className)}>
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    );
  }

  if (mailboxes.length === 0) {
    return (
      <EmptyState
        icon={<Inbox className="h-6 w-6" />}
        title="No mailboxes connected"
        description="Connect Gmail to send outreach from your own address. SMTP credentials are verified when you connect."
        action={
          <Button type="button" variant="default" onClick={onConnect}>
            <Mail className="h-4 w-4" />
            Connect Gmail
          </Button>
        }
        className={className}
      />
    );
  }

  if (isMobile) {
    return (
      <div className={cn("space-y-3", className)}>
        {mailboxes.map((mailbox) => (
          <MailboxRow
            key={mailbox.id}
            mailbox={mailbox}
            active={mailbox.id === activeMailboxId}
            onSelect={() => onSelect(mailbox)}
            compact
          />
        ))}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "overflow-hidden rounded-lg border border-[var(--lt-border)]",
        className
      )}
    >
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="border-b border-[var(--lt-border)] bg-[var(--lt-surface-3)]">
            <tr>
              <th className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-[var(--lt-text-subtle)]">
                Mailbox
              </th>
              <th className="hidden px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-[var(--lt-text-subtle)] md:table-cell">
                Status
              </th>
              <th className="hidden px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-[var(--lt-text-subtle)] lg:table-cell">
                Health
              </th>
              <th className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-[var(--lt-text-subtle)]">
                Daily limit
              </th>
            </tr>
          </thead>
          <tbody>
            {mailboxes.map((mailbox) => (
              <MailboxRow
                key={mailbox.id}
                mailbox={mailbox}
                active={mailbox.id === activeMailboxId}
                onSelect={() => onSelect(mailbox)}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
