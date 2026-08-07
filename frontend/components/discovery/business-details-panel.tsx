"use client";

import {
  Copy,
  ExternalLink,
  Globe,
  MapPin,
  Phone,
  Star,
  X,
} from "lucide-react";
import { toast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { StatusBadge } from "@/components/ui/status-badge";
import { cn } from "@/utils/utils";
import { getAllEmailsForDisplay, hasAnyEmail } from "@/utils/get-display-email";
import type { Lead } from "@/types/lead";
import type { StatusBadgeStatus } from "@/components/ui/status-badge";

function mapLeadStatus(status: string): { badge: StatusBadgeStatus; label: string } {
  switch (status) {
    case "contacted":
      return { badge: "processing", label: "Contacted" };
    case "interested":
      return { badge: "replied", label: "Interested" };
    case "closed":
      return { badge: "enriched", label: "Closed" };
    case "not_interested":
      return { badge: "paused", label: "Not interested" };
    default:
      return { badge: "paused", label: "New" };
  }
}

async function copyText(label: string, value: string) {
  try {
    await navigator.clipboard.writeText(value);
    toast.success(`${label} copied`);
  } catch {
    toast.error(`Could not copy ${label.toLowerCase()}`);
  }
}

export interface BusinessDetailsPanelProps {
  lead: Lead | null;
  status?: string;
  onClose: () => void;
  onSaveLead?: (lead: Lead) => void;
  onAddToOutreach?: (lead: Lead) => void;
  onGenerateOutreach?: (lead: Lead) => void;
  className?: string;
}

export function BusinessDetailsPanel({
  lead,
  status = "new",
  onClose,
  onSaveLead,
  onAddToOutreach,
  onGenerateOutreach,
  className,
}: BusinessDetailsPanelProps) {
  if (!lead) {
    return (
      <aside
        className={cn(
          "flex h-full min-h-[320px] flex-col items-center justify-center rounded-xl border border-[var(--lt-border)] bg-[var(--lt-surface)] p-6 text-center",
          className
        )}
        aria-label="Business details"
      >
        <p className="text-sm font-medium text-[var(--lt-text)]">No business selected</p>
        <p className="mt-1 max-w-[220px] text-xs text-[var(--lt-text-muted)]">
          Select a row to view contact details and actions.
        </p>
      </aside>
    );
  }

  const emails = getAllEmailsForDisplay(lead);
  const primaryEmail = emails[0] || null;
  const statusMeta = mapLeadStatus(status);
  const mapsUrl = lead.google_maps_url?.trim() || null;
  const website = lead.website?.trim() || null;

  return (
    <aside
      className={cn(
        "flex h-full flex-col overflow-hidden rounded-xl border border-[var(--lt-border)] bg-[var(--lt-surface)]",
        className
      )}
      aria-label={`Details for ${lead.business_name}`}
    >
      <div className="flex items-start justify-between gap-3 border-b border-[var(--lt-border)] p-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="truncate text-lg font-semibold text-[var(--lt-text)]">
              {lead.business_name}
            </h2>
            {hasAnyEmail(lead) ? (
              <Badge variant="success">Verified contact</Badge>
            ) : null}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <StatusBadge status={statusMeta.badge} label={statusMeta.label} />
            {lead.rating != null ? (
              <span className="inline-flex items-center gap-1 text-xs text-[var(--lt-warning)]">
                <Star className="h-3.5 w-3.5 fill-current" />
                {lead.rating}
                {lead.reviews_count != null ? (
                  <span className="text-[var(--lt-text-subtle)]">
                    ({lead.reviews_count.toLocaleString()} reviews)
                  </span>
                ) : null}
              </span>
            ) : null}
          </div>
          {lead.category ? (
            <p className="mt-2 text-sm text-[var(--lt-text-muted)]">{lead.category}</p>
          ) : null}
        </div>
        <Button type="button" variant="ghost" size="icon" onClick={onClose} aria-label="Close details">
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        <section className="space-y-3">
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-[var(--lt-text-subtle)]">
            Contact
          </h3>
          <DetailRow
            icon={<MapPin className="h-3.5 w-3.5" />}
            label="Address"
            value={lead.address}
            onCopy={lead.address ? () => void copyText("Address", lead.address!) : undefined}
          />
          <DetailRow
            icon={<Phone className="h-3.5 w-3.5" />}
            label="Phone"
            value={lead.phone}
            href={lead.phone ? `tel:${lead.phone}` : undefined}
            onCopy={lead.phone ? () => void copyText("Phone", lead.phone!) : undefined}
          />
          <DetailRow
            icon={<Globe className="h-3.5 w-3.5" />}
            label="Email"
            value={primaryEmail}
            href={primaryEmail ? `mailto:${primaryEmail}` : undefined}
            onCopy={primaryEmail ? () => void copyText("Email", primaryEmail) : undefined}
          />
          {emails.length > 1 ? (
            <p className="pl-6 text-xs text-[var(--lt-text-subtle)]">
              +{emails.length - 1} more email{emails.length - 1 === 1 ? "" : "s"}
            </p>
          ) : null}
          <DetailRow
            icon={<ExternalLink className="h-3.5 w-3.5" />}
            label="Website"
            value={website}
            href={website || undefined}
            external
            onCopy={website ? () => void copyText("Website", website) : undefined}
          />
        </section>

        <Separator />

        <section className="space-y-3">
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-[var(--lt-text-subtle)]">
            Business
          </h3>
          <DetailRow label="Category" value={lead.category} />
          <DetailRow
            label="Opening hours"
            value={null}
            emptyLabel="Not available from this search"
          />
          <DetailRow
            label="Google Maps"
            value={mapsUrl ? "Open in Maps" : null}
            href={mapsUrl || undefined}
            external
          />
          <DetailRow
            label="Reviews"
            value={
              lead.reviews_count != null
                ? `${lead.reviews_count.toLocaleString()} reviews`
                : null
            }
          />
        </section>

        <Separator />

        <section>
          <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-[var(--lt-text-subtle)]">
            Quick actions
          </h3>
          <div className="grid grid-cols-2 gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!website}
              onClick={() => website && window.open(website, "_blank", "noopener,noreferrer")}
            >
              Open website
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!mapsUrl}
              onClick={() => mapsUrl && window.open(mapsUrl, "_blank", "noopener,noreferrer")}
            >
              Open maps
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!lead.phone}
              onClick={() => lead.phone && (window.location.href = `tel:${lead.phone}`)}
            >
              Call
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!primaryEmail}
              onClick={() => primaryEmail && void copyText("Email", primaryEmail)}
            >
              Copy email
            </Button>
          </div>
        </section>
      </div>

      <div className="space-y-2 border-t border-[var(--lt-border)] p-4">
        <Button
          type="button"
          variant="default"
          className="w-full"
          onClick={() => onAddToOutreach?.(lead)}
          disabled={!hasAnyEmail(lead)}
        >
          Add to Outreach
        </Button>
        <div className="grid grid-cols-2 gap-2">
          <Button type="button" variant="outline" onClick={() => onSaveLead?.(lead)}>
            Save Lead
          </Button>
          <Button
            type="button"
            variant="soft"
            onClick={() => onGenerateOutreach?.(lead)}
            disabled={!hasAnyEmail(lead) && !onGenerateOutreach}
          >
            Generate Outreach
          </Button>
        </div>
      </div>
    </aside>
  );
}

