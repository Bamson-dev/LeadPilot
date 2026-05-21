"use client";

import { getAllEmailsForDisplay } from "@/utils/get-display-email";
import type { Lead } from "@/types/lead";

interface EmailCellProps {
  lead: Lead;
}

export function EmailCell({ lead }: EmailCellProps) {
  const emails = getAllEmailsForDisplay(lead);

  if (emails.length === 0) {
    return <span className="text-zinc-400">—</span>;
  }

  return (
    <div className="text-sm text-zinc-400 leading-relaxed break-words">
      {emails.map((addr) => (
        <span key={addr} className="block truncate">
          {addr}
        </span>
      ))}
    </div>
  );
}
