"use client";

import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "lp_lead_statuses";

export function getStatusStyle(status: string): {
  bg: string;
  color: string;
  border: string;
} {
  switch (status) {
    case "contacted":
      return {
        bg: "rgba(14,165,233,0.1)",
        color: "#0EA5E9",
        border: "rgba(14,165,233,0.25)",
      };
    case "interested":
      return {
        bg: "rgba(251,191,36,0.1)",
        color: "#FBBF24",
        border: "rgba(251,191,36,0.25)",
      };
    case "closed":
      return {
        bg: "rgba(16,185,129,0.1)",
        color: "#10B981",
        border: "rgba(16,185,129,0.25)",
      };
    case "not_interested":
      return {
        bg: "rgba(239,68,68,0.1)",
        color: "#EF4444",
        border: "rgba(239,68,68,0.25)",
      };
    default:
      return {
        bg: "rgba(255,255,255,0.04)",
        color: "#555575",
        border: "rgba(255,255,255,0.08)",
      };
  }
}

export function useLeadStatuses() {
  const [leadStatuses, setLeadStatuses] = useState<Record<string, string>>({});
  const [statusFilter, setStatusFilter] = useState<string>("all");

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) setLeadStatuses(JSON.parse(stored) as Record<string, string>);
    } catch {
      /* ignore */
    }
  }, []);

  const setLeadStatus = useCallback((leadId: string, status: string) => {
    setLeadStatuses((prev) => {
      const updated = { ...prev, [leadId]: status };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      } catch {
        /* ignore */
      }
      return updated;
    });
  }, []);

  return {
    leadStatuses,
    statusFilter,
    setStatusFilter,
    setLeadStatus,
    getStatusStyle,
  };
}
