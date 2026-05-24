"use client";

import type { Lead } from "@/types/lead";

interface PipelineSummaryProps {
  leads: Lead[];
  leadStatuses: Record<string, string>;
  statusFilter: string;
  onFilterChange: (filter: string) => void;
}

export function PipelineSummary({
  leads,
  leadStatuses,
  statusFilter,
  onFilterChange,
}: PipelineSummaryProps) {
  const statusCounts = {
    contacted: 0,
    interested: 0,
    closed: 0,
    not_interested: 0,
  };

  leads.forEach((lead) => {
    const s = leadStatuses[lead.id];
    if (s && s !== "none" && s in statusCounts) {
      statusCounts[s as keyof typeof statusCounts]++;
    }
  });

  const total = Object.values(statusCounts).reduce((a, b) => a + b, 0);
  if (total === 0) return null;

  return (
    <div
      style={{
        display: "flex",
        gap: 8,
        flexWrap: "wrap",
        marginBottom: 12,
        padding: "10px 14px",
        background: "#0D0D16",
        border: "1px solid rgba(255,255,255,0.06)",
        borderRadius: 10,
      }}
    >
      <span
        style={{
          fontSize: 11,
          color: "#555575",
          fontWeight: 600,
          alignSelf: "center",
        }}
      >
        Pipeline:
      </span>
      {statusCounts.contacted > 0 && (
        <span
          role="button"
          tabIndex={0}
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: "#0EA5E9",
            background: "rgba(14,165,233,0.1)",
            border: "1px solid rgba(14,165,233,0.2)",
            padding: "3px 8px",
            borderRadius: 100,
            cursor: "pointer",
          }}
          onClick={() => onFilterChange("contacted")}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") onFilterChange("contacted");
          }}
        >
          {statusCounts.contacted} Contacted
        </span>
      )}
      {statusCounts.interested > 0 && (
        <span
          role="button"
          tabIndex={0}
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: "#FBBF24",
            background: "rgba(251,191,36,0.1)",
            border: "1px solid rgba(251,191,36,0.2)",
            padding: "3px 8px",
            borderRadius: 100,
            cursor: "pointer",
          }}
          onClick={() => onFilterChange("interested")}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") onFilterChange("interested");
          }}
        >
          {statusCounts.interested} Interested
        </span>
      )}
      {statusCounts.closed > 0 && (
        <span
          role="button"
          tabIndex={0}
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: "#10B981",
            background: "rgba(16,185,129,0.1)",
            border: "1px solid rgba(16,185,129,0.2)",
            padding: "3px 8px",
            borderRadius: 100,
            cursor: "pointer",
          }}
          onClick={() => onFilterChange("closed")}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") onFilterChange("closed");
          }}
        >
          {statusCounts.closed} Closed ✓
        </span>
      )}
      {statusCounts.not_interested > 0 && (
        <span
          role="button"
          tabIndex={0}
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: "#EF4444",
            background: "rgba(239,68,68,0.1)",
            border: "1px solid rgba(239,68,68,0.2)",
            padding: "3px 8px",
            borderRadius: 100,
            cursor: "pointer",
          }}
          onClick={() => onFilterChange("not_interested")}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") onFilterChange("not_interested");
          }}
        >
          {statusCounts.not_interested} Not Interested
        </span>
      )}
      {statusFilter !== "all" && (
        <span
          role="button"
          tabIndex={0}
          style={{
            fontSize: 11,
            color: "#555575",
            cursor: "pointer",
            alignSelf: "center",
            textDecoration: "underline",
          }}
          onClick={() => onFilterChange("all")}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") onFilterChange("all");
          }}
        >
          Show all
        </span>
      )}
    </div>
  );
}
