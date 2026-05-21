"use client";

import type { PredictedEmail } from "@leadpilot/shared";
import { getPredictedEmails, getVerifiedEmails } from "@/utils/get-display-email";
import type { Lead } from "@/types/lead";

interface EmailCellProps {
  lead: Lead;
}

function VerifiedBlock({ emails }: { emails: string[] }) {
  return (
    <div className="space-y-0.5">
      {emails.map((addr) => (
        <span key={addr} className="block truncate text-emerald-300">
          {addr}
        </span>
      ))}
      <span className="mt-0.5 block text-[10px] uppercase tracking-wide text-emerald-500/60">
        Verified
      </span>
    </div>
  );
}

function PredictedBlock({ predictions }: { predictions: PredictedEmail[] }) {
  return (
    <div className="space-y-2">
      {predictions.map((p) => (
        <div key={p.email}>
          <span className="block truncate text-amber-300/90">{p.email}</span>
          <span className="mt-0.5 block text-[10px] uppercase tracking-wide text-amber-500/70">
            Predicted · {p.confidence}% confidence
          </span>
        </div>
      ))}
    </div>
  );
}

export function EmailCell({ lead }: EmailCellProps) {
  const verified = getVerifiedEmails(lead);
  const predicted = getPredictedEmails(lead);

  if (verified.length === 0 && predicted.length === 0) {
    return <span className="text-xs text-zinc-500">—</span>;
  }

  return (
    <div className="text-xs leading-relaxed break-words space-y-2">
      {verified.length > 0 && <VerifiedBlock emails={verified} />}
      {predicted.length > 0 && <PredictedBlock predictions={predicted} />}
    </div>
  );
}
