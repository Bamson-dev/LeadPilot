"use client";

import { CopyButton } from "@/components/dashboard/copy-button";
import { LeadStatusSelect } from "@/components/dashboard/lead-status-select";
import { WebsiteLink } from "@/components/dashboard/website-link";
import { Checkbox } from "@/components/ui/checkbox";
import { StatusBadge, type StatusBadgeStatus } from "@/components/ui/status-badge";
import { cn } from "@/utils/utils";
import { getAllEmailsForDisplay } from "@/utils/get-display-email";
import type { Lead } from "@/types/lead";

function getStatusBadgeProps(
  status: string
): { status: StatusBadgeStatus; label: string } {
  const normalized = status === "none" ? "new" : status;
  switch (normalized) {
    case "contacted":
      return { status: "processing", label: "Contacted" };
    case "interested":
      return { status: "replied", label: "Interested" };
    case "closed":
      return { status: "enriched", label: "Closed" };
    case "not_interested":
      return { status: "paused", label: "Not interested" };
    default:
      return { status: "paused", label: "New" };
  }
}

interface MobileLeadCardProps {
  lead: Lead;
  copiedId: string | null;
  onCopy: (text: string, id: string) => void;
  status?: string;
  onStatusChange?: (leadId: string, status: string) => void;
  onUseTemplate?: (lead: Lead) => void;
  selectable?: boolean;
  selected?: boolean;
  canSelect?: boolean;
  onToggleSelect?: () => void;
  onOpen?: () => void;
  active?: boolean;
}

export function MobileLeadCard({
  lead,
  copiedId,
  onCopy,
  status = "new",
  onStatusChange,
  onUseTemplate,
  selectable = false,
  selected = false,
  canSelect = true,
  onToggleSelect,
  onOpen,
  active = false,
}: MobileLeadCardProps) {
  const emails = getAllEmailsForDisplay(lead);
  const isPredicted = lead.email_source === "predicted";
  const badgeProps = getStatusBadgeProps(status);

  const cardClassName = cn(
    "rounded-xl border p-4 transition-colors",
    selected
      ? "border-[var(--lt-cyan)]/40 bg-[var(--lt-cyan-soft)]"
      : "border-[var(--lt-border)] bg-[var(--lt-surface)]",
    active && "shadow-[inset_2px_0_0_var(--lt-cyan)]",
    onOpen && "cursor-pointer hover:bg-[var(--lt-surface-3)]"
  );

  const inner = (
    <>
      <div className="mb-2.5 flex items-start gap-2.5">
        {selectable && (
          <div
            className="flex shrink-0 flex-col items-center gap-1"
            onClick={(e) => e.stopPropagation()}
          >
            <Checkbox
              checked={selected}
              disabled={!canSelect}
              onCheckedChange={onToggleSelect}
              aria-label={`Select ${lead.business_name} for email`}
            />
            <span className="text-[9px] font-semibold uppercase tracking-wide text-[var(--lt-cyan)]">
              Select
            </span>
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="text-[15px] font-semibold text-[var(--lt-text)]">
            {lead.business_name}
          </div>
          {lead.category && (
            <div className="text-xs text-[var(--lt-text-subtle)]">
              {lead.category}
            </div>
          )}
        </div>
        <StatusBadge status={badgeProps.status} label={badgeProps.label} />
      </div>

      {lead.rating != null && (
        <div className="mb-3 inline-flex items-center gap-1 rounded-full border border-[var(--lt-warning)]/30 bg-[var(--lt-warning)]/10 px-2 py-0.5">
          <span className="text-xs text-[var(--lt-warning)]" aria-hidden>
            ★
          </span>
          <span className="text-xs font-semibold text-[var(--lt-warning)]">
            {lead.rating}
          </span>
          {lead.reviews_count != null && (
            <span className="text-[11px] text-[var(--lt-text-subtle)]">
              ({lead.reviews_count.toLocaleString()})
            </span>
          )}
        </div>
      )}

      {lead.address && (
        <div className="mb-2 flex items-start gap-2">
          <span className="shrink-0 text-xs text-[var(--lt-text-subtle)]">
            📍
          </span>
          <span className="text-xs leading-relaxed text-[var(--lt-text-muted)]">
            {lead.address}
          </span>
        </div>
      )}

      {lead.phone && (
        <div
          className="mb-2 flex items-center gap-2"
          onClick={(e) => e.stopPropagation()}
        >
          <span className="text-xs text-[var(--lt-text-subtle)]">📞</span>
          <a
            href={`tel:${lead.phone}`}
            className="flex-1 text-[13px] font-semibold text-[var(--lt-text)] no-underline"
          >
            {lead.phone}
          </a>
          <CopyButton
            value={lead.phone}
            copyId={`phone-${lead.id}`}
            copiedId={copiedId}
            onCopy={onCopy}
            alwaysVisible
            variant="pill"
          />
        </div>
      )}

      {emails.length > 0 && (
        <div className="mb-2" onClick={(e) => e.stopPropagation()}>
          {emails.map((email, ei) => (
            <div
              key={`${lead.id}-email-${ei}`}
              className="mb-1 flex items-center gap-2"
            >
              <span className="text-xs text-[var(--lt-text-subtle)]">✉️</span>
              {isPredicted && (
                <div
                  aria-hidden
                  className="h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--lt-cyan)]"
                />
              )}
              <a
                href={`mailto:${email}`}
                className="flex-1 break-all text-xs text-[var(--lt-text)] no-underline"
              >
                {email}
              </a>
              <CopyButton
                value={email}
                copyId={`email-${lead.id}-${ei}`}
                copiedId={copiedId}
                onCopy={onCopy}
                alwaysVisible
                variant="pill"
              />
            </div>
          ))}
        </div>
      )}

      {lead.website && (
        <div
          className="flex items-center gap-2"
          onClick={(e) => e.stopPropagation()}
        >
          <span className="text-xs text-[var(--lt-text-subtle)]">🌐</span>
          <WebsiteLink website={lead.website} maxLength={30} />
        </div>
      )}

      {onStatusChange && (
        <div
          className="mt-2.5 flex flex-col gap-2"
          onClick={(e) => e.stopPropagation()}
        >
          <LeadStatusSelect
            leadId={lead.id}
            status={status}
            onChange={onStatusChange}
            fullWidth
          />
          {onUseTemplate && (
            <button
              type="button"
              onClick={() => onUseTemplate(lead)}
              className="w-full cursor-pointer rounded-lg border border-[var(--lt-success)]/30 bg-[var(--lt-success)]/10 px-3 py-2.5 text-xs font-bold text-[var(--lt-success)]"
            >
              WhatsApp template
            </button>
          )}
        </div>
      )}
    </>
  );

  if (onOpen) {
    return (
      <button type="button" className={cn(cardClassName, "w-full text-left")} onClick={onOpen}>
        {inner}
      </button>
    );
  }

  return <div className={cardClassName}>{inner}</div>;
}
