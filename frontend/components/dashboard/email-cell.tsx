"use client";

import { getAllEmailsForDisplay } from "@/utils/get-display-email";
import type { Lead } from "@/types/lead";

interface EmailCellProps {
  lead: Lead;
}

export function EmailCell({ lead }: EmailCellProps) {
  const emails = getAllEmailsForDisplay(lead);

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
