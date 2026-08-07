"use client";

import { useMemo, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Copy,
  ExternalLink,
  Globe,
  Loader2,
  Mail,
  MapPin,
  MoreHorizontal,
  Phone,
} from "lucide-react";
import { ContactDots } from "@/components/dashboard/contact-dots";
import { CopyButton } from "@/components/dashboard/copy-button";
import { EmailCell } from "@/components/dashboard/email-cell";
import { MobileLeadCard } from "@/components/dashboard/mobile-lead-card";
import { WebsiteLink } from "@/components/dashboard/website-link";
import { useCopyToClipboard } from "@/hooks/useCopyToClipboard";
import { LeadStatusSelect } from "@/components/dashboard/lead-status-select";
import { PipelineSummary } from "@/components/dashboard/pipeline-summary";
import { RatingFilter } from "@/components/dashboard/rating-filter";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  StatusBadge,
  type StatusBadgeStatus,
} from "@/components/ui/status-badge";
import type { RatingFilterValue } from "@/lib/rating-filter";
import { getLeadSelectionId } from "@/lib/lead-selection";
import type { Lead } from "@/types/lead";
import { cn } from "@/utils/utils";
import {
  getAllEmailsForDisplay,
  hasAnyEmail,
} from "@/utils/get-display-email";

type SortKey = keyof Pick<
  Lead,
  "business_name" | "phone" | "email" | "rating" | "reviews_count" | "category"
>;
type SortDir = "asc" | "desc";

const FILTER_SELECT_CLASS =
  "rounded-md border border-[var(--lt-border)] bg-[var(--lt-surface-2)] px-2.5 py-1.5 text-xs text-[var(--lt-text)] cursor-pointer outline-none appearance-none";

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

interface ResultsTableProps {
  leads: Lead[];
  isLoading: boolean;
  isMobile?: boolean;
  /** When true, parent renders welcome — skip empty placeholder */
  hideEmptyPlaceholder?: boolean;
  ratingFilter?: RatingFilterValue;
  onRatingFilterChange?: (value: RatingFilterValue) => void;
  totalLeadCount?: number;
  ratingMatchCount?: number;
  summaryLeads?: Lead[];
  leadStatuses: Record<string, string>;
  statusFilter: string;
  onStatusFilterChange: (value: string) => void;
  onLeadStatusChange: (leadId: string, status: string) => void;
  onUseTemplate?: (lead: Lead) => void;
  onMarkReplied?: (lead: Lead) => void;
  searchLocation?: string;
  emailScrapingInProgress?: boolean;
  /** When provided, renders the email selection checkbox column */
  selectedLeadIds?: Set<string>;
  onToggleLeadSelect?: (leadId: string) => void;
  onSendSelected?: () => void;
  hasMailbox?: boolean;
  onNoMailboxClick?: () => void;
  activeLeadId?: string | null;
  onLeadClick?: (lead: Lead) => void;
}

function stickySelectCellClass(isSelected: boolean, isActive: boolean) {
  return cn(
    "sticky left-0 z-20 shadow-[4px_0_12px_rgba(0,0,0,0.15)] transition-colors",
    isSelected
      ? "bg-[var(--lt-cyan-soft)] group-hover:bg-[var(--lt-cyan-soft)]"
      : isActive
        ? "bg-[var(--lt-surface)] group-hover:bg-[var(--lt-surface-3)]"
        : "bg-[var(--lt-surface)] group-hover:bg-[var(--lt-surface-3)]"
  );
}

