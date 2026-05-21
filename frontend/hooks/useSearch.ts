"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Lead } from "@/types/lead";
import {
  checkBackendReady,
  checkHealth,
  getResults,
  startSearch,
  streamResults,
} from "@/services/api";

export function useSearch() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [phaseMessage, setPhaseMessage] = useState<string | null>(null);
  const [searchMeta, setSearchMeta] = useState({ business: "", location: "" });
  const [totalFound, setTotalFound] = useState(0);
  const cleanupRef = useRef<(() => void) | null>(null);
  const leadIdsRef = useRef<Set<string>>(new Set());

  const appendLead = useCallback((lead: Lead) => {
    if (leadIdsRef.current.has(lead.id)) return;
    leadIdsRef.current.add(lead.id);
    setLeads((prev) => [...prev, lead]);
  }, []);

  const closeStream = useCallback(() => {
    cleanupRef.current?.();
    cleanupRef.current = null;
  }, []);

  useEffect(() => () => closeStream(), [closeStream]);

  const openStream = useCallback(
    (searchId: string) => {
      cleanupRef.current = streamResults(searchId, {
        onStarted: () => {
          setPhaseMessage("Search started — scraping businesses…");
        },
        onPhase: setPhaseMessage,
        onProgress: (count, max) => {
          setProgress(Math.min(100, max && max > 0 ? (count / max) * 100 : count));
        },
        onLead: appendLead,
        onComplete: (total) => {
          setTotalFound(total);
          setProgress(100);
          setPhaseMessage(`Search complete — ${total} businesses found.`);
          closeStream();
          setTimeout(() => {
            setIsSearching(false);
            setPhaseMessage(null);
          }, 2000);
        },
        onError: (message) => {
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
    [appendLead, closeStream]
  );

  const runSearch = async (businessType: string, location: string) => {
    if (!businessType.trim() || !location.trim()) {
      setError("Please enter both business type and location.");
      return;
    }

    closeStream();
    setError(null);
    setLeads([]);
    setProgress(0);
    setTotalFound(0);
    setIsSearching(true);
    leadIdsRef.current.clear();
    setSearchMeta({ business: businessType.trim(), location: location.trim() });
    setPhaseMessage("Checking backend…");

    try {
      const health = await checkHealth();
      if (!health.ok) {
        setError(health.message ?? "Backend is not reachable.");
        setIsSearching(false);
        setPhaseMessage(null);
        return;
      }

      setPhaseMessage("Checking scraper…");
      const ready = await checkBackendReady();
      if (!ready.ok) {
        setError(ready.message ?? "Scraper is not ready. Try again shortly.");
        setIsSearching(false);
        setPhaseMessage(null);
        return;
      }

      setPhaseMessage("Starting discovery…");
      const response = await startSearch(businessType.trim(), location.trim());

      if (response.cached && response.status === "completed") {
        setPhaseMessage("Loading cached results…");
        const { leads: cachedLeads, total } = await getResults(response.searchId);
        leadIdsRef.current.clear();
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
      setError(err instanceof Error ? err.message : "Failed to start search.");
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
    setIsSearching(false);
    leadIdsRef.current.clear();
  };

  return {
    leads,
    isSearching,
    progress,
    error,
    phaseMessage,
    searchMeta,
    totalFound,
    runSearch,
    clearResults,
    closeStream,
  };
}
