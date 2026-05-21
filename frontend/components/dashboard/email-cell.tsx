"use client";

import { getAllEmailsForDisplay } from "@/utils/get-display-email";
import type { Lead } from "@/types/lead";

interface EmailCellProps {
  lead: Lead;
}

export function EmailCell({ lead }: EmailCellProps) {
  const emails = getAllEmailsForDisplay(lead);

  if (emails.length === 0) {
    return <span className="text-zinc-500">—</span>;
  }

  return (
    <div className="leading-relaxed break-words">
      {emails.map((addr, i) => (
        <div key={addr} style={{ marginBottom: i < emails.length - 1 ? 4 : 0 }}>
          <a
            href={`mailto:${addr}`}
            className="text-[#F4F4FF] no-underline text-xs hover:underline"
          >
            {addr}
          </a>
        </div>
      ))}
    </div>
  );
}
