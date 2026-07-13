"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import type { AreaSuggestion, BusinessLead, CitySelectionSuggestion, NearbyCitySuggestion, SearchStatsSummary } from "@leadthur/shared";
import { getResults, getRegionHint, getSearch, pollSearchResults, probeSearchAccess, SearchLimitError, startSearch } from "@/services/api";
import { getApiUrl } from "@/utils/env";
import { getLicenseQueryString } from "@/services/api";
import {
  getSearchProgressMessage,
  getSearchProgressPercent,
} from "@/utils/search-progress-messages";
import { businessLeadToLead } from "@/types/lead";
import type { Lead } from "@/types/lead";
import { normalizeApiBusinessLead, normalizeApiBusinessLeads } from "@/utils/normalize-api-lead";

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
  scrapingInProgress: boolean;
  emailScrapingComplete: boolean;
  summary: SearchStatsSummary | null;
  nearbyCities: NearbyCitySuggestion[];
  regionCitySuggestions: CitySelectionSuggestion[];
  regionSelectionMessage: string | null;
}

const POLL_INTERVAL_MS = 5000;
const SCRAPING_POLL_INTERVAL_MS = 5000;
const SEARCH_TIMEOUT_MS = 10 * 60 * 1000;
const SEARCH_FAILED_MESSAGE =
  "Search did not complete. Please try a broader location or business type.";
const CONNECTION_LOST_MESSAGE =
  "Connection lost. Please try your search again.";
const SEARCH_ACCESS_DENIED_MESSAGE =
  "Unable to load this search. Please refresh the page and try again.";

function placeIdFromLead(lead: BusinessLead): string {
  const url = lead.googleMapsUrl ?? "";
  const match = url.match(/\/maps\/place\/([^/?]+)/);
  if (match) {
    try {
      return decodeURIComponent(match[1]);
    } catch {
      return match[1];
    }
  }
  return lead.id;
}

function mergePollLeads(
  existing: BusinessLead[],
  incoming: BusinessLead[]
): BusinessLead[] {
  const byPlace = new Map<string, BusinessLead>();
  for (const lead of existing) {
    byPlace.set(placeIdFromLead(lead), lead);
  }
  for (const lead of incoming) {
    const normalized = normalizeApiBusinessLead(lead);
    const key = placeIdFromLead(normalized);
    const prev = byPlace.get(key);
    byPlace.set(
      key,
      prev
        ? {
            ...prev,
            ...normalized,
            id: prev.id || normalized.id,
            email: normalized.email ?? prev.email,
            emails: normalized.emails?.length ? normalized.emails : prev.emails,
            verifiedEmails: normalized.verifiedEmails?.length
              ? normalized.verifiedEmails
              : prev.verifiedEmails,
            predictedEmails: normalized.predictedEmails?.length
              ? normalized.predictedEmails
              : prev.predictedEmails,
            emailSource: normalized.emailSource ?? prev.emailSource,
            emailScraped: normalized.emailScraped || prev.emailScraped,
          }
        : normalized
    );
  }
  return [...byPlace.values()];
}

function mergePendingIntoLeads(
  current: BusinessLead[],
  pending: BusinessLead[],
  activeSearchId: string | null
): BusinessLead[] {
  if (pending.length === 0) return current;
  const filtered = activeSearchId
    ? pending.filter((l) => !l.searchId || l.searchId === activeSearchId)
    : pending;
  if (filtered.length === 0) return current;
  const byId = new Map(current.map((l) => [l.id, l]));
  for (const lead of filtered) {
    if (lead.id) byId.set(lead.id, lead);
  }
  return [...byId.values()];
}

function filterLeadsForSearch(
  leads: BusinessLead[],
  searchId: string | null
): BusinessLead[] {
  if (!searchId) return [];
  return leads.filter((l) => !l.searchId || l.searchId === searchId);
}

function normalizeExpansionLocation(location: string): string {
  return location.toLowerCase().replace(/\s+/g, " ").trim();
}

