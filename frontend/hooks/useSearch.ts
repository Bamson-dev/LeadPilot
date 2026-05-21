"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import type { BusinessLead } from "@leadpilot/shared";
import { getResults, getSearch, startSearch } from "@/services/api";
import { getApiUrl } from "@/utils/env";
import {
  getSearchProgressMessage,
  getSearchProgressPercent,
} from "@/utils/search-progress-messages";
import { businessLeadToLead } from "@/types/lead";
import type { Lead } from "@/types/lead";

export type { BusinessLead };

interface SearchState {
  status: "idle" | "starting" | "running" | "completed" | "error";
  leads: BusinessLead[];
  searchId: string | null;
  message: string;
  totalFound: number;
  searchesRemaining: number | null;
  queuePosition: number;
  error: string | null;
}

const POLL_INTERVAL_MS = 5000;
const SEARCH_TIMEOUT_MS = 10 * 60 * 1000;

export function useSearch() {
  const [state, setState] = useState<SearchState>({
    status: "idle",
    leads: [],
    searchId: null,
    message: "",
    totalFound: 0,
    searchesRemaining: null,
    queuePosition: 0,
    error: null,
  });

  const eventSourceRef = useRef<EventSource | null>(null);
  const pendingLeadsRef = useRef<BusinessLead[]>([]);
  const reconnectCountRef = useRef(0);
  const searchIdRef = useRef<string | null>(null);
  const queryRef = useRef("");
  const locationRef = useRef("");
  const completedRef = useRef(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const stopTimeout = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const closeStream = useCallback(() => {
    completedRef.current = true;
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    stopPolling();
    stopTimeout();
  }, [stopPolling, stopTimeout]);

  const progressMessage = useCallback(
    (
      count: number,
      status: "running" | "completed" | "failed" | "queued",
      queuePosition: number
    ) =>
      getSearchProgressMessage(
        count,
        queryRef.current,
        locationRef.current,
        status,
        queuePosition
      ),
    []
  );

  const mergeLeads = useCallback((incoming: BusinessLead[]) => {
    if (incoming.length === 0) return;
    setState((prev) => {
      const existingIds = new Set(prev.leads.map((l) => l.id));
      const unique = incoming.filter((l) => l.id && !existingIds.has(l.id));
      if (unique.length === 0) return prev;
      const merged = [...prev.leads, ...unique];
      const count = merged.length;
      return {
        ...prev,
        leads: merged,
        totalFound: count,
        status: prev.status === "starting" ? "running" : prev.status,
        message: progressMessage(count, "running", prev.queuePosition),
      };
    });
  }, [progressMessage]);

  const syncFromApi = useCallback(
    async (searchId: string) => {
      const { leads: fetched } = await getResults(searchId);
      if (fetched.length === 0) return;
      mergeLeads(fetched.map((l) => leadRowToBusinessLead(l)));
    },
    [mergeLeads]
  );

  const finishSearch = useCallback(
    (total: number, message?: string) => {
      closeStream();
      setState((prev) => ({
        ...prev,
        status: "completed",
        totalFound: total || prev.leads.length,
        queuePosition: 0,
        message:
          message ??
          progressMessage(total || prev.leads.length, "completed", 0),
      }));
    },
    [closeStream, progressMessage]
  );

  const startPolling = useCallback(
    (searchId: string) => {
      stopPolling();
      pollRef.current = setInterval(() => {
        if (completedRef.current) return;
        void (async () => {
          try {
            const job = await getSearch(searchId);
            await syncFromApi(searchId);

            if (job.status === "completed") {
              finishSearch(
                job.totalFound,
                progressMessage(job.totalFound, "completed", 0)
              );
            } else if (job.status === "failed") {
              completedRef.current = true;
              closeStream();
              setState((prev) => ({
                ...prev,
                status: "error",
                error: progressMessage(0, "failed", 0),
                message: progressMessage(0, "failed", 0),
              }));
            }
          } catch {
            /* polling is best-effort */
          }
        })();
      }, POLL_INTERVAL_MS);
    },
    [stopPolling, syncFromApi, finishSearch, closeStream, progressMessage]
  );

  useEffect(() => {
    const interval = setInterval(() => {
      if (pendingLeadsRef.current.length === 0) return;
      const batch = pendingLeadsRef.current.splice(0, pendingLeadsRef.current.length);
      mergeLeads(batch);
    }, 200);
    return () => clearInterval(interval);
  }, [mergeLeads]);

  const connectToStream = useCallback(
    (searchId: string) => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }

      const apiUrl = process.env.NEXT_PUBLIC_API_URL?.trim()?.replace(/\/$/, "") || getApiUrl();
      if (!apiUrl) return;

      const es = new EventSource(`${apiUrl}/search/${searchId}/stream`);
      eventSourceRef.current = es;

      es.onopen = () => {
        reconnectCountRef.current = 0;
      };

      es.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data) as {
            type: string;
            data?: BusinessLead;
            lead?: BusinessLead;
            message?: string;
            processed?: number;
            total?: number;
            phase?: string;
          };

          switch (data.type) {
            case "started":
              setState((prev) => ({
                ...prev,
                status: "running",
                message: progressMessage(prev.leads.length, "running", prev.queuePosition),
              }));
              break;

            case "lead": {
              const lead = data.data ?? data.lead;
              if (lead) pendingLeadsRef.current.push(lead);
              break;
            }

            case "progress":
              setState((prev) => {
                const count = data.processed ?? prev.leads.length;
                return {
                  ...prev,
                  message: progressMessage(count, "running", prev.queuePosition),
                };
              });
              break;

            case "phase": {
              const phase = data.phase ?? data.message;
              if (phase?.includes("queued") || phase?.includes("Position")) {
                setState((prev) => {
                  const match = phase.match(/Position\s+(\d+)/i);
                  const pos = match ? parseInt(match[1], 10) : 0;
                  return {
                    ...prev,
                    queuePosition: pos,
                    message: progressMessage(prev.leads.length, "queued", pos),
                  };
                });
              }
              break;
            }

            case "complete":
              finishSearch(
                data.total ?? 0,
                data.message ??
                  progressMessage(data.total ?? 0, "completed", 0)
              );
              break;

            case "error":
              completedRef.current = true;
              closeStream();
              setState((prev) => ({
                ...prev,
                status: "error",
                error: data.message || progressMessage(0, "failed", 0),
                message: progressMessage(0, "failed", 0),
              }));
              break;
          }
        } catch (err) {
          console.error("Failed to parse SSE event", err);
        }
      };

      es.onerror = () => {
        if (completedRef.current) return;
        es.close();
        eventSourceRef.current = null;
        if (reconnectCountRef.current < 3) {
          reconnectCountRef.current += 1;
          setTimeout(() => {
            if (searchIdRef.current && !completedRef.current) {
              connectToStream(searchIdRef.current);
            }
          }, 3000);
        }
      };
    },
    [closeStream, finishSearch, progressMessage]
  );

  const search = useCallback(
    async (query: string, location: string) => {
      if (!query.trim() || !location.trim()) {
        setState((prev) => ({
          ...prev,
          status: "error",
          error: "Please enter both business type and location.",
        }));
        return;
      }

      closeStream();
      completedRef.current = false;
      queryRef.current = query.trim();
      locationRef.current = location.trim();
      pendingLeadsRef.current = [];
      reconnectCountRef.current = 0;
      searchIdRef.current = null;

      setState({
        status: "starting",
        leads: [],
        searchId: null,
        message: progressMessage(0, "running", 0),
        totalFound: 0,
        searchesRemaining: null,
        queuePosition: 0,
        error: null,
      });

      try {
        const result = await startSearch(query.trim(), location.trim());
        searchIdRef.current = result.searchId;
        const queuePosition = result.queuePosition ?? 0;

        if (result.cached && result.status === "completed") {
          const { leads: cached } = await getResults(result.searchId);
          const mapped = cached.map((l) => leadRowToBusinessLead(l));
          setState({
            status: "completed",
            leads: mapped,
            searchId: result.searchId,
            message: `Found ${result.totalFound ?? mapped.length} businesses instantly from recent search`,
            totalFound: result.totalFound ?? mapped.length,
            searchesRemaining: result.searchesRemaining ?? null,
            queuePosition: 0,
            error: null,
          });
          return;
        }

        setState((prev) => ({
          ...prev,
          searchId: result.searchId,
          searchesRemaining: result.searchesRemaining ?? null,
          queuePosition,
          status: "running",
          message: progressMessage(0, queuePosition > 0 ? "queued" : "running", queuePosition),
        }));

        connectToStream(result.searchId);
        startPolling(result.searchId);

        stopTimeout();
        timeoutRef.current = setTimeout(() => {
          if (completedRef.current) return;
          void (async () => {
            try {
              await syncFromApi(result.searchId);
              const { leads: saved } = await getResults(result.searchId);
              if (saved.length > 0) {
                finishSearch(
                  saved.length,
                  `Search timed out but ${saved.length} results were saved.`
                );
                return;
              }
            } catch {
              /* fall through */
            }
            completedRef.current = true;
            closeStream();
            setState((prev) => ({
              ...prev,
              status: "error",
              error: progressMessage(0, "failed", 0),
              message: progressMessage(0, "failed", 0),
            }));
          })();
        }, SEARCH_TIMEOUT_MS);
      } catch (err) {
        closeStream();
        setState((prev) => ({
          ...prev,
          status: "error",
          error: err instanceof Error ? err.message : "Failed to start search",
          message: progressMessage(0, "failed", 0),
        }));
      }
    },
    [closeStream, connectToStream, startPolling, stopTimeout, syncFromApi, finishSearch, progressMessage]
  );

  const reset = useCallback(() => {
    closeStream();
    searchIdRef.current = null;
    pendingLeadsRef.current = [];
    setState({
      status: "idle",
      leads: [],
      searchId: null,
      message: "",
      totalFound: 0,
      searchesRemaining: null,
      queuePosition: 0,
      error: null,
    });
  }, [closeStream]);

  const loadSavedLeads = useCallback((leads: Lead[]) => {
    closeStream();
    const mapped = leads.map((l) => leadRowToBusinessLead(l));
    setState({
      status: "completed",
      leads: mapped,
      searchId: null,
      message: progressMessage(mapped.length, "completed", 0),
      totalFound: mapped.length,
      searchesRemaining: state.searchesRemaining,
      queuePosition: 0,
      error: null,
    });
  }, [closeStream, progressMessage, state.searchesRemaining]);

  useEffect(() => () => closeStream(), [closeStream]);

  const tableLeads: Lead[] = state.leads.map((l) =>
    businessLeadToLead({
      ...l,
      searchId: l.searchId ?? state.searchId ?? "",
      createdAt: l.createdAt ?? new Date().toISOString(),
    })
  );

  const isSearching = state.status === "starting" || state.status === "running";

  return {
    ...state,
    leads: tableLeads,
    rawLeads: state.leads,
    isSearching,
    phaseMessage: state.message,
    progress: getSearchProgressPercent(
      state.leads.length,
      state.status === "completed"
    ),
    searchMeta: { business: queryRef.current, location: locationRef.current },
    runSearch: search,
    clearResults: reset,
    closeStream: reset,
    loadSavedLeads,
    showLimitMessage:
      !!state.error &&
      (state.error.includes("limit") ||
        state.error.includes("Monthly") ||
        state.error.includes("search limit")),
  };
}

function leadRowToBusinessLead(lead: Lead): BusinessLead {
  return {
    id: lead.id,
    searchId: lead.search_id,
    name: lead.business_name,
    category: lead.category ?? "",
    address: lead.address ?? "",
    phone: lead.phone,
    email: lead.email,
    verifiedEmails: lead.verified_emails ?? [],
    predictedEmails: lead.predicted_emails ?? [],
    emailSource:
      lead.email_source === "extracted"
        ? "website"
        : lead.email_source === "predicted"
          ? "predicted"
          : "none",
    website: lead.website,
    rating: lead.rating,
    reviewCount: lead.reviews_count,
    googleMapsUrl: lead.google_maps_url,
    hasWebsite: Boolean(lead.website),
    hasInstagram: false,
    createdAt: lead.created_at,
  };
}
