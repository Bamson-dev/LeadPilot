"use client";

import { CheckCircle2, X } from "lucide-react";
import type { QueueSendResponse } from "@/types/outreach";

interface OutreachSendSuccessBannerProps {
  result: QueueSendResponse;
  recipientCount: number;
  onDismiss: () => void;
}

export function OutreachSendSuccessBanner({
  result,
  recipientCount,
  onDismiss,
}: OutreachSendSuccessBannerProps) {
  const queued = result.queued;
  const skipped = result.skipped_suppression;
  const skippedNoVerified = result.skipped_no_verified_email;
  const short = result.short_credits;

  return (
    <div
      className="mb-4 flex items-start gap-3 rounded-xl border border-[var(--lt-success)]/30 bg-[var(--lt-success-soft)] px-4 py-3.5"
      role="status"
      aria-live="polite"
    >
      <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-[var(--lt-success)]" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-[var(--lt-text)]">
          {queued === 1 ? "1 email queued" : `${queued} emails queued`}
        </p>
        <p className="mt-1 text-sm text-[var(--lt-success)]">
          Your outreach to {recipientCount} selected lead{recipientCount === 1 ? "" : "s"} is
          processing. Track delivery and opens in the sends report below.
        </p>
        {(skipped > 0 || skippedNoVerified > 0 || short > 0) && (
          <p className="mt-2 text-xs text-[var(--lt-success)]/80">
            {skipped > 0 && (
              <span>
                {skipped} skipped (suppressed)
                {skippedNoVerified > 0 || short > 0 ? " · " : ""}
              </span>
            )}
            {skippedNoVerified > 0 && (
              <span>
                {skippedNoVerified} skipped (no verified email)
                {short > 0 ? " · " : ""}
              </span>
            )}
            {short > 0 && <span>{short} not sent (insufficient balance)</span>}
          </p>
        )}
      </div>
      <button
        type="button"
        onClick={onDismiss}
        className="shrink-0 text-[var(--lt-success)] hover:text-[var(--lt-text)]"
        aria-label="Dismiss"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
