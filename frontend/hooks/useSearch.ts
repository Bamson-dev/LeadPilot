"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Lead } from "@/types/lead";
import {
  checkHealth,
  getResults,
  getSearch,
  startSearch,
  streamResults,
} from "@/services/api";

const POLL_INTERVAL_MS = 8000;
const LEAD_BATCH_MS = 300;

export function useSearch() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [showLimitMessage, setShowLimitMessage] = useState(false);
  const [phaseMessage, setPhaseMessage] = useState<string | null>(null);
  const [searchMeta, setSearchMeta] = useState({ business: "", location: "" });
  const [totalFound, setTotalFound] = useState(0);
  const [searchesRemaining, setSearchesRemaining] = useState<number | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const searchIdRef = useRef<string | null>(null);
  const leadIdsRef = useRef<Set<string>>(new Set());
  const pendingLeads = useRef<Lead[]>([]);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const closeStream = useCallback(() => {
    cleanupRef.current?.();
    cleanupRef.current = null;
    stopPolling();
  }, [stopPolling]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (pendingLeads.current.length === 0) return;
      const batch = pendingLeads.current.splice(0, pendingLeads.current.length);
      setLeads((prev) => {
        const existingIds = new Set(prev.map((l) => l.id));
        const newLeads = batch.filter((l) => !existingIds.has(l.id));
        if (newLeads.length === 0) return prev;
        for (const lead of newLeads) {
          leadIdsRef.current.add(lead.id);
        }
        return [...prev, ...newLeads];
      });
    }, LEAD_BATCH_MS);
    return () => clearInterval(interval);
  }, []);

  const queueLead = useCallback((lead: Lead) => {
    if (leadIdsRef.current.has(lead.id)) return;
    pendingLeads.current.push(lead);
  }, []);

  const syncFromResults = useCallback(async (searchId: string) => {
    try {
      const { leads: fetched, total } = await getResults(searchId);
      if (fetched.length > 0) {
        for (const lead of fetched) {
          queueLead(lead);
        }
        setTotalFound(total);
        setProgress(Math.min(100, total > 0 ? (fetched.length / total) * 100 : 0));
      }
    } catch {
      /* polling is best-effort */
    }
  }, [queueLead]);

  const startPolling = useCallback(
    (searchId: string) => {
      stopPolling();
      pollRef.current = setInterval(() => {
        void syncFromResults(searchId);
        void getSearch(searchId).then((job) => {
          if (job.status === "completed") {
            stopPolling();
            void syncFromResults(searchId).then(() => {
              setProgress(100);
              setPhaseMessage(`Search complete — ${job.totalFound} businesses found.`);
              setIsSearching(false);
              closeStream();
            });
          } else if (job.status === "failed") {
            stopPolling();
            setError(job.error ?? "Search failed");
            setIsSearching(false);
            closeStream();
          } else if (job.processed > 0) {
            setPhaseMessage(`Found ${job.processed} businesses so far…`);
          }
        });
      }, POLL_INTERVAL_MS);
    },
    [stopPolling, syncFromResults, closeStream]
  );

  useEffect(() => () => closeStream(), [closeStream]);

  const openStream = useCallback(
    (searchId: string) => {
      searchIdRef.current = searchId;
      startPolling(searchId);

      cleanupRef.current = streamResults(searchId, {
        onStarted: () => {
          setPhaseMessage("Search started — scraping businesses…");
        },
        onPhase: setPhaseMessage,
        onProgress: (count, max) => {
          setProgress(Math.min(100, max && max > 0 ? (count / max) * 100 : Math.min(count, 99)));
          if (count > 0) {
            setPhaseMessage(`Found ${count} businesses so far…`);
          }
        },
        onLead: queueLead,
        onComplete: (total) => {
          setTotalFound(total);
          setProgress(100);
          setPhaseMessage(`Search complete — ${total} businesses found.`);
          stopPolling();
          closeStream();
          setTimeout(() => {
            setIsSearching(false);
            setPhaseMessage(null);
          }, 2000);
        },
        onError: (message) => {
          if (message.includes("Connection lost")) {
            setPhaseMessage("Stream reconnecting — results still loading…");
            return;
          }
          setError(message);
          setIsSearching(false);
          setPhaseMessage(null);
          closeStream();
        },
        onReconnecting: (attempt) => {
          setPhaseMessage(`Connection interrupted — reconnecting (${attempt}/3)…`);
        },
      });
    },
    [queueLead, closeStream, startPolling, stopPolling]
  );

  const runSearch = async (businessType: string, location: string) => {
    if (!businessType.trim() || !location.trim()) {
      setError("Please enter both business type and location.");
      return;
    }

    closeStream();
    setError(null);
    setShowLimitMessage(false);
    setLeads([]);
    setProgress(0);
    setTotalFound(0);
    setIsSearching(true);
    leadIdsRef.current.clear();
    pendingLeads.current = [];
    setSearchMeta({ business: businessType.trim(), location: location.trim() });
    setPhaseMessage("Connecting to backend…");

    try {
      const health = await checkHealth();
      if (!health.ok) {
        setError(health.message ?? "Backend is not reachable.");
        setIsSearching(false);
        setPhaseMessage(null);
        return;
      }

      setPhaseMessage("Starting discovery…");
      const response = await startSearch(businessType.trim(), location.trim());

      if (response.searchesRemaining != null) {
        setSearchesRemaining(response.searchesRemaining);
      }

      if (response.cached && response.status === "completed") {
        setPhaseMessage("Loading cached results…");
        const { leads: cachedLeads, total } = await getResults(response.searchId);
        leadIdsRef.current.clear();
        pendingLeads.current = [];
        for (const lead of cachedLeads) {
          leadIdsRef.current.add(lead.id);
        }
        setLeads(cachedLeads);
        setTotalFound(total);
        setProgress(100);
        setPhaseMessage(`Loaded ${total} cached results instantly.`);
        setTimeout(() => {
          setIsSearching(false);
          setPhaseMessage(null);
        }, 2000);
        return;
      }

      if (response.status === "queued") {
        setPhaseMessage("Your search is queued — results will appear shortly…");
      }

      openStream(response.searchId);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to start search.";
      if (
        message.includes("limit reached") ||
        message.includes("Monthly") ||
        message.includes("search limit")
      ) {
        setShowLimitMessage(true);
      }
      setError(message);
      setIsSearching(false);
      setPhaseMessage(null);
      closeStream();
    }
  };

  const clearResults = () => {
    closeStream();
    setLeads([]);
    setProgress(0);
    setTotalFound(0);
    setError(null);
    setShowLimitMessage(false);
    setIsSearching(false);
    leadIdsRef.current.clear();
    pendingLeads.current = [];
    searchIdRef.current = null;
  };

  return {
    leads,
    isSearching,
    progress,
    error,
    showLimitMessage,
    phaseMessage,
    searchMeta,
    totalFound,
    searchesRemaining,
    runSearch,
    clearResults,
    closeStream,
  };
}
