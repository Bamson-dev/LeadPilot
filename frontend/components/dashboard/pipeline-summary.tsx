"use client";

import type { Lead } from "@/types/lead";

interface PipelineSummaryProps {
  leads: Lead[];
  leadStatuses: Record<string, string>;
  statusFilter: string;
  onFilterChange: (filter: string) => void;
}

const STATUS_ITEMS = [
  { key: "new", label: "New", color: "#9CA3AF" },
  { key: "contacted", label: "Contacted", color: "#0EA5E9" },
  { key: "interested", label: "Interested", color: "#FBBF24" },
  { key: "closed", label: "Closed", color: "#10B981" },
  { key: "not_interested", label: "Not Interested", color: "#EF4444" },
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
    <div
      style={{
        marginBottom: 12,
        padding: "10px 14px",
        background: "#0D0D16",
        border: "1px solid rgba(255,255,255,0.06)",
        borderRadius: 10,
        fontSize: 12,
        color: "#6B6B80",
        lineHeight: 1.6,
      }}
    >
      {STATUS_ITEMS.map((item, index) => (
        <span key={item.key}>
          {index > 0 && <span style={{ margin: "0 6px", color: "#3F3F50" }}>·</span>}
          <button
            type="button"
            onClick={() => onFilterChange(item.key)}
            style={{
              background: "transparent",
              border: "none",
              padding: 0,
              cursor: "pointer",
              color: statusFilter === item.key ? item.color : "#A1A1B5",
              fontWeight: statusFilter === item.key ? 700 : 500,
              fontSize: 12,
              fontFamily: "Inter, sans-serif",
            }}
          >
            {item.label}: {counts[item.key]}
          </button>
        </span>
      ))}
      {statusFilter !== "all" && (
        <>
          <span style={{ margin: "0 6px", color: "#3F3F50" }}>·</span>
          <button
            type="button"
            onClick={() => onFilterChange("all")}
            style={{
              background: "transparent",
              border: "none",
              padding: 0,
              cursor: "pointer",
              color: "#6B6B80",
              textDecoration: "underline",
              fontSize: 12,
              fontFamily: "Inter, sans-serif",
            }}
          >
            Show all
          </button>
        </>
      )}
    </div>
  );
}
