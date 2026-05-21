"use client";

import { CopyButton } from "@/components/dashboard/copy-button";
import { useCopyToClipboard } from "@/hooks/useCopyToClipboard";
import { getAllEmailsForDisplay } from "@/utils/get-display-email";
import type { Lead } from "@/types/lead";

interface EmailCellProps {
  lead: Lead;
  copiedId?: string | null;
  onCopy?: (text: string, id: string) => void;
}

export function EmailCell({ lead, copiedId: copiedIdProp, onCopy: onCopyProp }: EmailCellProps) {
  const internal = useCopyToClipboard();
  const copiedId = copiedIdProp ?? internal.copiedId;
  const onCopy = onCopyProp ?? internal.copyToClipboard;
  const emails = getAllEmailsForDisplay(lead);

  if (emails.length === 0) {
    return <span className="text-zinc-500">—</span>;
  }

  return (
    <div className="leading-relaxed break-words">
      {emails.map((addr, i) => (
        <div
          key={`${lead.id}-${addr}-${i}`}
          className="group flex items-center gap-1"
          style={{ marginBottom: i < emails.length - 1 ? 4 : 0 }}
        >
          <a
            href={`mailto:${addr}`}
            style={{
              color: "#F4F4FF",
              textDecoration: "none",
              fontSize: 12,
            }}
            className="hover:underline min-w-0 flex-1 truncate"
          >
            {addr}
          </a>
          <CopyButton
            value={addr}
            copyId={`email-${lead.id}-${i}`}
            copiedId={copiedId}
            onCopy={onCopy}
          />
        </div>
      ))}
    </div>
  );
}
