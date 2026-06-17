"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import type { AreaSuggestion, BusinessLead } from "@leadthur/shared";
import { getResults, getSearch, SearchLimitError, startSearch } from "@/services/api";
import { getApiUrl } from "@/utils/env";
import { getLicenseQueryString } from "@/services/api";
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
const SEARCH_FAILED_MESSAGE =
  "Search did not complete. Please try a broader location or business type.";
const CONNECTION_LOST_MESSAGE =
  "Connection lost. Please try your search again.";

function mergePendingIntoLeads(
  current: BusinessLead[],
  pending: BusinessLead[]
): BusinessLead[] {
  if (pending.length === 0) return current;
  const byId = new Map(current.map((l) => [l.id, l]));
  for (const lead of pending) {
    if (lead.id) byId.set(lead.id, lead);
  }
  return [...byId.values()];
}

function normalizeSuggestions(
  raw: Array<AreaSuggestion | string>,
  fallbackQuery: string
): AreaSuggestion[] {
  return raw.map((item) => {
    if (typeof item !== "string") return item;
    const parts = item.split(" in ");
    if (parts.length >= 2) {
      const query = parts[0].trim();
      const location = parts.slice(1).join(" in ").trim();
      return { query, location, label: item };
    }
    return { query: fallbackQuery, location: item.trim(), label: item };
  });
}

export interface UseSearchOptions {
  onSearchComplete?: (
    leads: BusinessLead[],
    query: string,
    location: string,
    totalFound: number
  ) => void;
  onSearchLimitReached?: (creditsRemaining: number) => void;
}

export interface RunSearchOptions {
  accumulate?: boolean;
}

