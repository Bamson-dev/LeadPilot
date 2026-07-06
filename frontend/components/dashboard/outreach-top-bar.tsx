"use client";

import type { OutreachBalance, OutreachMailbox } from "@/types/outreach";

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
        className="rounded-lg border border-white/[0.08] bg-[#0F0F14]/90 px-3 py-2"
        aria-label="Outreach status"
      >
        <p className="text-xs text-[#6B6B80]">Loading outreach balance…</p>
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
      className="rounded-lg border border-white/[0.08] bg-[#0F0F14]/90 px-3 py-2.5 sm:py-2"
      aria-label="Outreach status"
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-[#F4F4FF] leading-tight">
            {sendBalance.toLocaleString()}{" "}
            <span className="text-xs font-normal text-[#6B6B80]">sends left</span>
          </p>
          <p className="mt-0.5 text-[11px] text-[#6B6B80] leading-snug">
            Free trial {free} · Monthly {monthly} · Purchased {purchased}
          </p>
        </div>
        <div className="min-w-0 text-[11px] text-[#6B6B80] sm:text-right leading-snug">
          {primary ? (
            <p className="truncate text-[#A1A1B5]">
              <span className="text-[#F4F4FF]">{primary.email_address}</span>
              {" · "}
              {primary.daily_send_count}/{primary.daily_cap} today
            </p>
          ) : (
            <p className="text-[#A1A1B5]">No mailbox connected</p>
          )}
          <p>
            Mailboxes {mailboxCount}/{maxMailboxes}
          </p>
        </div>
      </div>
    </div>
  );
}