function registerExpansionLocation(
  prev: string[],
  location: string,
  reset: boolean
): string[] {
  const key = normalizeExpansionLocation(location);
  if (!key) return reset ? [] : prev;
  if (reset) return [key];
  return prev.includes(key) ? prev : [...prev, key];
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
    scrapingInProgress: false,
    emailScrapingComplete: true,
    summary: null,
    nearbyCities: [],
    regionCitySuggestions: [],
    regionSelectionMessage: null,
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
  const accumulateRef = useRef(false);

  function leadDisplayKey(lead: BusinessLead): string {
    return `${lead.name?.toLowerCase().trim() ?? ""}-${(lead.phone ?? "").replace(/\s/g, "")}`;
  }

  function dedupeLeadsList(leads: BusinessLead[]): BusinessLead[] {
    const seen = new Set<string>();
    const out: BusinessLead[] = [];
    for (const lead of leads) {
      const key = leadDisplayKey(lead);
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(lead);
    }
    return out;
  }
  const [suggestions, setSuggestions] = useState<AreaSuggestion[]>([]);
  const [searchedExpansionLocations, setSearchedExpansionLocations] = useState<
    string[]
  >([]);
  const scrapingPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopScrapingPoll = useCallback(() => {
    if (scrapingPollRef.current) {
      clearInterval(scrapingPollRef.current);
      scrapingPollRef.current = null;
    }
  }, []);

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
    stopScrapingPoll();
  }, [stopPolling, stopTimeout, stopFinalFetchTimer, stopScrapingPoll]);

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

  const loadSoftRegionSuggestions = useCallback(
    async (query: string, location: string, totalFound: number) => {
      if (totalFound >= 50) {
        setState((prev) => ({
          ...prev,
          regionCitySuggestions: [],
          regionSelectionMessage: null,
        }));
        return;
      }

      try {
        const hint = await getRegionHint(query, location, totalFound);
        if (hint.showRegionSuggestions && hint.citySuggestions.length > 0) {
          setState((prev) => ({
            ...prev,
            regionCitySuggestions: hint.citySuggestions,
            regionSelectionMessage: hint.message || null,
          }));
        } else {
          setState((prev) => ({
            ...prev,
            regionCitySuggestions: [],
            regionSelectionMessage: null,
          }));
        }
      } catch {
        /* optional hint */
      }
    },
    []
  );

  const mergeLeads = useCallback((incoming: BusinessLead[]) => {
    const activeId = searchIdRef.current;
    const filtered = accumulateRef.current
      ? incoming
      : filterLeadsForSearch(incoming, activeId);
    if (filtered.length === 0) return;
    setState((prev) => {
      if (!accumulateRef.current && activeId && prev.searchId && prev.searchId !== activeId) {
        return prev;
      }

      if (accumulateRef.current) {
        const merged = dedupeLeadsList([...prev.leads, ...filtered]);
        const count = merged.length;
        return {
          ...prev,
          leads: merged,
          totalFound: count,
          status: prev.status === "starting" ? "running" : prev.status,
          message: progressMessage(count, "running", prev.queuePosition),
        };
      }

      const byId = new Map(prev.leads.map((l) => [l.id, l]));
      let changed = false;

      for (const lead of filtered) {
        if (!lead.id) continue;
        const normalized = normalizeApiBusinessLead(lead);
        const existing = byId.get(normalized.id);
        if (
          !existing ||
          existing.email !== normalized.email ||
          existing.emailSource !== normalized.emailSource ||
          existing.verifiedEmails.length !== normalized.verifiedEmails.length ||
          existing.predictedEmails.length !== normalized.predictedEmails.length ||
          existing.emails.length !== normalized.emails.length
        ) {
          byId.set(normalized.id, normalized);
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
    (incoming: BusinessLead[], searchId?: string | null) => {
      const activeId = searchId ?? searchIdRef.current;
      if (!activeId || activeId !== searchIdRef.current) return;
      const filtered = accumulateRef.current
        ? incoming
        : filterLeadsForSearch(incoming, activeId);
      setState((prev) => {
        if (!accumulateRef.current && prev.searchId && prev.searchId !== activeId) {
          return prev;
        }
        const leads = accumulateRef.current
          ? dedupeLeadsList([...prev.leads, ...filtered])
          : filtered;
        const count = leads.length;
        return {
          ...prev,
          leads,
          totalFound: count,
          searchId: activeId,
          message: progressMessage(
            count,
            prev.status === "completed" ? "completed" : "running",
            prev.queuePosition
          ),
        };
      });
    },
    [progressMessage]
  );

  const syncFromApi = useCallback(
    async (searchId: string, replace = false) => {
      if (searchId !== searchIdRef.current) return;
      const payload = await pollSearchResults(searchId, 1, 1000);
      if (searchId !== searchIdRef.current) return;
      if (payload.leads.length === 0) return;
      const mapped = normalizeApiBusinessLeads(payload.leads);
      if (replace) {
        replaceLeads(mapped, searchId);
      } else {
        mergeLeads(mapped);
      }
    },
    [mergeLeads, replaceLeads]
  );

  const fetchFinalResults = useCallback(
    async (searchId: string, attempt = 0) => {
      if (searchId !== searchIdRef.current) return;
      const pending = pendingLeadsRef.current.splice(0);

      try {
        const limit = 1000;
        let page = 1;
        let fetched: BusinessLead[] = [];
        let reportedTotal = 0;

        while (true) {
          const payload = await pollSearchResults(searchId, page, limit);
          if (searchId !== searchIdRef.current) return;
          reportedTotal = Math.max(reportedTotal, payload.totalFound ?? 0);
          fetched = fetched.concat(normalizeApiBusinessLeads(payload.leads));
          if (payload.leads.length < limit || fetched.length >= payload.totalFound) {
            break;
          }
          page += 1;
        }

        if (searchId !== searchIdRef.current) return;
        const merged =
          pending.length > 0
            ? mergePendingIntoLeads(
                fetched.length > 0 ? fetched : [],
                pending.map((lead) => normalizeApiBusinessLead(lead)),
                searchId
              )
            : fetched;

        // Prefer the live DB count from the API over in-memory length.
        const totalFound = Math.max(merged.length, reportedTotal);

        if (merged.length > 0) {
          replaceLeads(merged, searchId);
        } else if (pending.length > 0) {
          mergeLeads(pending.map((lead) => normalizeApiBusinessLead(lead)));
        }

        setState((prev) => {
          if (searchId !== searchIdRef.current || prev.searchId !== searchId) {
            return prev;
          }
          const leads = merged.length > 0 ? merged : prev.leads;
          const count = Math.max(leads.length, totalFound, prev.totalFound);
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
            message:
              count === 0
                ? "No potential clients found in this area. Try a nearby city."
                : `We found ${count.toLocaleString()} potential clients for you.`,
          };
        });

        // If the API reported more rows than we received, retry once.
        if (merged.length < reportedTotal && attempt < 2) {
          window.setTimeout(() => {
            void fetchFinalResults(searchId, attempt + 1);
          }, 2000);
        }
      } catch {
        if (searchId !== searchIdRef.current) return;
        if (pending.length > 0) {
          mergeLeads(pending.map((lead) => normalizeApiBusinessLead(lead)));
        }
        // Do not leave a partial SSE subset as the final list — retry.
        if (attempt < 3) {
          window.setTimeout(() => {
            void fetchFinalResults(searchId, attempt + 1);
          }, 2000 * (attempt + 1));
        }
      }
    },
    [mergeLeads, replaceLeads]
  );

  const scheduleFinalResultsFetch = useCallback(
    (searchId: string, delayMs = 3000) => {
      stopFinalFetchTimer();
      if (delayMs <= 0) {
        void fetchFinalResults(searchId);
        return;
      }
      finalFetchTimerRef.current = setTimeout(() => {
        finalFetchTimerRef.current = null;
        void fetchFinalResults(searchId);
      }, delayMs);
    },
    [fetchFinalResults, stopFinalFetchTimer]
  );

  const finishSearch = useCallback(
    (total: number, message?: string) => {
      const activeId = searchIdRef.current;
      if (!activeId) return;
      completedRef.current = true;
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      stopPolling();
      stopTimeout();
      stopScrapingPoll();

      const pending = pendingLeadsRef.current.splice(0);

      setState((prev) => {
        if (prev.searchId && prev.searchId !== activeId) return prev;
        const merged = mergePendingIntoLeads(prev.leads, pending, activeId);
        // Never discard the authoritative server total in favour of the SSE
        // subset still held in memory — that caused "141 found" with 6 table rows.
        const totalFound = Math.max(total, merged.length, prev.totalFound);
        queueMicrotask(() => {
          void loadSoftRegionSuggestions(
            queryRef.current,
            locationRef.current,
            totalFound
          );
        });
        return {
          ...prev,
          // Keep existing leads until fetchFinalResults replaces with the full DB set.
          leads: merged,
          status: "completed",
          totalFound,
          queuePosition: 0,
          error: null,
          scrapingInProgress: false,
          emailScrapingComplete: true,
          message:
            message ??
            (totalFound === 0
              ? "No potential clients found in this area. Try a nearby city."
              : `We found ${totalFound.toLocaleString()} potential clients for you.`),
        };
      });

      scheduleFinalResultsFetch(activeId, 0);
      scheduleFinalResultsFetch(activeId, 3000);
    },
    [stopPolling, stopTimeout, stopScrapingPoll, scheduleFinalResultsFetch, loadSoftRegionSuggestions]
  );

  const startResultsPoll = useCallback(
    (searchId: string) => {
      stopScrapingPoll();
      scrapingPollRef.current = setInterval(() => {
        void (async () => {
          if (searchId !== searchIdRef.current) return;
          try {
            const payload = await pollSearchResults(searchId);
            if (searchId !== searchIdRef.current) return;

            setState((prev) => {
              if (prev.searchId !== searchId) return prev;
              const merged =
                payload.leads.length > 0
                  ? mergePollLeads(
                      prev.leads,
                      normalizeApiBusinessLeads(payload.leads)
                    )
                  : prev.leads;
              const count = Math.max(merged.length, payload.totalFound);
              const mapsRunning = payload.scrapingInProgress;
              const emailDone = payload.emailScrapingComplete;
              return {
                ...prev,
                leads: merged,
                totalFound: count,
                message: progressMessage(
                  count,
                  !emailDone || mapsRunning ? "running" : "completed",
                  prev.queuePosition
                ),
                queuePosition: payload.queuePosition,
                summary: payload.summary ?? prev.summary,
                nearbyCities: payload.nearbyCities ?? prev.nearbyCities,
                scrapingInProgress: payload.scrapingInProgress,
                emailScrapingComplete: emailDone,
                status:
                  !emailDone || mapsRunning ? "running" : prev.status,
              };
            });

            if (
              !payload.scrapingInProgress &&
              payload.emailScrapingComplete &&
              (payload.status === "completed" || payload.totalFound > 0)
            ) {
              const count = Math.max(payload.totalFound, payload.leads.length);
              finishSearch(
                count,
                count === 0
                  ? "No potential clients found in this area. Try a nearby city."
                  : `We found ${count.toLocaleString()} potential clients for you.`
              );
            }
          } catch {
            /* best-effort */
          }
        })();
      }, SCRAPING_POLL_INTERVAL_MS);
    },
    [finishSearch, progressMessage, stopScrapingPoll]
  );

  const phase1Complete = useCallback(
    (_total: number, message?: string) => {
      const activeId = searchIdRef.current;
      if (!activeId) return;
      const pending = pendingLeadsRef.current.splice(0);

      setState((prev) => {
        if (prev.searchId && prev.searchId !== activeId) return prev;
        const merged = mergePendingIntoLeads(prev.leads, pending, activeId);
        const totalFound = merged.length;
        return {
          ...prev,
          leads: merged,
          status: "running",
          totalFound,
          queuePosition: 0,
          error: null,
          scrapingInProgress: true,
          emailScrapingComplete: false,
          message:
            message ??
            progressMessage(totalFound, "running", 0),
        };
      });

      startResultsPoll(activeId);
    },
    [progressMessage, startResultsPoll]
  );

  const pollForResults = useCallback(
    async (searchId: string) => {
      if (completedRef.current || searchId !== searchIdRef.current) return;
      try {
        const payload = await pollSearchResults(searchId, 1, 1000);
        if (searchId !== searchIdRef.current) return;
        if (payload.leads.length > 0) {
          const mapped = normalizeApiBusinessLeads(payload.leads);
          replaceLeads(mapped, searchId);
          finishSearch(
            mapped.length,
            mapped.length === 0
              ? "No potential clients found in this area. Try a nearby city."
              : `We found ${mapped.length.toLocaleString()} potential clients for you.`
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
        if (completedRef.current || searchId !== searchIdRef.current) return;
        void (async () => {
          try {
            // Status only — results are polled separately by startResultsPoll.
            // Calling syncFromApi here doubled /search traffic and tripped RATE_LIMIT_MAX.
            const job = await getSearch(searchId);
            if (searchId !== searchIdRef.current) return;

            if (
              job.status === "completed" &&
              !job.scrapingInProgress &&
              job.emailScrapingComplete
            ) {
              setState((prev) => {
                if (prev.searchId !== searchId) return prev;
                const count = Math.max(prev.leads.length, prev.totalFound, job.totalFound ?? 0);
                queueMicrotask(() =>
                  finishSearch(
                    count,
                    count === 0
                      ? "No potential clients found in this area. Try a nearby city."
                      : `We found ${count.toLocaleString()} potential clients for you.`
                  )
                );
                return prev;
              });
            } else if (job.status === "failed") {
              setState((prev) => {
                if (prev.searchId !== searchId) return prev;
                const pending = pendingLeadsRef.current.splice(0);
                const merged = mergePendingIntoLeads(prev.leads, pending, searchId);
                const count = merged.length;
                if (count > 0) {
                  queueMicrotask(() =>
                    finishSearch(
                      count,
                      `We found ${count.toLocaleString()} potential clients for you.`
                    )
                  );
                  return {
                    ...prev,
                    leads: merged,
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
            /* polling is best-effort — including 429; results poller keeps trying */
          }
        })();
      }, POLL_INTERVAL_MS);
    },
    [stopPolling, finishSearch, closeStream]
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
        if (searchId !== searchIdRef.current) return;
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
              if (lead) {
                pendingLeadsRef.current.push({
                  ...normalizeApiBusinessLead(lead),
                  searchId:
                    normalizeApiBusinessLead(lead).searchId || searchId,
                });
              }
              break;
            }

            case "email_update": {
              const lead = data.lead ?? data.data;
              if (lead) {
                mergeLeads([normalizeApiBusinessLead(lead)]);
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

            case "complete": {
              const total = data.total ?? 0;
              const isPhase1 =
                data.message?.toLowerCase().includes("background") ||
                data.message?.toLowerCase().includes("email");
              if (isPhase1) {
                phase1Complete(total, data.message);
              } else {
                finishSearch(
                  total,
                  data.message ?? progressMessage(total, "completed", 0)
                );
              }
              break;
            }

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
                if (prev.searchId !== searchId) return prev;
                const pending = pendingLeadsRef.current.splice(0);
                const merged = mergePendingIntoLeads(prev.leads, pending, searchId);
                if (merged.length > 0) {
                  queueMicrotask(() =>
                    finishSearch(
                      merged.length,
                      `We found ${merged.length.toLocaleString()} potential clients for you.`
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
          if (prev.searchId !== searchId) return prev;
          const pending = pendingLeadsRef.current.splice(0);
          const merged = mergePendingIntoLeads(prev.leads, pending, searchId);
          if (merged.length > 0) {
            hadResults = true;
            return {
              ...prev,
              leads: merged,
              totalFound: merged.length,
              status: "completed",
              error: null,
              message:
                merged.length === 0
                  ? "No potential clients found in this area. Try a nearby city."
                  : `We found ${merged.length.toLocaleString()} potential clients for you.`,
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

        void (async () => {
          const activeId = searchIdRef.current;
          const access = activeId ? await probeSearchAccess(activeId) : "unknown";
          const errorMessage =
            access === "auth" ? SEARCH_ACCESS_DENIED_MESSAGE : CONNECTION_LOST_MESSAGE;

          setState((prev) => {
            if (prev.searchId !== activeId) return prev;
            const pending = pendingLeadsRef.current.splice(0);
            const merged = mergePendingIntoLeads(prev.leads, pending, activeId);
            if (merged.length > 0) {
              return {
                ...prev,
                leads: merged,
                totalFound: merged.length,
                status: "completed",
                error: null,
                message:
                merged.length === 0
                  ? "No potential clients found in this area. Try a nearby city."
                  : `We found ${merged.length.toLocaleString()} potential clients for you.`,
              };
            }
            completedRef.current = true;
            closeStream();
            return {
              ...prev,
              status: "error",
              error: errorMessage,
              message: errorMessage,
            };
          });

          if (activeId) {
            scheduleFinalResultsFetch(activeId, 3000);
          }
        })();
      };
    },
    [
      closeStream,
      finishSearch,
      phase1Complete,
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
      accumulateRef.current = accumulate;

      closeStream();
      completedRef.current = false;
      if (!accumulate) {
        setSuggestions([]);
      }
      queryRef.current = query.trim();
      locationRef.current = location.trim();
      setSearchedExpansionLocations((prev) =>
        registerExpansionLocation(prev, location.trim(), !accumulate)
      );
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
        scrapingInProgress: false,
        emailScrapingComplete: false,
        summary: null,
        nearbyCities: [],
        regionCitySuggestions: [],
        regionSelectionMessage: null,
      }));

      try {
        const result = await startSearch(query.trim(), location.trim());

        searchIdRef.current = result.searchId;
        const queuePosition = result.queuePosition ?? 0;

        if (result.cached && result.status === "completed") {
          const payload = await pollSearchResults(result.searchId, 1, 1000);
          if (result.searchId !== searchIdRef.current) return;
          const mapped = normalizeApiBusinessLeads(payload.leads).map((l) => ({
            ...l,
            searchId: l.searchId ?? result.searchId,
          }));
          const filtered = filterLeadsForSearch(mapped, result.searchId);
          setState((prev) => {
            const merged = accumulate
              ? dedupeLeadsList([...prev.leads, ...filtered])
              : filtered;
            const totalFound = merged.length;
            onCompleteRef.current?.(
              merged,
              queryRef.current,
              locationRef.current,
              totalFound
            );
            void loadSoftRegionSuggestions(
              queryRef.current,
              locationRef.current,
              totalFound
            );
            return {
              status: "completed",
              leads: merged,
              searchId: result.searchId,
              message: `Found ${totalFound.toLocaleString()} potential clients instantly from recent search`,
              totalFound,
              searchesRemaining: result.searchesRemaining ?? null,
              queuePosition: 0,
              error: null,
              scrapingInProgress: false,
              emailScrapingComplete: true,
              summary: null,
              nearbyCities: [],
      regionCitySuggestions: [],
      regionSelectionMessage: null,
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
          emailScrapingComplete: false,
          message: progressMessage(0, queuePosition > 0 ? "queued" : "running", queuePosition),
        }));

        connectToStream(result.searchId);
        startPolling(result.searchId);
        startResultsPoll(result.searchId);

        stopTimeout();
        timeoutRef.current = setTimeout(() => {
          if (completedRef.current || result.searchId !== searchIdRef.current) return;
          void (async () => {
            try {
              await syncFromApi(result.searchId);
              if (result.searchId !== searchIdRef.current) return;
              const { leads: saved } = await getResults(result.searchId);
              if (result.searchId !== searchIdRef.current) return;
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
            if (result.searchId !== searchIdRef.current) return;
            setState((prev) => {
              if (prev.searchId !== result.searchId) return prev;
              const pending = pendingLeadsRef.current.splice(0);
              const merged = mergePendingIntoLeads(
                prev.leads,
                pending,
                result.searchId
              );
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
    [closeStream, connectToStream, startPolling, startResultsPoll, stopTimeout, syncFromApi, finishSearch, progressMessage, loadSoftRegionSuggestions]
  );

  const runSearchWithNearbyCity = useCallback(
    (city: string) => {
      void search(queryRef.current || "businesses", city, {
        accumulate: true,
      });
    },
    [search]
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

  const runSearchWithRegionCity = useCallback(
    (city: string) => {
      setState((prev) => ({
        ...prev,
        regionCitySuggestions: [],
        regionSelectionMessage: null,
      }));
      void search(queryRef.current || "businesses", city);
    },
    [search]
  );

  const reset = useCallback(() => {
    accumulateRef.current = false;
    closeStream();
    searchIdRef.current = null;
    pendingLeadsRef.current = [];
    queryRef.current = "";
    locationRef.current = "";
    setSuggestions([]);
    setSearchedExpansionLocations([]);
    setState({
      status: "idle",
      leads: [],
      searchId: null,
      message: "",
      totalFound: 0,
      searchesRemaining: null,
      queuePosition: 0,
      error: null,
      scrapingInProgress: false,
      emailScrapingComplete: true,
      summary: null,
      nearbyCities: [],
      regionCitySuggestions: [],
      regionSelectionMessage: null,
    });
  }, [closeStream]);

  const clearResults = useCallback(() => {
    accumulateRef.current = false;
    closeStream();
    searchIdRef.current = null;
    pendingLeadsRef.current = [];
    setSuggestions([]);
    setSearchedExpansionLocations([]);
    setState((prev) => ({
      ...prev,
      status: "idle",
      leads: [],
      searchId: null,
      message: "",
      totalFound: 0,
      queuePosition: 0,
      error: null,
      scrapingInProgress: false,
      emailScrapingComplete: true,
      summary: null,
      nearbyCities: [],
      regionCitySuggestions: [],
      regionSelectionMessage: null,
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
      scrapingInProgress: false,
      emailScrapingComplete: true,
      summary: null,
      nearbyCities: [],
      regionCitySuggestions: [],
      regionSelectionMessage: null,
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
    runSearchWithNearbyCity,
    runSearchWithRegionCity,
    suggestions,
    searchedExpansionLocations,
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
    emailScraped: lead.email_scraped ?? false,
    createdAt: lead.created_at,
  };
}
