"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import type { BusinessLead } from "@leadpilot/shared";
import { getResults, startSearch } from "@/services/api";
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

  useEffect(() => {
    const interval = setInterval(() => {
      if (pendingLeadsRef.current.length === 0) return;
      const newLeads = [...pendingLeadsRef.current];
      pendingLeadsRef.current = [];
      setState((prev) => {
        const existingIds = new Set(prev.leads.map((l) => l.id));
        const unique = newLeads.filter((l) => !existingIds.has(l.id));
        if (unique.length === 0) return prev;
        const merged = [...prev.leads, ...unique];
        return {
          ...prev,
          leads: merged,
          totalFound: merged.length,
        };
      });
    }, 300);
    return () => clearInterval(interval);
  }, []);

  const connectToStream = useCallback((searchId: string) => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const apiUrl = process.env.NEXT_PUBLIC_API_URL?.trim()?.replace(/\/$/, "") || getApiUrl();
    const streamUrl = `${apiUrl}/search/${searchId}/stream`;
    console.log("Connecting to SSE stream:", streamUrl);

    const es = new EventSource(streamUrl);
    eventSourceRef.current = es;

    es.onopen = () => {
      console.log("SSE connection opened");
    };

    es.onmessage = (event) => {
      console.log("SSE message received:", event.data);
      try {
        const data = JSON.parse(event.data) as {
          type: string;
          data?: BusinessLead;
          lead?: BusinessLead;
          message?: string;
          processed?: number;
          total?: number;
        };

        switch (data.type) {
          case "started":
            setState((prev) => ({
              ...prev,
              status: "running",
              message: formatSearchMessage(queryRef.current, locationRef.current),
            }));
            reconnectCountRef.current = 0;
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
            const phase = (data as { phase?: string }).phase ?? data.message;
            if (phase) {
              setState((prev) => ({ ...prev, message: phase }));
            }
            break;
          }

          case "complete":
            setState((prev) => ({
              ...prev,
              status: "completed",
              message:
                data.message ||
                `Search complete. Found ${data.total ?? prev.leads.length} businesses.`,
              totalFound: data.total ?? prev.leads.length,
            }));
            es.close();
            break;

          case "error":
            setState((prev) => ({
              ...prev,
              status: "error",
              error: data.message || "Search failed. Please try again.",
            }));
            es.close();
            break;
        }
      } catch (err) {
        console.error("Failed to parse SSE event", err);
      }
    };

    es.onerror = (err) => {
      console.error("SSE connection error:", err);
      es.close();
      if (reconnectCountRef.current < 3) {
        reconnectCountRef.current += 1;
        setState((prev) => ({
          ...prev,
          message: `Reconnecting... (attempt ${reconnectCountRef.current} of 3)`,
        }));
        setTimeout(() => {
          if (searchIdRef.current) {
            connectToStream(searchIdRef.current);
          }
        }, 3000);
      } else {
        setState((prev) => ({
          ...prev,
          status: "error",
          error: "Connection lost. Please try your search again.",
        }));
      }
    };
  }, []);

  const search = useCallback(
    async (query: string, location: string) => {
      console.log("useSearch.search called:", { query, location });

      if (!query.trim() || !location.trim()) {
        console.warn("Empty query or location");
        setState((prev) => ({
          ...prev,
          status: "error",
          error: "Please enter both business type and location.",
        }));
        return;
      }

      queryRef.current = query.trim();
      locationRef.current = location.trim();
      pendingLeadsRef.current = [];
      reconnectCountRef.current = 0;

      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }

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
        console.log("Calling startSearch...");
        const result = await startSearch(query.trim(), location.trim());
        console.log("startSearch result:", result);

        searchIdRef.current = result.searchId;

        setState((prev) => ({
          ...prev,
          searchId: result.searchId,
          searchesRemaining: result.searchesRemaining ?? null,
          message: formatSearchMessage(query.trim(), location.trim()),
        }));

        if (result.cached && result.status === "completed") {
          const { leads: cached } = await getResults(result.searchId);
          const mapped = cached.map((l) => sseLeadToBusinessLead(l));
          setState((prev) => ({
            ...prev,
            status: "completed",
            leads: mapped,
            totalFound: mapped.length,
            message: `Search complete. Found ${mapped.length} businesses.`,
          }));
          return;
        }

        connectToStream(result.searchId);
      } catch (err) {
        console.error("Search error:", err);
        setState((prev) => ({
          ...prev,
          status: "error",
          error: err instanceof Error ? err.message : "Failed to start search",
        }));
      }
    },
    [connectToStream]
  );

  const reset = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }
    pendingLeadsRef.current = [];
    searchIdRef.current = null;
    setState({
      status: "idle",
      leads: [],
      searchId: null,
      message: "",
      totalFound: 0,
      searchesRemaining: null,
      error: null,
    });
  }, []);

  useEffect(() => {
    return () => {
      eventSourceRef.current?.close();
    };
  }, []);

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
    progress: state.totalFound > 0 ? Math.min(99, state.totalFound) : isSearching ? 10 : 0,
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

function sseLeadToBusinessLead(lead: Lead): BusinessLead {
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
