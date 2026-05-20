"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Lead } from "@/types/lead";
import { checkBackendReady, checkHealth, startSearch, streamResults } from "@/services/api";

export function useSearch() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [phaseMessage, setPhaseMessage] = useState<string | null>(null);
  const [searchMeta, setSearchMeta] = useState({ business: "", location: "" });
  const cleanupRef = useRef<(() => void) | null>(null);
  const batchRef = useRef<Lead[]>([]);
  const batchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const leadIdsRef = useRef<Set<string>>(new Set());

  const flushBatch = useCallback(() => {
    if (batchRef.current.length === 0) return;
    const batch = batchRef.current;
    batchRef.current = [];
    setLeads((prev) => {
      const next = [...prev];
      for (const lead of batch) {
        if (!leadIdsRef.current.has(lead.id)) {
          leadIdsRef.current.add(lead.id);
          next.push(lead);
        }
      }
      return next;
    });
  }, []);

  const scheduleBatch = useCallback(
    (lead: Lead) => {
      if (leadIdsRef.current.has(lead.id)) return;
      batchRef.current.push(lead);
      if (batchTimerRef.current) clearTimeout(batchTimerRef.current);
      batchTimerRef.current = setTimeout(flushBatch, 200);
    },
    [flushBatch]
  );

  const closeStream = useCallback(() => {
    cleanupRef.current?.();
    cleanupRef.current = null;
    if (batchTimerRef.current) {
      clearTimeout(batchTimerRef.current);
      batchTimerRef.current = null;
    }
    flushBatch();
  }, [flushBatch]);

  useEffect(() => () => closeStream(), [closeStream]);

  const runSearch = async (businessType: string, location: string) => {
    if (!businessType.trim() || !location.trim()) {
      setError("Please enter both business type and location.");
      return;
    }

    closeStream();
    setError(null);
    setLeads([]);
    setProgress(0);
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
      const { searchId } = await startSearch(businessType.trim(), location.trim());

      cleanupRef.current = streamResults(searchId, {
        onPhase: setPhaseMessage,
        onProgress: (count, max) => {
          setProgress(Math.min(100, max > 0 ? (count / max) * 100 : 0));
        },
        onLead: scheduleBatch,
        onComplete: () => {
          flushBatch();
          setProgress(100);
          setPhaseMessage(null);
          closeStream();
          setTimeout(() => setIsSearching(false), 1500);
        },
        onError: (message) => {
          setError(message);
          setIsSearching(false);
          setPhaseMessage(null);
          closeStream();
        },
      });
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
    runSearch,
    clearResults,
    closeStream,
  };
}