function DetailRow({
  icon,
  label,
  value,
  href,
  external,
  onCopy,
  emptyLabel = "—",
}: {
  icon?: React.ReactNode;
  label: string;
  value: string | null | undefined;
  href?: string;
  external?: boolean;
  onCopy?: () => void;
  emptyLabel?: string;
}) {
  const display = value?.trim() || null;

  return (
    <div className="flex items-start gap-2">
      {icon ? (
        <span className="mt-0.5 text-[var(--lt-text-subtle)]">{icon}</span>
      ) : (
        <span className="w-3.5" />
      )}
      <div className="min-w-0 flex-1">
        <p className="text-[11px] text-[var(--lt-text-subtle)]">{label}</p>
        {display && href ? (
          <a
            href={href}
            target={external ? "_blank" : undefined}
            rel={external ? "noreferrer" : undefined}
            className="break-all text-sm text-[var(--lt-cyan)] hover:underline"
          >
            {display}
          </a>
        ) : (
          <p
            className={cn(
              "break-words text-sm",
              display ? "text-[var(--lt-text)]" : "text-[var(--lt-text-subtle)]"
            )}
          >
            {display || emptyLabel}
          </p>
        )}
      </div>
      {onCopy && display ? (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7 shrink-0"
          onClick={onCopy}
          aria-label={`Copy ${label}`}
        >
          <Copy className="h-3.5 w-3.5" />
        </Button>
      ) : null}
    </div>
  );
}
