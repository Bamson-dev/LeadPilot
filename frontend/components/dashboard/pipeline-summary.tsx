"use client";

import type { Lead } from "@/types/lead";
import { cn } from "@/utils/utils";

interface PipelineSummaryProps {
  leads: Lead[];
  leadStatuses: Record<string, string>;
  statusFilter: string;
  onFilterChange: (filter: string) => void;
}

const STATUS_ITEMS = [
  { key: "new", label: "New" },
  { key: "contacted", label: "Contacted" },
  { key: "interested", label: "Interested" },
  { key: "closed", label: "Closed" },
  { key: "not_interested", label: "Not interested" },
] as const;

export function PipelineSummary({
  leads,
  leadStatuses,
  statusFilter,
  onFilterChange,
}: PipelineSummaryProps) {
  const counts: Record<string, number> = {
    new: 0,
    contacted: 0,
    interested: 0,
    closed: 0,
    not_interested: 0,
  };

  leads.forEach((lead) => {
    const raw = leadStatuses[lead.id] || "new";
    const status = raw === "none" ? "new" : raw;
    if (status in counts) counts[status]++;
  });

  if (leads.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-1.5 px-1 py-1 text-xs text-[var(--lt-text-muted)]">
      {STATUS_ITEMS.map((item) => {
        const active = statusFilter === item.key;
        return (
          <button
            key={item.key}
            type="button"
            onClick={() => onFilterChange(active ? "all" : item.key)}
            className={cn(
              "rounded-md px-2 py-1 transition-colors",
              active
                ? "bg-[var(--lt-cyan-soft)] text-[var(--lt-cyan)]"
                : "hover:bg-[var(--lt-surface-3)] hover:text-[var(--lt-text)]"
            )}
          >
            {item.label}{" "}
            <span className="tabular-nums font-medium">{counts[item.key]}</span>
          </button>
        );
      })}
      {statusFilter !== "all" && (
        <button
          type="button"
          onClick={() => onFilterChange("all")}
          className="px-2 py-1 text-[var(--lt-text-subtle)] hover:text-[var(--lt-text)]"
        >
          Clear
        </button>
      )}
    </div>
  );
}
