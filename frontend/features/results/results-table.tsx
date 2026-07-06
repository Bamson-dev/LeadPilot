"use client";

import { useMemo, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowDown, ArrowUp, ArrowUpDown, Loader2 } from "lucide-react";
import { ContactDots } from "@/components/dashboard/contact-dots";
import { CopyButton } from "@/components/dashboard/copy-button";
import { EmailCell } from "@/components/dashboard/email-cell";
import { MobileLeadCard } from "@/components/dashboard/mobile-lead-card";
import { WebsiteLink } from "@/components/dashboard/website-link";
import { useCopyToClipboard } from "@/hooks/useCopyToClipboard";
import { LeadStatusSelect } from "@/components/dashboard/lead-status-select";
import { PipelineSummary } from "@/components/dashboard/pipeline-summary";
import { RatingFilter } from "@/components/dashboard/rating-filter";
import type { RatingFilterValue } from "@/lib/rating-filter";
import type { Lead } from "@/types/lead";
import { hasAnyEmail } from "@/utils/get-display-email";

type SortKey = keyof Pick<
  Lead,
  "business_name" | "phone" | "email" | "rating" | "reviews_count" | "category"
>;
type SortDir = "asc" | "desc";

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
  searchLocation?: string;
  emailScrapingInProgress?: boolean;
  selectedLeadIds?: Set<string>;
  onToggleLeadSelect?: (leadId: string) => void;
  onSendSelected?: () => void;
  sendSelectionDisabled?: boolean;
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
  emailScrapingInProgress = false,
  selectedLeadIds,
  onToggleLeadSelect,
  onSendSelected,
  sendSelectionDisabled = false,
}: ResultsTableProps) {
  const { copiedId, copyToClipboard } = useCopyToClipboard();
  const [sortKey, setSortKey] = useState<SortKey>("business_name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [hasWebsite, setHasWebsite] = useState<boolean | null>(null);
  const parentRef = useRef<HTMLDivElement>(null);

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
    () => sorted.filter((lead) => hasAnyEmail(lead)).map((l) => l.id),
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
        {onSendSelected && selectedLeadIds && (
          <button
            type="button"
            onClick={onSendSelected}
            disabled={sendSelectionDisabled || selectedLeadIds.size === 0}
            style={{
              background:
                selectedLeadIds.size > 0 && !sendSelectionDisabled
                  ? "rgba(124,58,237,0.2)"
                  : "rgba(255,255,255,0.04)",
              border: "1px solid rgba(124,58,237,0.35)",
              color: selectedLeadIds.size > 0 && !sendSelectionDisabled ? "#F4F4FF" : "#6B6B80",
              borderRadius: 8,
              padding: "7px 14px",
              fontSize: 12,
              fontWeight: 700,
              cursor:
                selectedLeadIds.size > 0 && !sendSelectionDisabled
                  ? "pointer"
                  : "not-allowed",
              width: "100%",
            }}
          >
            Send email ({selectedLeadIds.size})
          </button>
        )}
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
    const canSelect = hasAnyEmail(lead);
    const isSelected = selectedLeadIds?.has(lead.id) ?? false;

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
      {onToggleLeadSelect && (
        <td className="px-3 py-3 align-top w-10">
          <input
            type="checkbox"
            checked={isSelected}
            disabled={!canSelect}
            onChange={() => canSelect && onToggleLeadSelect(lead.id)}
            aria-label={`Select ${lead.business_name}`}
            className="h-4 w-4 accent-violet-500 disabled:opacity-30"
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
      <td style={{ padding: "12px 8px" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <LeadStatusSelect
            leadId={lead.id}
            status={leadStatuses[lead.id] || "new"}
            onChange={onLeadStatusChange}
          />
          {onUseTemplate && (
            <button
              type="button"
              onClick={() => onUseTemplate(lead)}
              style={{
                background: "rgba(37,211,102,0.1)",
                border: "1px solid rgba(37,211,102,0.25)",
                color: "#25D366",
                borderRadius: 6,
                padding: "4px 8px",
                fontSize: 10,
                fontWeight: 700,
                cursor: "pointer",
                fontFamily: "Inter, sans-serif",
                whiteSpace: "nowrap",
              }}
            >
              Use Template
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

  return (
    <div className="overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0F0F14]">
      <PipelineSummary
        leads={pipelineLeads}
        leadStatuses={leadStatuses}
        statusFilter={statusFilter}
        onFilterChange={onStatusFilterChange}
      />
      <div className="flex flex-col gap-2 border-b border-white/[0.08] px-4 py-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3">
        {onSendSelected && selectedLeadIds && (
          <button
            type="button"
            onClick={onSendSelected}
            disabled={sendSelectionDisabled || selectedLeadIds.size === 0}
            style={{
              background:
                selectedLeadIds.size > 0 && !sendSelectionDisabled
                  ? "rgba(124,58,237,0.2)"
                  : "rgba(255,255,255,0.04)",
              border: "1px solid rgba(124,58,237,0.35)",
              color: selectedLeadIds.size > 0 && !sendSelectionDisabled ? "#F4F4FF" : "#6B6B80",
              borderRadius: 8,
              padding: "7px 14px",
              fontSize: 12,
              fontWeight: 700,
              cursor:
                selectedLeadIds.size > 0 && !sendSelectionDisabled
                  ? "pointer"
                  : "not-allowed",
            }}
          >
            Send email ({selectedLeadIds.size})
          </button>
        )}
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
          <thead className="sticky top-0 z-10 bg-[#0F0F14]/95 backdrop-blur">
            <tr className="border-b border-white/[0.08]">
              {onToggleLeadSelect && (
                <th className="px-3 py-3 text-left w-10">
                  <input
                    type="checkbox"
                    checked={allSelectableSelected}
                    onChange={toggleSelectAll}
                    disabled={selectableIds.length === 0}
                    aria-label="Select all leads with email"
                    className="h-4 w-4 accent-violet-500 disabled:opacity-30"
                  />
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
                    <td colSpan={onToggleLeadSelect ? 9 : 8} className="px-4 py-3">
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
