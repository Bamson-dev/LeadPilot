"use client";

import { getPredictedEmails, getVerifiedEmails } from "@/utils/get-display-email";
import type { Lead } from "@/types/lead";

interface EmailCellProps {
  lead: Lead;
}

export function EmailCell({ lead }: EmailCellProps) {
  const verified = getVerifiedEmails(lead);
  const predicted = getPredictedEmails(lead).map((p) => p.email);
  const seen = new Set<string>();
  const emails: string[] = [];

  for (const addr of [...verified, ...predicted]) {
    const key = addr.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    emails.push(addr);
  }

  if (emails.length === 0) {
    return <span className="text-xs text-zinc-500">—</span>;
  }

  return (
    <div className="text-xs leading-relaxed break-words text-zinc-300">
      {emails.map((addr) => (
        <span key={addr} className="block truncate">
          {addr}
        </span>
      ))}
    </div>
  );
}
