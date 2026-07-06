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
      <div
        className="glass rounded-2xl p-4 sm:p-5"
        style={{ border: "1px solid rgba(124,58,237,0.2)" }}
      >
        <p className="text-sm text-[#6B6B80]">Loading send balance…</p>
      </div>
    );
  }

  if (!balance) return null;

  const subscription = formatSubscriptionLabel(
    balance.subscription_tier,
    balance.subscription_status
  );

  return (
    <div
      className="glass rounded-2xl p-4 sm:p-5"
      style={{ border: "1px solid rgba(124,58,237,0.25)" }}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-[#6B6B80]">
            Email outreach balance
          </p>
          <p
            className="mt-1 text-3xl font-bold text-[#F4F4FF]"
            style={{ fontFamily: "Bricolage Grotesque, sans-serif" }}
          >
            {balance.send_balance.toLocaleString()}
            <span className="ml-2 text-sm font-normal text-[#6B6B80]">sends left</span>
          </p>
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[#A1A1B5]">
            <span>Free trial: {balance.free_trial_remaining}</span>
            <span>Monthly: {balance.monthly_allowance_remaining}</span>
            <span>Purchased: {balance.purchased_credits}</span>
          </div>
        </div>
        <div className="text-xs text-[#6B6B80] sm:text-right">
          {subscription && (
            <p className="text-[#F4F4FF] font-medium">{subscription}</p>
          )}
          <p className="mt-1">
            Mailboxes: {balance.mailbox_count} / {balance.max_mailboxes}
          </p>
        </div>
      </div>

      {!hasMailbox && (
        <div
          className="mt-4 rounded-lg px-4 py-3"
          style={{
            background: "rgba(124,58,237,0.1)",
            border: "1px solid rgba(124,58,237,0.25)",
          }}
        >
          <p className="text-sm font-semibold text-[#F4F4FF]">
            {OUTREACH_FREE_SENDS_ON_CONNECT} free sends are waiting for you
          </p>
          <p className="mt-1 text-xs text-[#A1A1B5] leading-relaxed">
            Connect a Gmail mailbox below to unlock your free sends and start emailing
            leads from your results.
          </p>
        </div>
      )}

      {hasMailbox && balance.free_trial_remaining > 0 && (
        <p className="mt-3 text-xs text-[#A855F7]">
          {balance.free_trial_remaining} free sends remaining in your trial bucket
        </p>
      )}

      {balance.send_balance === 0 && hasMailbox && (
        <div
          className="mt-4 rounded-lg px-4 py-3"
          style={{
            background: "rgba(248,113,113,0.08)",
            border: "1px solid rgba(248,113,113,0.25)",
          }}
        >
          <p className="text-sm text-[#FCA5A5]">
            You have no send credits left.{" "}
            <Link href="/dashboard/plans" className="underline text-[#F4F4FF]">
              View plans
            </Link>{" "}
            to add more sends.
          </p>
        </div>
      )}
    </div>
  );
}
