"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { leadStatusKey, type LeadStatusValue } from "@/lib/lead-status";
import { fetchLeadStatuses, saveLeadStatus } from "@/services/api";
import type { Lead } from "@/types/lead";

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
    case "new":
    default:
      return {
        bg: "rgba(255,255,255,0.04)",
        color: "#9CA3AF",
        border: "rgba(255,255,255,0.08)",
      };
  }
}

type StatusRecord = {
  id: string;
  status: LeadStatusValue;
};

export function useLeadStatuses(leads: Lead[]) {
  const [recordsByKey, setRecordsByKey] = useState<Record<string, StatusRecord>>({});
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [loaded, setLoaded] = useState(false);

  const loadStatuses = useCallback(async () => {
    try {
      const data = await fetchLeadStatuses();
      const next: Record<string, StatusRecord> = {};
      for (const row of data.statuses ?? []) {
        const key = leadStatusKey(row.business_name, row.business_phone);
        next[key] = { id: row.id, status: row.status };
      }
      setRecordsByKey(next);
    } catch {
      /* non-blocking */
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    void loadStatuses();
  }, [loadStatuses]);

  const leadStatuses = useMemo(() => {
    const map: Record<string, string> = {};
    for (const lead of leads) {
      const key = leadStatusKey(lead.business_name, lead.phone);
      map[lead.id] = recordsByKey[key]?.status ?? "new";
    }
    return map;
  }, [leads, recordsByKey]);

  const setLeadStatus = useCallback(
    (leadId: string, status: string) => {
      const lead = leads.find((l) => l.id === leadId);
      if (!lead) return;

      const key = leadStatusKey(lead.business_name, lead.phone);
      const nextStatus = status as LeadStatusValue;

      setRecordsByKey((prev) => ({
        ...prev,
        [key]: { id: prev[key]?.id ?? "", status: nextStatus },
      }));

      const email =
        typeof window !== "undefined"
          ? localStorage.getItem("leadthur_email") || ""
          : "";

      void saveLeadStatus({
        email,
        business_name: lead.business_name,
        business_phone: lead.phone,
        business_address: lead.address,
        search_id: lead.search_id,
        status: nextStatus,
      })
        .then((record) => {
          if (!record) return;
          setRecordsByKey((prev) => ({
            ...prev,
            [key]: { id: record.id, status: record.status },
          }));
        })
        .catch(() => {
          void loadStatuses();
        });
    },
    [leads, loadStatuses]
  );

  return {
    leadStatuses,
    statusFilter,
    setStatusFilter,
    setLeadStatus,
    getStatusStyle,
    statusesLoaded: loaded,
  };
}