export function ResultsTable({
  leads,
  isLoading,
  isMobile = false,
  hideEmptyPlaceholder = false,
  ratingFilter = "all",
  onRatingFilterChange,
  totalLeadCount,
  ratingMatchCount,
  summaryLeads,
  leadStatuses,
  statusFilter,
  onStatusFilterChange,
  onLeadStatusChange,
  onUseTemplate,
  onMarkReplied,
  emailScrapingInProgress = false,
  selectedLeadIds,
  onToggleLeadSelect,
  onSendSelected,
  hasMailbox = true,
  onNoMailboxClick,
  activeLeadId = null,
  onLeadClick,
}: ResultsTableProps) {
  const { copiedId, copyToClipboard } = useCopyToClipboard();
  const [sortKey, setSortKey] = useState<SortKey>("business_name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [hasWebsite, setHasWebsite] = useState<boolean | null>(null);
  const parentRef = useRef<HTMLDivElement>(null);

  const showEmailSelection = selectedLeadIds !== undefined;

  const filtered = useMemo(() => {
    return leads.filter((lead) => {
      if (hasWebsite === true && !lead.website) return false;
      if (hasWebsite === false && lead.website) return false;
      if (statusFilter !== "all") {
        const leadStatus = leadStatuses[lead.id] || "new";
        const normalized = leadStatus === "none" ? "new" : leadStatus;
        if (normalized !== statusFilter) return false;
      }
      return true;
    });
  }, [leads, hasWebsite, statusFilter, leadStatuses]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      const cmp =
        typeof av === "number" && typeof bv === "number"
          ? av - bv
          : String(av).localeCompare(String(bv));
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [filtered, sortKey, sortDir]);

  const useVirtual = !isMobile && sorted.length > 100;
  const rowVirtualizer = useVirtualizer({
    count: sorted.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 48,
    overscan: 8,
    enabled: useVirtual,
  });

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  const pipelineLeads = summaryLeads ?? leads;

  const selectableIds = useMemo(
    () =>
      sorted
        .filter((lead) => hasAnyEmail(lead))
        .map((lead) => getLeadSelectionId(lead)),
    [sorted]
  );

  const allSelectableSelected =
    selectableIds.length > 0 &&
    selectableIds.every((id) => selectedLeadIds?.has(id));

  function toggleSelectAll() {
    if (!onToggleLeadSelect || !selectedLeadIds) return;
    if (allSelectableSelected) {
      for (const id of selectableIds) {
        if (selectedLeadIds.has(id)) onToggleLeadSelect(id);
      }
    } else {
      for (const id of selectableIds) {
        if (!selectedLeadIds.has(id)) onToggleLeadSelect(id);
      }
    }
  }

  const emailableSelectedCount = useMemo(() => {
    if (!selectedLeadIds) return 0;
    return sorted.filter(
      (lead) =>
        selectedLeadIds.has(getLeadSelectionId(lead)) && hasAnyEmail(lead)
    ).length;
  }, [sorted, selectedLeadIds]);

  function handleSendClick() {
    if (emailableSelectedCount === 0) return;
    if (!hasMailbox) {
      onNoMailboxClick?.();
      return;
    }
    onSendSelected?.();
  }

  const statusFilterSelect = (
    <select
      value={statusFilter}
      onChange={(e) => onStatusFilterChange(e.target.value)}
      className={FILTER_SELECT_CLASS}
    >
      <option value="all">All statuses</option>
      <option value="new">New</option>
      <option value="contacted">Contacted</option>
      <option value="interested">Interested</option>
      <option value="closed">Closed</option>
      <option value="not_interested">Not interested</option>
    </select>
  );

  const websiteFilterSelect = (
    <select
      value={hasWebsite === null ? "all" : hasWebsite ? "yes" : "no"}
      onChange={(e) =>
        setHasWebsite(e.target.value === "all" ? null : e.target.value === "yes")
      }
      className={FILTER_SELECT_CLASS}
    >
      <option value="all">All websites</option>
      <option value="yes">Has website</option>
      <option value="no">No website</option>
    </select>
  );

  const sendToolbar = showEmailSelection && onSendSelected && (
    <div className="w-full rounded-xl border border-[var(--lt-cyan)]/30 bg-[var(--lt-cyan-soft)]/40 px-4 py-3 sm:flex-1 sm:min-w-[280px]">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-sm font-semibold text-[var(--lt-text)]">
            <Mail className="h-4 w-4 text-[var(--lt-cyan)]" />
            Send outreach email
          </p>
          <p className="mt-1 text-xs leading-relaxed text-[var(--lt-text-muted)]">
            {emailableSelectedCount === 0 ? (
              <>
                <strong className="text-[var(--lt-text)]">Step 1:</strong> Tick
                the{" "}
                <strong className="text-[var(--lt-text)]">Select</strong> boxes
                on the left ({selectableIds.length} leads have email).{" "}
                <strong className="text-[var(--lt-text)]">Step 2:</strong> Click
                Send email.
              </>
            ) : (
              <>
                {emailableSelectedCount} lead
                {emailableSelectedCount === 1 ? "" : "s"} selected — click Send
                email to compose your message.
              </>
            )}
          </p>
          {!hasMailbox && (
            <p className="mt-2 text-xs text-[var(--lt-cyan)]">
              Connect Gmail in Email outreach above first.{" "}
              {onNoMailboxClick && (
                <button
                  type="button"
                  onClick={onNoMailboxClick}
                  className="text-[var(--lt-text)] underline"
                >
                  Go to mailboxes
                </button>
              )}
            </p>
          )}
        </div>
        <Button
          type="button"
          variant={emailableSelectedCount > 0 ? "default" : "outline"}
          disabled={emailableSelectedCount === 0}
          onClick={handleSendClick}
          className="w-full shrink-0 sm:w-auto"
        >
          Send email ({emailableSelectedCount})
        </Button>
      </div>
    </div>
  );

  const filterBar = (
    <div className="sticky top-0 z-40 bg-[var(--lt-surface)]/95 backdrop-blur border-b border-[var(--lt-border)]">
      <PipelineSummary
        leads={pipelineLeads}
        leadStatuses={leadStatuses}
        statusFilter={statusFilter}
        onFilterChange={onStatusFilterChange}
      />
      <div className="flex flex-col gap-3 px-4 py-3 lg:flex-row lg:flex-wrap lg:items-stretch lg:gap-3">
        {sendToolbar}
        {onRatingFilterChange && (
          <RatingFilter
            value={ratingFilter}
            onChange={onRatingFilterChange}
            filteredCount={ratingMatchCount ?? sorted.length}
            totalCount={totalLeadCount ?? leads.length}
            isMobile={isMobile}
          />
        )}
        {websiteFilterSelect}
        {statusFilterSelect}
      </div>
    </div>
  );

  if (!isLoading && leads.length === 0 && !hideEmptyPlaceholder) {
    return null;
  }

  if (isMobile) {
    return (
      <div className="space-y-3">
        {filterBar}
        {isLoading && leads.length === 0 ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="rounded-xl border border-[var(--lt-border)] bg-[var(--lt-surface)] p-4"
              >
                <div className="skeleton mb-2 h-4 w-2/3 rounded" />
                <div className="skeleton h-3 w-1/2 rounded" />
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {sorted.map((lead) => (
              <MobileLeadCard
                key={lead.id}
                lead={lead}
                copiedId={copiedId}
                onCopy={copyToClipboard}
                status={leadStatuses[lead.id] || "new"}
                onStatusChange={onLeadStatusChange}
                selectable={showEmailSelection}
                selected={selectedLeadIds?.has(getLeadSelectionId(lead)) ?? false}
                canSelect={hasAnyEmail(lead)}
                onToggleSelect={
                  onToggleLeadSelect
                    ? () => {
                        if (hasAnyEmail(lead))
                          onToggleLeadSelect(getLeadSelectionId(lead));
                      }
                    : undefined
                }
                onUseTemplate={onUseTemplate}
                onOpen={onLeadClick ? () => onLeadClick(lead) : undefined}
                active={activeLeadId === lead.id}
              />
            ))}
          </div>
        )}
        <p className="px-1 text-xs text-[var(--lt-text-subtle)]">
          {sorted.length} leads shown
        </p>
      </div>
    );
  }

  const renderSkeletonRow = (i: number) => (
    <tr key={`skeleton-${i}`} className="h-12 border-b border-[var(--lt-border)]">
      {showEmailSelection && (
        <td className="px-3 py-2">
          <div className="skeleton mx-auto h-4 w-4 rounded-sm" />
        </td>
      )}
      <td className="px-3 py-2">
        <div className="skeleton h-3.5 w-32 rounded" />
      </td>
      <td className="px-3 py-2">
        <div className="skeleton h-3.5 w-24 rounded" />
      </td>
      <td className="px-3 py-2">
        <div className="skeleton h-3.5 w-20 rounded" />
      </td>
      <td className="px-3 py-2">
        <div className="skeleton h-3.5 w-28 rounded" />
      </td>
      <td className="px-3 py-2">
        <div className="skeleton h-3.5 w-16 rounded" />
      </td>
      <td className="px-3 py-2">
        <div className="skeleton h-3.5 w-10 rounded" />
      </td>
      <td className="px-3 py-2">
        <div className="skeleton h-3.5 w-20 rounded" />
      </td>
      <td className="px-3 py-2">
        <div className="skeleton h-3.5 w-8 rounded" />
      </td>
    </tr>
  );

  const renderRow = (lead: Lead) => {
    const selectionId = getLeadSelectionId(lead);
    const canSelect = hasAnyEmail(lead);
    const isSelected = selectedLeadIds?.has(selectionId) ?? false;
    const isActive = activeLeadId === lead.id;
    const leadStatus = leadStatuses[lead.id] || "new";
    const badgeProps = getStatusBadgeProps(leadStatus);
    const emails = getAllEmailsForDisplay(lead);
    const firstEmail = emails[0];
    const hasMoreMenu =
      Boolean(onUseTemplate) ||
      Boolean(onMarkReplied && hasAnyEmail(lead));
    const hasHoverActions =
      Boolean(firstEmail) ||
      Boolean(lead.phone) ||
      Boolean(lead.website) ||
      Boolean(lead.google_maps_url);

    return (
      <tr
        key={lead.id}
        className={cn(
          "group h-12 cursor-pointer border-b border-[var(--lt-border)] text-[13px] transition-colors",
          "hover:bg-[var(--lt-surface-3)]",
          isSelected && "bg-[var(--lt-cyan-soft)] hover:bg-[var(--lt-cyan-soft)]",
          isActive && "shadow-[inset_2px_0_0_var(--lt-cyan)]"
        )}
        onClick={() => onLeadClick?.(lead)}
      >
        {showEmailSelection && (
          <td
            className={cn(
              "w-[52px] min-w-[52px] px-3 py-2 align-middle",
              stickySelectCellClass(isSelected, isActive)
            )}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex flex-col items-center gap-1">
              <Checkbox
                checked={isSelected}
                disabled={!canSelect}
                onCheckedChange={() => onToggleLeadSelect?.(selectionId)}
                aria-label={
                  canSelect
                    ? `Select ${lead.business_name} for email`
                    : `${lead.business_name} has no email`
                }
              />
            </div>
          </td>
        )}
        <td className="px-3 py-2 align-middle">
          <div className="text-sm font-semibold text-[var(--lt-text)]">
            {lead.business_name}
          </div>
          {lead.category && (
            <div className="mt-0.5 text-[11px] text-[var(--lt-text-subtle)]">
              {lead.category}
            </div>
          )}
          <div className="mt-1">
            <ContactDots lead={lead} />
          </div>
        </td>
        <td className="max-w-[180px] truncate px-3 py-2 align-middle text-[var(--lt-text-muted)]">
          {lead.address ?? "—"}
        </td>
        <td className="px-3 py-2 align-middle" onClick={(e) => e.stopPropagation()}>
          {lead.phone ? (
            <div className="group/phone flex items-center gap-1">
              <a
                href={`tel:${lead.phone}`}
                className="text-[var(--lt-text)] hover:underline"
              >
                {lead.phone}
              </a>
              <CopyButton
                value={lead.phone}
                copyId={`phone-${lead.id}`}
                copiedId={copiedId}
                onCopy={copyToClipboard}
              />
            </div>
          ) : (
            <span className="text-[var(--lt-text-subtle)]">—</span>
          )}
        </td>
        <td
          className="min-w-[180px] px-3 py-2 align-middle"
          onClick={(e) => e.stopPropagation()}
        >
          <EmailCell lead={lead} copiedId={copiedId} onCopy={copyToClipboard} />
        </td>
        <td className="px-3 py-2 align-middle" onClick={(e) => e.stopPropagation()}>
          {lead.website ? (
            <WebsiteLink website={lead.website} />
          ) : (
            <span className="text-[var(--lt-text-subtle)]">—</span>
          )}
        </td>
        <td className="px-3 py-2 align-middle">
          {lead.rating != null ? (
            <span className="inline-flex items-center gap-1 text-[var(--lt-warning)]">
              <span aria-hidden>★</span>
              <span>{lead.rating}</span>
            </span>
          ) : (
            <span className="text-[var(--lt-text-subtle)]">—</span>
          )}
        </td>
        <td
          className="min-w-[160px] px-3 py-2 align-middle"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex flex-col gap-1.5">
            <StatusBadge status={badgeProps.status} label={badgeProps.label} />
            <LeadStatusSelect
              leadId={lead.id}
              status={leadStatus}
              onChange={onLeadStatusChange}
            />
            <div className="flex items-center gap-0.5">
              <div className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
              {firstEmail && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  title="Copy email"
                  onClick={() => copyToClipboard(firstEmail, `qa-email-${lead.id}`)}
                >
                  <Copy className="h-3.5 w-3.5" />
                </Button>
              )}
              {lead.phone && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  title="Copy phone"
                  onClick={() =>
                    copyToClipboard(lead.phone!, `qa-phone-${lead.id}`)
                  }
                >
                  <Phone className="h-3.5 w-3.5" />
                </Button>
              )}
              {lead.website && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  title="Open website"
                  asChild
                >
                  <a
                    href={lead.website}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Globe className="h-3.5 w-3.5" />
                  </a>
                </Button>
              )}
              {lead.google_maps_url && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  title="Open in Google Maps"
                  asChild
                >
                  <a
                    href={lead.google_maps_url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <MapPin className="h-3.5 w-3.5" />
                  </a>
                </Button>
              )}
              </div>
              {(hasMoreMenu || hasHoverActions) && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      title="More actions"
                    >
                      <MoreHorizontal className="h-3.5 w-3.5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {firstEmail && (
                      <DropdownMenuItem
                        onClick={() =>
                          copyToClipboard(firstEmail, `menu-email-${lead.id}`)
                        }
                      >
                        <Copy className="h-3.5 w-3.5" />
                        Copy email
                      </DropdownMenuItem>
                    )}
                    {lead.phone && (
                      <DropdownMenuItem
                        onClick={() =>
                          copyToClipboard(lead.phone!, `menu-phone-${lead.id}`)
                        }
                      >
                        <Phone className="h-3.5 w-3.5" />
                        Copy phone
                      </DropdownMenuItem>
                    )}
                    {lead.website && (
                      <DropdownMenuItem asChild>
                        <a
                          href={lead.website}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                          Open website
                        </a>
                      </DropdownMenuItem>
                    )}
                    {lead.google_maps_url && (
                      <DropdownMenuItem asChild>
                        <a
                          href={lead.google_maps_url}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <MapPin className="h-3.5 w-3.5" />
                          Open in Maps
                        </a>
                      </DropdownMenuItem>
                    )}
                    {onUseTemplate && (
                      <DropdownMenuItem onClick={() => onUseTemplate(lead)}>
                        WhatsApp template
                      </DropdownMenuItem>
                    )}
                    {onMarkReplied && hasAnyEmail(lead) && (
                      <DropdownMenuItem onClick={() => onMarkReplied(lead)}>
                        Mark replied
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          </div>
        </td>
        <td className="px-3 py-2 align-middle text-[var(--lt-text-muted)]">
          {lead.reviews_count ?? "—"}
        </td>
      </tr>
    );
  };

  return (
    <div className="overflow-hidden rounded-xl border border-[var(--lt-border)] bg-[var(--lt-surface)]">
      {filterBar}

      <div ref={parentRef} className="max-h-[600px] overflow-auto">
        <table className="w-full min-w-[900px] text-sm">
          <thead className="sticky top-0 z-30 bg-[var(--lt-surface)]/95 backdrop-blur">
            <tr className="border-b border-[var(--lt-border)]">
              {showEmailSelection && (
                <th
                  className={cn(
                    "sticky left-0 z-20 w-[52px] min-w-[52px] bg-[var(--lt-surface)] px-3 py-2.5 text-center shadow-[4px_0_12px_rgba(0,0,0,0.15)]"
                  )}
                >
                  <div className="flex flex-col items-center gap-1">
                    <Checkbox
                      checked={allSelectableSelected}
                      disabled={selectableIds.length === 0}
                      onCheckedChange={toggleSelectAll}
                      aria-label="Select all leads with email"
                    />
                    <span className="text-[9px] font-semibold uppercase tracking-wide text-[var(--lt-cyan)]">
                      Select
                    </span>
                  </div>
                </th>
              )}
              {(
                [
                  ["business_name", "Business"],
                  ["address", "Location"],
                  ["phone", "Phone"],
                  ["email", "Email"],
                  ["website", "Website"],
                  ["rating", "Rating"],
                  ["status", "Status / Actions"],
                  ["reviews_count", "Reviews"],
                ] as const
              ).map(([key, label]) => (
                <th
                  key={key}
                  className="px-3 py-2.5 text-left text-[11px] font-medium uppercase tracking-wider text-[var(--lt-text-subtle)]"
                >
                  {["business_name", "rating", "reviews_count"].includes(key) ? (
                    <button
                      type="button"
                      onClick={() => toggleSort(key as SortKey)}
                      className="inline-flex items-center gap-1 hover:text-[var(--lt-text)]"
                    >
                      {label}
                      {sortKey === key ? (
                        sortDir === "asc" ? (
                          <ArrowUp className="h-3 w-3" />
                        ) : (
                          <ArrowDown className="h-3 w-3" />
                        )
                      ) : (
                        <ArrowUpDown className="h-3 w-3 opacity-40" />
                      )}
                    </button>
                  ) : key === "email" ? (
                    <span className="inline-flex items-center gap-1.5">
                      {label}
                      {emailScrapingInProgress && (
                        <span title="Finding email addresses">
                          <Loader2 className="h-3 w-3 animate-spin text-[var(--lt-cyan)]" />
                        </span>
                      )}
                    </span>
                  ) : (
                    label
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading && leads.length === 0
              ? Array.from({ length: 5 }).map((_, i) => renderSkeletonRow(i))
              : useVirtual
                ? rowVirtualizer.getVirtualItems().map((virtualRow) => {
                    const lead = sorted[virtualRow.index];
                    return renderRow(lead);
                  })
                : sorted.map((lead) => renderRow(lead))}
          </tbody>
        </table>
      </div>
      <div className="border-t border-[var(--lt-border)] px-4 py-2 text-xs text-[var(--lt-text-subtle)]">
        {sorted.length} leads shown
      </div>
    </div>
  );
}

/** @internal exported for tests */
export function emailSelectionColumnVisible(selectedLeadIds?: Set<string>): boolean {
  return selectedLeadIds !== undefined;
}