export function useSearch(options?: UseSearchOptions) {
  const onCompleteRef = useRef(options?.onSearchComplete);
  onCompleteRef.current = options?.onSearchComplete;
  const onLimitRef = useRef(options?.onSearchLimitReached);
  onLimitRef.current = options?.onSearchLimitReached;
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
  const ssePollFallbackRef = useRef(false);
  const searchIdRef = useRef<string | null>(null);
  const queryRef = useRef("");
  const locationRef = useRef("");
  const completedRef = useRef(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const finalFetchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [suggestions, setSuggestions] = useState<AreaSuggestion[]>([]);

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

  const stopFinalFetchTimer = useCallback(() => {
    if (finalFetchTimerRef.current) {
      clearTimeout(finalFetchTimerRef.current);
      finalFetchTimerRef.current = null;
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
    stopFinalFetchTimer();
  }, [stopPolling, stopTimeout, stopFinalFetchTimer]);

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
      const byId = new Map(prev.leads.map((l) => [l.id, l]));
      let changed = false;

      for (const lead of incoming) {
        if (!lead.id) continue;
        const existing = byId.get(lead.id);
        if (
          !existing ||
          existing.email !== lead.email ||
          existing.emailSource !== lead.emailSource ||
          existing.verifiedEmails.length !== lead.verifiedEmails.length ||
          existing.predictedEmails.length !== lead.predictedEmails.length
        ) {
          byId.set(lead.id, lead);
          changed = true;
        }
      }

      if (!changed) return prev;

      const merged = [...byId.values()];
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

  const replaceLeads = useCallback(
    (incoming: BusinessLead[]) => {
      const count = incoming.length;
      setState((prev) => ({
        ...prev,
        leads: incoming,
        totalFound: count,
        message: progressMessage(count, prev.status === "completed" ? "completed" : "running", prev.queuePosition),
      }));
    },
    [progressMessage]
  );

  const syncFromApi = useCallback(
    async (searchId: string, replace = false) => {
      const { leads: fetched } = await getResults(searchId, 1, 250);
      if (fetched.length === 0) return;
      const mapped = fetched.map((l) => leadRowToBusinessLead(l));
      if (replace) {
        replaceLeads(mapped);
      } else {
        mergeLeads(mapped);
      }
    },
    [mergeLeads, replaceLeads]
  );

  const fetchFinalResults = useCallback(
    async (searchId: string) => {
      const pending = pendingLeadsRef.current.splice(0);

      try {
        const limit = 250;
        let page = 1;
        let fetched: Lead[] = [];
        let dbCount = 0;

        while (true) {
          const batch = await getResults(searchId, page, limit);
          if (page === 1) dbCount = batch.total;
          fetched = fetched.concat(batch.leads);
          if (batch.leads.length < limit || fetched.length >= batch.total) break;
          page += 1;
        }

        const job = await getSearch(searchId).catch(() => null);
        const mapped = fetched.map((l) => leadRowToBusinessLead(l));
        const merged =
          pending.length > 0
            ? mergePendingIntoLeads(
                mapped.length > 0 ? mapped : [],
                pending
              )
            : mapped;

        const totalFound = Math.max(
          job?.totalFound ?? 0,
          dbCount,
          merged.length
        );

        if (merged.length > 0) {
          replaceLeads(merged);
        } else if (pending.length > 0) {
          mergeLeads(pending);
        }

        setState((prev) => {
          const leads = merged.length > 0 ? merged : prev.leads;
          const count = Math.max(totalFound, leads.length);
          onCompleteRef.current?.(
            leads,
            queryRef.current,
            locationRef.current,
            count
          );
          return {
            ...prev,
            leads,
            totalFound: count,
            status: "completed",
            queuePosition: 0,
            error: null,
            message: `Search complete. Found ${count} businesses.`,
          };
        });
      } catch {
        if (pending.length > 0) {
          mergeLeads(pending);
        }
      }
    },
    [mergeLeads, replaceLeads]
  );

  const scheduleFinalResultsFetch = useCallback(
    (searchId: string, delayMs = 3000) => {
      stopFinalFetchTimer();
      finalFetchTimerRef.current = setTimeout(() => {
        finalFetchTimerRef.current = null;
        void fetchFinalResults(searchId);
      }, delayMs);
    },
    [fetchFinalResults, stopFinalFetchTimer]
  );

  const finishSearch = useCallback(
    (total: number, message?: string) => {
      completedRef.current = true;
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      stopPolling();
      stopTimeout();

      const pending = pendingLeadsRef.current.splice(0);
      const searchId = searchIdRef.current;

      setState((prev) => {
        const merged = mergePendingIntoLeads(prev.leads, pending);
        const totalFound = Math.max(total || 0, merged.length);
        queueMicrotask(() => {
          onCompleteRef.current?.(
            merged,
            queryRef.current,
            locationRef.current,
            totalFound
          );
        });
        return {
          ...prev,
          leads: merged,
          status: "completed",
          totalFound,
          queuePosition: 0,
          error: null,
          message: message ?? progressMessage(totalFound, "completed", 0),
        };
      });

      if (searchId) {
        scheduleFinalResultsFetch(searchId, 3000);
      }
    },
    [stopPolling, stopTimeout, progressMessage, scheduleFinalResultsFetch]
  );

  const pollForResults = useCallback(
    async (searchId: string) => {
      if (completedRef.current) return;
      try {
        const { leads: fetched } = await getResults(searchId, 1, 250);
        if (fetched.length > 0) {
          const mapped = fetched.map((l) => leadRowToBusinessLead(l));
          replaceLeads(mapped);
          finishSearch(
            fetched.length,
            `Search complete. Found ${fetched.length} businesses.`
          );
        }
      } catch {
        /* silent fail */
      }
    },
    [replaceLeads, finishSearch]
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
              setState((prev) => {
                const pending = pendingLeadsRef.current.splice(0);
                const merged = mergePendingIntoLeads(prev.leads, pending);
                const count = Math.max(merged.length, job.totalFound ?? 0);
                if (count > 0) {
                  queueMicrotask(() =>
                    finishSearch(
                      count,
                      `Search complete. Found ${count} businesses.`
                    )
                  );
                  return {
                    ...prev,
                    leads: merged.length > 0 ? merged : prev.leads,
                    totalFound: count,
                    error: null,
                  };
                }
                completedRef.current = true;
                closeStream();
                return {
                  ...prev,
                  status: "error",
                  error: SEARCH_FAILED_MESSAGE,
                  message: SEARCH_FAILED_MESSAGE,
                };
              });
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

      const es = new EventSource(`${apiUrl}/search/${searchId}/stream${getLicenseQueryString()}`);
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
            businessId?: string;
            email?: string | null;
            emails?: string[];
            emailSource?: "website" | "predicted";
            suggestions?: Array<AreaSuggestion | string>;
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

            case "email_update": {
              const lead = data.lead ?? data.data;
              if (lead) {
                mergeLeads([lead]);
                break;
              }
              if (data.businessId) {
                setState((prev) => {
                  const byId = new Map(prev.leads.map((l) => [l.id, l]));
                  const existing = byId.get(data.businessId!);
                  if (!existing) return prev;
                  const emails = data.emails ?? [];
                  const emailSource =
                    data.emailSource ??
                    (emails.length > 0 ? "website" : existing.emailSource);
                  const isPredicted = emailSource === "predicted";
                  byId.set(data.businessId!, {
                    ...existing,
                    email: data.email ?? emails[0] ?? existing.email,
                    emails: emails.length > 0 ? emails : existing.emails,
                    verifiedEmails:
                      emails.length > 0 && !isPredicted
                        ? emails
                        : existing.verifiedEmails,
                    predictedEmails:
                      emails.length > 0 && isPredicted
                        ? emails.map((email) => ({
                            email,
                            confidence: 0,
                            label: "medium" as const,
                            source: "business_pattern" as const,
                          }))
                        : existing.predictedEmails,
                    emailSource,
                  });
                  return { ...prev, leads: [...byId.values()] };
                });
              }
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

            case "suggestions": {
              const raw = data.suggestions ?? [];
              if (raw.length > 0) {
                setSuggestions(
                  normalizeSuggestions(raw, queryRef.current)
                );
              }
              break;
            }

            case "error":
              setState((prev) => {
                const pending = pendingLeadsRef.current.splice(0);
                const merged = mergePendingIntoLeads(prev.leads, pending);
                if (merged.length > 0) {
                  queueMicrotask(() =>
                    finishSearch(
                      merged.length,
                      `Found ${merged.length} businesses.`
                    )
                  );
                  return {
                    ...prev,
                    leads: merged,
                    totalFound: merged.length,
                    error: null,
                  };
                }
                completedRef.current = true;
                closeStream();
                return {
                  ...prev,
                  status: "error",
                  error: data.message || SEARCH_FAILED_MESSAGE,
                  message: SEARCH_FAILED_MESSAGE,
                };
              });
              break;
          }
        } catch {
          /* ignore malformed SSE payloads */
        }
      };

      es.onerror = () => {
        es.close();
        eventSourceRef.current = null;

        const activeSearchId = searchIdRef.current;
        if (completedRef.current) {
          if (activeSearchId) {
            scheduleFinalResultsFetch(activeSearchId, 3000);
          }
          return;
        }

        let hadResults = false;
        setState((prev) => {
          const pending = pendingLeadsRef.current.splice(0);
          const merged = mergePendingIntoLeads(prev.leads, pending);
          if (merged.length > 0) {
            hadResults = true;
            return {
              ...prev,
              leads: merged,
              totalFound: merged.length,
              status: "completed",
              error: null,
              message: `Search complete. Found ${merged.length} businesses.`,
            };
          }
          return prev;
        });

        if (hadResults && activeSearchId) {
          completedRef.current = true;
          stopPolling();
          stopTimeout();
          scheduleFinalResultsFetch(activeSearchId, 3000);
          return;
        }

        const searchId = searchIdRef.current;
        if (searchId && !ssePollFallbackRef.current) {
          ssePollFallbackRef.current = true;
          void pollForResults(searchId);
        }

        if (reconnectCountRef.current < 3) {
          reconnectCountRef.current += 1;
          setTimeout(() => {
            if (searchIdRef.current && !completedRef.current) {
              connectToStream(searchIdRef.current);
            }
          }, 3000);
          return;
        }

        setState((prev) => {
          const pending = pendingLeadsRef.current.splice(0);
          const merged = mergePendingIntoLeads(prev.leads, pending);
          if (merged.length > 0) {
            return {
              ...prev,
              leads: merged,
              totalFound: merged.length,
              status: "completed",
              error: null,
              message: `Search complete. Found ${merged.length} businesses.`,
            };
          }
          completedRef.current = true;
          closeStream();
          return {
            ...prev,
            status: "error",
            error: CONNECTION_LOST_MESSAGE,
            message: CONNECTION_LOST_MESSAGE,
          };
        });

        const reconnectSearchId = searchIdRef.current;
        if (reconnectSearchId) {
          scheduleFinalResultsFetch(reconnectSearchId, 3000);
        }
      };
    },
    [
      closeStream,
      finishSearch,
      progressMessage,
      pollForResults,
      mergeLeads,
      scheduleFinalResultsFetch,
      stopPolling,
      stopTimeout,
    ]
  );

  const search = useCallback(
    async (
      query: string,
      location: string,
      runOptions?: RunSearchOptions
    ) => {
      if (!query.trim() || !location.trim()) {
        setState((prev) => ({
          ...prev,
          status: "error",
          error: "Please enter both business type and location.",
        }));
        return;
      }

      const accumulate = runOptions?.accumulate === true;

      closeStream();
      completedRef.current = false;
      if (!accumulate) {
        setSuggestions([]);
      }
      queryRef.current = query.trim();
      locationRef.current = location.trim();
      pendingLeadsRef.current = [];
      reconnectCountRef.current = 0;
      ssePollFallbackRef.current = false;
      searchIdRef.current = null;

      setState((prev) => ({
        status: "starting",
        leads: accumulate ? prev.leads : [],
        searchId: null,
        message: progressMessage(
          accumulate ? prev.leads.length : 0,
          "running",
          0
        ),
        totalFound: accumulate ? prev.leads.length : 0,
        searchesRemaining: prev.searchesRemaining,
        queuePosition: 0,
        error: null,
      }));

      try {
        const result = await startSearch(query.trim(), location.trim());
        searchIdRef.current = result.searchId;
        const queuePosition = result.queuePosition ?? 0;

        if (result.cached && result.status === "completed") {
          const { leads: cached } = await getResults(result.searchId);
          const mapped = cached.map((l) => leadRowToBusinessLead(l));
          setState((prev) => {
            const merged = accumulate
              ? [...prev.leads, ...mapped.filter((l) => !prev.leads.some((p) => p.id === l.id))]
              : mapped;
            const totalFound = result.totalFound ?? merged.length;
            onCompleteRef.current?.(
              merged,
              queryRef.current,
              locationRef.current,
              totalFound
            );
            return {
              status: "completed",
              leads: merged,
              searchId: result.searchId,
              message: `Found ${result.totalFound ?? mapped.length} businesses instantly from recent search`,
              totalFound,
              searchesRemaining: result.searchesRemaining ?? null,
              queuePosition: 0,
              error: null,
            };
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
            setState((prev) => {
              const pending = pendingLeadsRef.current.splice(0);
              const merged = mergePendingIntoLeads(prev.leads, pending);
              if (merged.length > 0) {
                queueMicrotask(() =>
                  finishSearch(
                    merged.length,
                    `Search timed out but ${merged.length} results were saved.`
                  )
                );
                return { ...prev, leads: merged, totalFound: merged.length };
              }
              completedRef.current = true;
              closeStream();
              return {
                ...prev,
                status: "error",
                error: SEARCH_FAILED_MESSAGE,
                message: SEARCH_FAILED_MESSAGE,
              };
            });
          })();
        }, SEARCH_TIMEOUT_MS);
      } catch (err) {
        closeStream();
        if (err instanceof SearchLimitError) {
          onLimitRef.current?.(err.creditsRemaining);
          setState((prev) => ({
            ...prev,
            status: "error",
            error: err.message,
            message: progressMessage(0, "failed", 0),
          }));
          return;
        }
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

  const runSearchWithSuggestion = useCallback(
    (suggestion: string | AreaSuggestion) => {
      const label = typeof suggestion === "string" ? suggestion : suggestion.label;
      const parts = label.split(" in ");
      if (parts.length >= 2) {
        const newQuery = parts[0].trim();
        const newLocation = parts.slice(1).join(" in ").trim();
        void search(newQuery, newLocation, { accumulate: true });
        return;
      }
      if (typeof suggestion !== "string") {
        void search(suggestion.query, suggestion.location, { accumulate: true });
      }
    },
    [search]
  );

  const reset = useCallback(() => {
    closeStream();
    searchIdRef.current = null;
    pendingLeadsRef.current = [];
    queryRef.current = "";
    locationRef.current = "";
    setSuggestions([]);
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

  const clearResults = useCallback(() => {
    closeStream();
    searchIdRef.current = null;
    pendingLeadsRef.current = [];
    setSuggestions([]);
    setState((prev) => ({
      ...prev,
      status: "idle",
      leads: [],
      searchId: null,
      message: "",
      totalFound: 0,
      queuePosition: 0,
      error: null,
    }));
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
    runSearchWithSuggestion,
    suggestions,
    setSuggestions,
    clearSuggestions: () => setSuggestions([]),
    clearResults,
    closeStream: closeStream,
    reset,
    loadSavedLeads,
    showLimitMessage:
      !!state.error &&
      (state.error.includes("limit") ||
        state.error.includes("Monthly") ||
        state.error.includes("search limit") ||
        state.error.includes("all your searches")),
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
    emails: lead.emails ?? lead.verified_emails ?? [],
    verifiedEmails: lead.verified_emails ?? lead.emails ?? [],
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
