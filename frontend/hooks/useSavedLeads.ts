"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  fetchLeadStatuses,
  getResults,
  getSearchHistory,
  type LeadStatusRecord,
} from "@/services/api";
import { leadStatusKey } from "@/lib/lead-status";
import {
  historyToSavedLists,
  matchLeadToStatus,
  statusRecordToPartialLead,
  type SavedListItem,
} from "@/lib/saved-leads";
import type { Lead } from "@/types/lead";

const MAX_SEARCHES_TO_HYDRATE = 25;
const RESULTS_PAGE_SIZE = 200;

export function useSavedLeads(initialListId?: string | null) {
  const [statuses, setStatuses] = useState<LeadStatusRecord[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [lists, setLists] = useState<SavedListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [listFilterId, setListFilterId] = useState<string | "all">(
    initialListId || "all"
  );

  useEffect(() => {
    if (initialListId) setListFilterId(initialListId);
  }, [initialListId]);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [statusRes, historyRes] = await Promise.all([
        fetchLeadStatuses(),
        getSearchHistory(),
      ]);

      const nextStatuses = statusRes.statuses ?? [];
      setStatuses(nextStatuses);
      setLists(historyToSavedLists(historyRes.history ?? []));

      const searchIds = Array.from(
        new Set(
          nextStatuses
            .map((s) => s.search_id)
            .filter((id): id is string => Boolean(id && id.trim()))
        )
      ).slice(0, MAX_SEARCHES_TO_HYDRATE);

      const hydratedByKey = new Map<string, Lead>();

      await Promise.all(
        searchIds.map(async (searchId) => {
          try {
            const { leads: pageLeads } = await getResults(
              searchId,
              1,
              RESULTS_PAGE_SIZE
            );
            for (const lead of pageLeads) {
              const key = leadStatusKey(lead.business_name, lead.phone);
              if (!hydratedByKey.has(key)) {
                hydratedByKey.set(key, lead);
              }
            }
          } catch {
            /* skip failed search hydration */
          }
        })
      );

      const nextLeads: Lead[] = nextStatuses.map((record) => {
        const key = leadStatusKey(record.business_name, record.business_phone);
        const match =
          hydratedByKey.get(key) ||
          Array.from(hydratedByKey.values()).find((lead) =>
            matchLeadToStatus(lead, record)
          );
        if (match) {
          return {
            ...match,
            id: match.id || `status:${record.id}`,
            search_id: match.search_id || record.search_id || "",
          };
        }
        return statusRecordToPartialLead(record);
      });

      setLeads(nextLeads);
    } catch {
      setError("Could not load saved leads. Try again.");
      setLeads([]);
      setStatuses([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const activeList = useMemo(
    () =>
      listFilterId === "all"
        ? null
        : lists.find((l) => l.id === listFilterId) ?? null,
    [listFilterId, lists]
  );

  const filteredByList = useMemo(() => {
    if (!activeList?.searchId) return leads;
    return leads.filter((lead) => lead.search_id === activeList.searchId);
  }, [leads, activeList]);

  return {
    statuses,
    leads: filteredByList,
    allLeads: leads,
    lists,
    listFilterId,
    setListFilterId,
    activeList,
    loading,
    error,
    reload,
  };
}
