"use client";

import { CopyButton } from "@/components/dashboard/copy-button";
import { useCopyToClipboard } from "@/hooks/useCopyToClipboard";
import { getPredictedEmails, getVerifiedEmails } from "@/utils/get-display-email";
import { resolveEmailCellFallback } from "@/utils/email-cell-fallback";
import type { Lead } from "@/types/lead";
import type { PredictedEmail } from "@leadthur/shared";

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
  confidence,
  copiedId,
  onCopy,
}: {
  addr: string;
  leadId: string;
  index: number;
  variant: "verified" | "predicted";
  confidence?: number;
  copiedId: string | null;
  onCopy: (text: string, id: string) => void;
}) {
  const isVerified = variant === "verified";
  const confidenceLabel =
    !isVerified && confidence != null && confidence > 0
      ? `Predicted · ${confidence}% confidence`
      : isVerified
        ? "Verified from website or Google Maps"
        : "Predicted from domain";

  return (
    <div className="group mb-1 flex items-center gap-1.5">
      <div
        aria-hidden
        title={confidenceLabel}
        className={[
          "h-1.5 w-1.5 shrink-0 rounded-full",
          isVerified ? "bg-[var(--lt-success)]" : "bg-[var(--lt-text-subtle)]",
        ].join(" ")}
      />
      <a
        href={`mailto:${addr}`}
        title={confidenceLabel}
        className={[
          "min-w-0 flex-1 truncate text-xs no-underline hover:underline",
          isVerified ? "text-[var(--lt-text)]" : "text-[var(--lt-text-muted)]",
        ].join(" ")}
      >
        {addr}
      </a>
      {!isVerified && (
        <span
          className="shrink-0 rounded bg-[var(--lt-surface-3)] px-1 py-0.5 text-[10px] tracking-wide text-[var(--lt-text-subtle)]"
          title={confidenceLabel}
        >
          {confidence != null && confidence > 0
            ? `predicted · ${confidence}%`
            : "predicted"}
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

function PlatformFallback({
  primary,
  secondary,
}: {
  primary: string;
  secondary: string;
}) {
  return (
    <div className="leading-snug">
      <p className="m-0 text-[11px] text-[var(--lt-text-muted)]">{primary}</p>
      <p className="m-0 mt-0.5 text-[10px] text-[var(--lt-text-subtle)]">{secondary}</p>
    </div>
  );
}

export function EmailCell({ lead, copiedId: copiedIdProp, onCopy: onCopyProp }: EmailCellProps) {
  const internal = useCopyToClipboard();
  const copiedId = copiedIdProp ?? internal.copiedId;
  const onCopy = onCopyProp ?? internal.copyToClipboard;

  const verified = getVerifiedEmails(lead);
  const predicted: PredictedEmail[] = getPredictedEmails(lead);
  const seen = new Set<string>();
  const verifiedUnique = verified.filter((addr) => {
    const key = addr.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  const predictedUnique = predicted.filter((p) => {
    const key = p.email.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  if (verifiedUnique.length === 0 && predictedUnique.length === 0) {
    const fallback = resolveEmailCellFallback(lead);
    if (fallback.kind === "whatsapp") {
      return (
        <a
          href={fallback.href}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block text-[11px] leading-snug text-[var(--lt-success)] hover:underline"
          title="Open WhatsApp chat with this business"
        >
          {fallback.label}
        </a>
      );
    }
    if (fallback.kind === "platform") {
      return (
        <PlatformFallback primary={fallback.primary} secondary={fallback.secondary} />
      );
    }
    return <span className="text-[var(--lt-text-subtle)]">—</span>;
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
      {predictedUnique.map((prediction, i) => (
        <EmailRow
          key={`${lead.id}-predicted-${prediction.email}-${i}`}
          addr={prediction.email}
          leadId={lead.id}
          index={i}
          variant="predicted"
          confidence={prediction.confidence}
          copiedId={copiedId}
          onCopy={onCopy}
        />
      ))}
    </div>
  );
}
