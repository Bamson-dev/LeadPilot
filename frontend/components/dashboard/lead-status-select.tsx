"use client";

import { getStatusStyle } from "@/hooks/useLeadStatuses";

interface LeadStatusSelectProps {
  leadId: string;
  status: string;
  onChange: (leadId: string, status: string) => void;
  fullWidth?: boolean;
}

export function LeadStatusSelect({
  leadId,
  status,
  onChange,
  fullWidth = false,
}: LeadStatusSelectProps) {
  const style = getStatusStyle(status);

  return (
    <select
      value={status}
      onChange={(e) => onChange(leadId, e.target.value)}
      style={{
        width: fullWidth ? "100%" : undefined,
        background: style.bg,
        border: `1px solid ${style.border}`,
        color: style.color,
        borderRadius: fullWidth ? 8 : 7,
        padding: fullWidth ? "10px 12px" : "5px 8px",
        fontSize: fullWidth ? 12 : 11,
        fontWeight: 600,
        cursor: "pointer",
        fontFamily: "Inter, sans-serif",
        outline: "none",
        minWidth: fullWidth ? undefined : 120,
        appearance: "none",
        WebkitAppearance: "none",
      }}
    >
      <option value="none" style={{ background: "#111118", color: "#555575" }}>
        {fullWidth ? "— Set Status" : "— Status"}
      </option>
      <option value="contacted" style={{ background: "#111118", color: "#0EA5E9" }}>
        Contacted
      </option>
      <option value="interested" style={{ background: "#111118", color: "#FBBF24" }}>
        Interested
      </option>
      <option value="closed" style={{ background: "#111118", color: "#10B981" }}>
        Closed ✓
      </option>
      <option value="not_interested" style={{ background: "#111118", color: "#EF4444" }}>
        Not Interested
      </option>
    </select>
  );
}
