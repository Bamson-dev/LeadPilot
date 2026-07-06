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
  const short = result.short_credits;

  return (
    <div
      className="mb-4 flex items-start gap-3 rounded-xl border px-4 py-3.5"
      style={{
        background: "rgba(16,185,129,0.1)",
        borderColor: "rgba(16,185,129,0.3)",
      }}
      role="status"
      aria-live="polite"
    >
      <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-[#10B981]" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-[#F4F4FF]">
          {queued === 1 ? "1 email queued" : `${queued} emails queued`}
        </p>
        <p className="mt-1 text-sm text-[#A7F3D0]">
          Your outreach to {recipientCount} selected lead{recipientCount === 1 ? "" : "s"} is
          processing. Track delivery and opens in the sends report below.
        </p>
        {(skipped > 0 || short > 0) && (
          <p className="mt-2 text-xs text-[#6EE7B7]">
            {skipped > 0 && (
              <span>
                {skipped} skipped (suppressed)
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
        className="shrink-0 text-[#6EE7B7] hover:text-[#F4F4FF]"
        aria-label="Dismiss"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
