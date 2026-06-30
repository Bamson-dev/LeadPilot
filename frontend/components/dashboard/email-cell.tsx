"use client";

import { CopyButton } from "@/components/dashboard/copy-button";
import { useCopyToClipboard } from "@/hooks/useCopyToClipboard";
import { getPredictedEmails, getVerifiedEmails } from "@/utils/get-display-email";
import type { Lead } from "@/types/lead";

interface EmailCellProps {
  lead: Lead;
  copiedId?: string | null;
  onCopy?: (text: string, id: string) => void;
}

function EmailRow({
  addr,
  leadId,
  index,
  variant,
  copiedId,
  onCopy,
}: {
  addr: string;
  leadId: string;
  index: number;
  variant: "verified" | "predicted";
  copiedId: string | null;
  onCopy: (text: string, id: string) => void;
}) {
  const isVerified = variant === "verified";

  return (
    <div
      className="group flex items-center gap-1.5"
      style={{ marginBottom: 4 }}
    >
      <div
        aria-hidden
        title={isVerified ? "Verified from website" : "Predicted from domain"}
        style={{
          width: 6,
          height: 6,
          borderRadius: "50%",
          background: isVerified ? "#22C55E" : "#6B7280",
          flexShrink: 0,
        }}
      />
      <a
        href={`mailto:${addr}`}
        style={{
          color: isVerified ? "#F4F4FF" : "#A1A1B5",
          textDecoration: "none",
          fontSize: 12,
        }}
        className="hover:underline min-w-0 flex-1 truncate"
      >
        {addr}
      </a>
      {!isVerified && (
        <span
          className="shrink-0 rounded px-1 py-0.5 text-[10px] uppercase tracking-wide"
          style={{
            color: "#9CA3AF",
            background: "rgba(255,255,255,0.06)",
          }}
        >
          predicted
        </span>
      )}
      <CopyButton
        value={addr}
        copyId={`email-${leadId}-${variant}-${index}`}
        copiedId={copiedId}
        onCopy={onCopy}
      />
    </div>
  );
}

export function EmailCell({ lead, copiedId: copiedIdProp, onCopy: onCopyProp }: EmailCellProps) {
  const internal = useCopyToClipboard();
  const copiedId = copiedIdProp ?? internal.copiedId;
  const onCopy = onCopyProp ?? internal.copyToClipboard;

  const verified = getVerifiedEmails(lead);
  const predicted = getPredictedEmails(lead).map((p) => p.email);
  const seen = new Set<string>();
  const verifiedUnique = verified.filter((addr) => {
    const key = addr.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  const predictedUnique = predicted.filter((addr) => {
    const key = addr.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  if (verifiedUnique.length === 0 && predictedUnique.length === 0) {
    return <span className="text-zinc-500">—</span>;
  }

  return (
    <div className="leading-relaxed break-words">
      {verifiedUnique.map((addr, i) => (
        <EmailRow
          key={`${lead.id}-verified-${addr}-${i}`}
          addr={addr}
          leadId={lead.id}
          index={i}
          variant="verified"
          copiedId={copiedId}
          onCopy={onCopy}
        />
      ))}
      {predictedUnique.map((addr, i) => (
        <EmailRow
          key={`${lead.id}-predicted-${addr}-${i}`}
          addr={addr}
          leadId={lead.id}
          index={i}
          variant="predicted"
          copiedId={copiedId}
          onCopy={onCopy}
        />
      ))}
    </div>
  );
}
