"use client";

import { useMemo, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowDown, ArrowUp, ArrowUpDown, Check, Loader2, Mail } from "lucide-react";
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
import type { RatingFilterValue } from "@/lib/rating-filter";
import { getLeadSelectionId } from "@/lib/lead-selection";
import type { Lead } from "@/types/lead";
import { hasAnyEmail } from "@/utils/get-display-email";

type SortKey = keyof Pick<
  Lead,
  "business_name" | "phone" | "email" | "rating" | "reviews_count" | "category"
>;
type SortDir = "asc" | "desc";

const STICKY_SELECT_CLASS =
  "sticky left-0 z-20 bg-[#0F0F14] shadow-[4px_0_12px_rgba(0,0,0,0.35)]";

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
}

function SelectToggle({
  checked,
  disabled,
  onChange,
  label,
}: {
  checked: boolean;
  disabled?: boolean;
  onChange: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        if (!disabled) onChange();
      }}
      disabled={disabled}
      aria-label={label}
      aria-pressed={checked}
      className="flex h-6 w-6 items-center justify-center rounded-md border-2 transition-colors disabled:cursor-not-allowed disabled:opacity-35"
      style={{
        borderColor: checked ? "#A855F7" : "rgba(168,85,247,0.45)",
        background: checked ? "rgba(124,58,237,0.85)" : "rgba(22,22,30,0.95)",
      }}
    >
      {checked ? <Check className="h-3.5 w-3.5 text-white" strokeWidth={3} /> : null}
    </button>
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
}: ResultsTableProps) {
  const { copiedId, copyToClipboard } = useCopyToClipboard();
  const [sortKey, setSortKey] = useState<SortKey>("business_name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [hasWebsite, setHasWebsite] = useState<boolean | null>(null);
  const parentRef = useRef<HTMLDivElement>(null);

  /** Selection column shows whenever parent passes selectedLeadIds (email outreach mode). */
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
    estimateSize: () => 52,
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
      (lead) => selectedLeadIds.has(getLeadSelectionId(lead)) && hasAnyEmail(lead)
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

  const sendToolbar = showEmailSelection && onSendSelected && (
    <div
      className="w-full rounded-xl border px-4 py-3 sm:flex-1 sm:min-w-[280px]"
      style={{
        borderColor: "rgba(124,58,237,0.35)",
        background: "rgba(124,58,237,0.08)",
      }}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-sm font-semibold text-[#F4F4FF]">
            <Mail className="h-4 w-4 text-[#A855F7]" />
            Send outreach email
          </p>
          <p className="mt-1 text-xs text-[#A1A1B5] leading-relaxed">
            {emailableSelectedCount === 0 ? (
              <>
                <strong className="text-[#F4F4FF]">Step 1:</strong> Tick the purple{" "}
                <strong className="text-[#F4F4FF]">Select</strong> boxes on the left (
                {selectableIds.length} leads have email).{" "}
                <strong className="text-[#F4F4FF]">Step 2:</strong> Click Send email.
              </>
            ) : (
              <>
                {emailableSelectedCount} lead{emailableSelectedCount === 1 ? "" : "s"} selected
                — click Send email to compose your message.
              </>
            )}
          </p>
          {!hasMailbox && (
            <p className="mt-2 text-xs text-[#A855F7]">
              Connect Gmail in Email outreach above first.{" "}
              {onNoMailboxClick && (
                <button type="button" onClick={onNoMailboxClick} className="underline text-[#F4F4FF]">
                  Go to mailboxes
                </button>
              )}
            </p>
          )}
        </div>
        <Button
          type="button"
          variant={emailableSelectedCount > 0 ? "glow" : "outline"}
          disabled={emailableSelectedCount === 0}
          onClick={handleSendClick}
          className="shrink-0 w-full sm:w-auto"
        >
          Send email ({emailableSelectedCount})
        </Button>
      </div>
    </div>
  );

  if (!isLoading && leads.length === 0 && !hideEmptyPlaceholder) {
    return null;
  }

  if (isMobile) {
    return (
      <div className="space-y-3">
        <PipelineSummary
          leads={pipelineLeads}
          leadStatuses={leadStatuses}
          statusFilter={statusFilter}
          onFilterChange={onStatusFilterChange}
        />
        {sendToolbar}
        <div className="flex flex-wrap gap-2 px-1">
          {onRatingFilterChange && (
            <RatingFilter
              value={ratingFilter}
              onChange={onRatingFilterChange}
              filteredCount={ratingMatchCount ?? sorted.length}
              totalCount={totalLeadCount ?? leads.length}
              isMobile
            />
          )}
          <select
            value={hasWebsite === null ? "all" : hasWebsite ? "yes" : "no"}
            onChange={(e) =>
              setHasWebsite(e.target.value === "all" ? null : e.target.value === "yes")
            }
            className="rounded-md border border-white/10 bg-[#16161E] px-2 py-1 text-xs text-[#F4F4FF]"
          >
            <option value="all">All websites</option>
            <option value="yes">Has website</option>
            <option value="no">No website</option>
          </select>
          <select
            value={statusFilter}
            onChange={(e) => onStatusFilterChange(e.target.value)}
            style={{
              background: "#111118",
              border: "1px solid rgba(255,255,255,0.08)",
              color: "#F0EFFF",
              borderRadius: 8,
              padding: "7px 12px",
              fontSize: 12,
              cursor: "pointer",
              fontFamily: "Inter, sans-serif",
              outline: "none",
              appearance: "none",
              WebkitAppearance: "none",
            }}
          >
            <option value="all">All statuses</option>
            <option value="new">New</option>
            <option value="contacted">Contacted</option>
            <option value="interested">Interested</option>
            <option value="closed">Closed</option>
            <option value="not_interested">Not interested</option>
          </select>
        </div>

        {isLoading && leads.length === 0 ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="rounded-xl border border-white/[0.07] bg-[#0F0F14] p-4"
              >
                <div className="skeleton h-4 w-2/3 rounded mb-2" />
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
                        if (hasAnyEmail(lead)) onToggleLeadSelect(getLeadSelectionId(lead));
                      }
                    : undefined
                }
                onUseTemplate={onUseTemplate}
              />
            ))}
          </div>
        )}

        <p className="text-xs text-[#6B6B80] px-1">{sorted.length} leads shown</p>
      </div>
    );
  }

  const renderRow = (lead: Lead) => {
    const selectionId = getLeadSelectionId(lead);
    const canSelect = hasAnyEmail(lead);
    const isSelected = selectedLeadIds?.has(selectionId) ?? false;

    return (
      <motion.tr
        key={lead.id}
        initial={{ opacity: 0, backgroundColor: "rgba(124,58,237,0.12)" }}
        animate={{ opacity: 1, backgroundColor: "transparent" }}
        transition={{ duration: 0.35 }}
        className="border-b border-white/[0.04] transition-all duration-200"
        style={{ borderColor: "rgba(255,255,255,0.07)" }}
        onMouseOver={(e) => {
          e.currentTarget.style.background = "rgba(124,58,237,0.04)";
        }}
        onMouseOut={(e) => {
          e.currentTarget.style.background = "transparent";
        }}
      >
        {showEmailSelection && (
          <td className={`px-3 py-3 align-middle w-[56px] min-w-[56px] ${STICKY_SELECT_CLASS}`}>
            <SelectToggle
              checked={isSelected}
              disabled={!canSelect}
              onChange={() => onToggleLeadSelect?.(selectionId)}
              label={
                canSelect
                  ? `Select ${lead.business_name} for email`
                  : `${lead.business_name} has no email`
              }
            />
          </td>
        )}
        <td className="px-4 py-3 align-top" style={{ padding: "12px 8px" }}>
          <div
            style={{
              color: "#F4F4FF",
              fontWeight: 700,
              fontSize: 13,
              fontFamily: "Bricolage Grotesque, sans-serif",
              lineHeight: 1.3,
            }}
          >
            {lead.business_name}
          </div>
          {lead.category && (
            <div style={{ color: "#6B6B80", fontSize: 11, marginTop: 2 }}>
              {lead.category}
            </div>
          )}
          <div className="mt-1.5">
            <ContactDots lead={lead} />
          </div>
        </td>
        <td className="px-4 py-3 text-[#6B6B80] max-w-[180px] truncate align-top">
          {lead.address ?? "—"}
        </td>
        <td className="px-4 py-3 align-top">
          {lead.phone ? (
            <div className="group flex items-center gap-1">
              <a
                href={`tel:${lead.phone}`}
                style={{
                  color: "#F4F4FF",
                  textDecoration: "none",
                  fontSize: 12,
                }}
                className="hover:underline"
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
            "—"
          )}
        </td>
        <td className="px-4 py-3 min-w-[200px] align-top">
          <EmailCell lead={lead} copiedId={copiedId} onCopy={copyToClipboard} />
        </td>
        <td className="px-4 py-3 align-top">
          {lead.website ? <WebsiteLink website={lead.website} /> : "—"}
        </td>
        <td className="px-4 py-3 text-amber-400 align-top">
          {lead.rating != null ? `★ ${lead.rating}` : "—"}
        </td>
        <td className="px-4 py-3 align-top min-w-[140px]">
          <div className="flex flex-col gap-2">
            <LeadStatusSelect
              leadId={lead.id}
              status={leadStatuses[lead.id] || "new"}
              onChange={onLeadStatusChange}
            />
            {onUseTemplate && (
              <button
                type="button"
                onClick={() => onUseTemplate(lead)}
                title="Open WhatsApp message template for this lead"
                style={{
                  background: "rgba(37,211,102,0.1)",
                  border: "1px solid rgba(37,211,102,0.25)",
                  color: "#25D366",
                  borderRadius: 6,
                  padding: "5px 8px",
                  fontSize: 10,
                  fontWeight: 700,
                  cursor: "pointer",
                  fontFamily: "Inter, sans-serif",
                  whiteSpace: "nowrap",
                }}
              >
                WhatsApp
              </button>
            )}
            {onMarkReplied && hasAnyEmail(lead) && (
              <button
                type="button"
                onClick={() => onMarkReplied(lead)}
                title="Mark this lead as replied and stop pending follow ups"
                style={{
                  background: "rgba(16,185,129,0.1)",
                  border: "1px solid rgba(16,185,129,0.25)",
                  color: "#10B981",
                  borderRadius: 6,
                  padding: "5px 8px",
                  fontSize: 10,
                  fontWeight: 700,
                  cursor: "pointer",
                  fontFamily: "Inter, sans-serif",
                  whiteSpace: "nowrap",
                }}
              >
                Mark replied
              </button>
            )}
          </div>
        </td>
        <td className="px-4 py-3 text-[#6B6B80] align-top">
          {lead.reviews_count ?? "—"}
        </td>
      </motion.tr>
    );
  };

  const colCount = showEmailSelection ? 9 : 8;

  return (
    <div className="overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0F0F14]">
      <PipelineSummary
        leads={pipelineLeads}
        leadStatuses={leadStatuses}
        statusFilter={statusFilter}
        onFilterChange={onStatusFilterChange}
      />
      <div className="flex flex-col gap-3 border-b border-white/[0.08] px-4 py-3 lg:flex-row lg:flex-wrap lg:items-stretch lg:gap-3">
        {sendToolbar}
        {onRatingFilterChange && (
          <RatingFilter
            value={ratingFilter}
            onChange={onRatingFilterChange}
            filteredCount={ratingMatchCount ?? sorted.length}
            totalCount={totalLeadCount ?? leads.length}
          />
        )}
        <select
          value={hasWebsite === null ? "all" : hasWebsite ? "yes" : "no"}
          onChange={(e) =>
            setHasWebsite(e.target.value === "all" ? null : e.target.value === "yes")
          }
          className="rounded-md border border-white/10 bg-[#16161E] px-2 py-1 text-xs text-[#F4F4FF]"
        >
          <option value="all">All websites</option>
          <option value="yes">Has website</option>
          <option value="no">No website</option>
        </select>
        <select
          value={statusFilter}
          onChange={(e) => onStatusFilterChange(e.target.value)}
          style={{
            background: "#111118",
            border: "1px solid rgba(255,255,255,0.08)",
            color: "#F0EFFF",
            borderRadius: 8,
            padding: "7px 12px",
            fontSize: 12,
            cursor: "pointer",
            fontFamily: "Inter, sans-serif",
            outline: "none",
            appearance: "none",
            WebkitAppearance: "none",
          }}
        >
          <option value="all">All statuses</option>
          <option value="new">New</option>
          <option value="contacted">Contacted</option>
          <option value="interested">Interested</option>
          <option value="closed">Closed</option>
          <option value="not_interested">Not interested</option>
        </select>
      </div>

      <div ref={parentRef} className="max-h-[600px] overflow-auto">
        <table className="w-full min-w-[900px] text-sm">
          <thead className="sticky top-0 z-30 bg-[#0F0F14]/95 backdrop-blur">
            <tr className="border-b border-white/[0.08]">
              {showEmailSelection && (
                <th
                  className={`px-3 py-3 text-center w-[56px] min-w-[56px] ${STICKY_SELECT_CLASS}`}
                >
                  <div className="flex flex-col items-center gap-1.5">
                    <SelectToggle
                      checked={allSelectableSelected}
                      disabled={selectableIds.length === 0}
                      onChange={toggleSelectAll}
                      label="Select all leads with email"
                    />
                    <span className="text-[9px] font-semibold uppercase tracking-wide text-[#A855F7]">
                      Select
                    </span>
                  </div>
                </th>
              )}
              {(
                [
                  ["business_name", "Business"],
                  ["address", "Address"],
                  ["phone", "Phone"],
                  ["email", "Email"],
                  ["website", "Website"],
                  ["rating", "Rating"],
                  ["status", "Status"],
                  ["reviews_count", "Reviews"],
                ] as const
              ).map(([key, label]) => (
                <th
                  key={key}
                  className="px-4 py-3 text-left text-xs uppercase text-[#6B6B80]"
                >
                  {["business_name", "rating", "reviews_count"].includes(key) ? (
                    <button
                      type="button"
                      onClick={() => toggleSort(key as SortKey)}
                      className="inline-flex items-center gap-1 hover:text-[#F4F4FF]"
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
                          <Loader2 className="h-3 w-3 animate-spin text-violet-400" />
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
              ? Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    <td colSpan={colCount} className="px-4 py-3">
                      <div className="skeleton h-4 rounded" />
                    </td>
                  </tr>
                ))
              : useVirtual
                ? rowVirtualizer.getVirtualItems().map((virtualRow) => {
                    const lead = sorted[virtualRow.index];
                    return renderRow(lead);
                  })
                : (
                  <AnimatePresence initial={false}>
                    {sorted.map((lead) => renderRow(lead))}
                  </AnimatePresence>
                )}
          </tbody>
        </table>
      </div>
      <div className="border-t border-white/[0.08] px-4 py-2 text-xs text-[#6B6B80]">
        {sorted.length} leads shown
      </div>
    </div>
  );
}

/** @internal exported for tests */
export function emailSelectionColumnVisible(selectedLeadIds?: Set<string>): boolean {
  return selectedLeadIds !== undefined;
}
