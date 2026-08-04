"use client";

import Link from "next/link";
import type { OutreachBalance } from "@/types/outreach";
import { OUTREACH_FREE_SENDS_ON_CONNECT } from "@/types/outreach";
import { formatSubscriptionLabel } from "@/lib/outreach-utils";

interface OutreachBalanceBannerProps {
  balance: OutreachBalance | null;
  hasMailbox: boolean;
  loading?: boolean;
}

export function OutreachBalanceBanner({
  balance,
  hasMailbox,
  loading = false,
}: OutreachBalanceBannerProps) {
  if (loading && !balance) {
    return (
      <div className="rounded-xl border border-[var(--lt-border)] bg-[var(--lt-surface)] p-4 sm:p-5">
        <p className="text-sm text-[var(--lt-text-muted)]">Loading send balance…</p>
      </div>
    );
  }

  if (!balance) {
    return (
      <div className="rounded-xl border border-[var(--lt-border)] bg-[var(--lt-surface)] p-4 sm:p-5">
        <p className="text-xs font-medium uppercase tracking-wide text-[var(--lt-text-muted)]">
          Email outreach balance
        </p>
        <p className="mt-2 text-sm text-[var(--lt-text-muted)]">
          Could not load send balance. Check that{" "}
          <code className="text-[var(--lt-text)]">NEXT_PUBLIC_API_URL</code> points at the
          staging backend, then refresh.
        </p>
        {!hasMailbox && (
          <p className="mt-3 text-sm text-[var(--lt-text)]">
            {OUTREACH_FREE_SENDS_ON_CONNECT} free sends unlock when you connect Gmail below.
          </p>
        )}
      </div>
    );
  }

  const subscription = formatSubscriptionLabel(
    balance.subscription_tier,
    balance.subscription_status
  );

  return (
    <div className="rounded-xl border border-[var(--lt-border)] bg-[var(--lt-surface)] p-4 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-[var(--lt-text-muted)]">
            Email outreach balance
          </p>
          <p
            className="mt-1 text-3xl font-bold text-[var(--lt-text)]"
            style={{ fontFamily: "Bricolage Grotesque, sans-serif" }}
          >
            {balance.send_balance.toLocaleString()}
            <span className="ml-2 text-sm font-normal text-[var(--lt-text-muted)]">sends left</span>
          </p>
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--lt-text-muted)]">
            <span>Free trial: {balance.free_trial_remaining}</span>
            <span>Monthly: {balance.monthly_allowance_remaining}</span>
            <span>Purchased: {balance.purchased_credits}</span>
          </div>
        </div>
        <div className="text-xs text-[var(--lt-text-muted)] sm:text-right">
          {subscription && (
            <p className="font-medium text-[var(--lt-text)]">{subscription}</p>
          )}
          <p className="mt-1">
            Mailboxes: {balance.mailbox_count} / {balance.max_mailboxes}
          </p>
        </div>
      </div>

      {!hasMailbox && (
        <div className="mt-4 rounded-lg border border-[var(--lt-accent)]/30 bg-[var(--lt-accent)]/10 px-4 py-3">
          <p className="text-sm font-semibold text-[var(--lt-text)]">
            {OUTREACH_FREE_SENDS_ON_CONNECT} free sends are waiting for you
          </p>
          <p className="mt-1 text-xs text-[var(--lt-text-muted)] leading-relaxed">
            Connect a Gmail mailbox below to unlock your free sends and start emailing
            leads from your results.
          </p>
        </div>
      )}

      {hasMailbox && balance.free_trial_remaining > 0 && (
        <p className="mt-3 text-xs text-[var(--lt-accent-soft)]">
          {balance.free_trial_remaining} free sends remaining in your trial bucket
        </p>
      )}

      {balance.send_balance === 0 && hasMailbox && (
        <div className="mt-4 rounded-lg border border-[var(--lt-danger)]/30 bg-[var(--lt-danger-soft)] px-4 py-3">
          <p className="text-sm text-[var(--lt-danger)]">
            You have no send credits left.{" "}
            <Link href="/dashboard/plans" className="underline text-[var(--lt-text)]">
              View plans
            </Link>{" "}
            to add more sends.
          </p>
        </div>
      )}
    </div>
  );
}
