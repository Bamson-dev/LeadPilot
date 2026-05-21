"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import type { BusinessLead } from "@leadpilot/shared";
import { getResults, getSearch, startSearch } from "@/services/api";
import { getApiUrl } from "@/utils/env";
import { formatSearchMessage } from "@/utils/search-messages";
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
  error: string | null;
}

const POLL_INTERVAL_MS = 5000;
const SEARCH_TIMEOUT_MS = 3 * 60 * 1000;

export function useSearch() {
  const [state, setState] = useState<SearchState>({
    status: "idle",
    leads: [],
    searchId: null,
    message: "",
    totalFound: 0,
    searchesRemaining: null,
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

  const mergeLeads = useCallback((incoming: BusinessLead[]) => {
    if (incoming.length === 0) return;
    setState((prev) => {
      const existingIds = new Set(prev.leads.map((l) => l.id));
      const unique = incoming.filter((l) => l.id && !existingIds.has(l.id));
      if (unique.length === 0) return prev;
      const merged = [...prev.leads, ...unique];
      return {
        ...prev,
        leads: merged,
        totalFound: merged.length,
        status: prev.status === "starting" ? "running" : prev.status,
      };
    });
  }, []);

  const syncFromApi = useCallback(
    async (searchId: string) => {
      const { leads: fetched } = await getResults(searchId);
      if (fetched.length === 0) return;
      mergeLeads(fetched.map((l) => leadRowToBusinessLead(l)));
    },
    [mergeLeads]
  );

  const finishSearch = useCallback(
    (total: number, message: string) => {
      closeStream();
      setState((prev) => ({
        ...prev,
        status: "completed",
        totalFound: total || prev.leads.length,
        message,
      }));
    },
    [closeStream]
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
                `Search complete. Found ${job.totalFound} businesses.`
              );
            } else if (job.status === "failed") {
              completedRef.current = true;
              closeStream();
              setState((prev) => ({
                ...prev,
                status: "error",
                error: job.error ?? "Search failed. Please try again.",
              }));
            } else if (job.processed > 0) {
              setState((prev) => ({
                ...prev,
                message: `Found ${job.processed} businesses so far...`,
              }));
            }
          } catch {
            /* polling is best-effort */
          }
        })();
      }, POLL_INTERVAL_MS);
    },
    [stopPolling, syncFromApi, finishSearch, closeStream]
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

      const streamUrl = `${apiUrl}/search/${searchId}/stream`;
      const es = new EventSource(streamUrl);
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
                message: formatSearchMessage(queryRef.current, locationRef.current),
              }));
              break;

            case "lead": {
              const lead = data.data ?? data.lead;
              if (lead) pendingLeadsRef.current.push(lead);
              break;
            }

            case "progress":
              setState((prev) => ({
                ...prev,
                message:
                  data.message ||
                  `Found ${data.processed ?? prev.leads.length} businesses...`,
              }));
              break;

            case "phase": {
              const phase = data.phase ?? data.message;
              if (phase) setState((prev) => ({ ...prev, message: phase }));
              break;
            }

            case "complete":
              finishSearch(
                data.total ?? 0,
                data.message ||
                  `Search complete. Found ${data.total ?? 0} businesses.`
              );
              break;

            case "error":
              completedRef.current = true;
              closeStream();
              setState((prev) => ({
                ...prev,
                status: "error",
                error: data.message || "Search failed. Please try again.",
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
          setState((prev) => ({
            ...prev,
            message: `Reconnecting... (attempt ${reconnectCountRef.current} of 3)`,
          }));
          setTimeout(() => {
            if (searchIdRef.current && !completedRef.current) {
              connectToStream(searchIdRef.current);
            }
          }, 3000);
        }
      };
    },
    [closeStream, finishSearch]
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
        message: `Starting search for ${query.trim()} in ${location.trim()}...`,
        totalFound: 0,
        searchesRemaining: null,
        error: null,
      });

      try {
        const result = await startSearch(query.trim(), location.trim());
        searchIdRef.current = result.searchId;

        setState((prev) => ({
          ...prev,
          searchId: result.searchId,
          searchesRemaining: result.searchesRemaining ?? null,
          message: formatSearchMessage(query.trim(), location.trim()),
          status: "running",
        }));

        if (result.cached && result.status === "completed") {
          const { leads: cached } = await getResults(result.searchId);
          const mapped = cached.map((l) => leadRowToBusinessLead(l));
          setState({
            status: "completed",
            leads: mapped,
            searchId: result.searchId,
            message: `Search complete. Found ${mapped.length} businesses.`,
            totalFound: mapped.length,
            searchesRemaining: result.searchesRemaining ?? null,
            error: null,
          });
          return;
        }

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
              /* fall through to error */
            }
            completedRef.current = true;
            closeStream();
            let errMsg =
              "Search is taking too long. Try a broader location (e.g. Lagos Nigeria) or wait and try again.";
            try {
              const job = await getSearch(result.searchId);
              if (job.error) errMsg = job.error;
            } catch {
              /* use default */
            }
            setState((prev) => ({
              ...prev,
              status: "error",
              error: errMsg,
            }));
          })();
        }, SEARCH_TIMEOUT_MS);
      } catch (err) {
        closeStream();
        setState((prev) => ({
          ...prev,
          status: "error",
          error: err instanceof Error ? err.message : "Failed to start search",
        }));
      }
    },
    [closeStream, connectToStream, startPolling, stopTimeout, syncFromApi, finishSearch]
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
      error: null,
    });
  }, [closeStream]);

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
    progress:
      state.totalFound > 0
        ? Math.min(99, state.totalFound)
        : isSearching
          ? 15
          : 0,
    searchMeta: { business: queryRef.current, location: locationRef.current },
    runSearch: search,
    clearResults: reset,
    closeStream: reset,
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
    emailSource:
      lead.email_source === "extracted"
        ? "website"
        : lead.email_source === "generated"
          ? "generated"
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
