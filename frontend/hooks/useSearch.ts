"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Lead } from "@/types/lead";
import { checkHealth, startSearch, streamResults } from "@/services/api";

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
    setPhaseMessage("Starting discovery…");

    try {
      const health = await checkHealth();
      if (health.playwright !== "ready") {
        setError(health.message ?? "Backend scraper is not ready.");
        setIsSearching(false);
        setPhaseMessage(null);
        return;
      }

      const { searchId } = await startSearch(businessType.trim(), location.trim());

      cleanupRef.current = streamResults(searchId, {
        onPhase: setPhaseMessage,
        onProgress: (count, max) => {
          setProgress(Math.min(100, (count / max) * 100));
        },
        onLead: scheduleBatch,
        onComplete: () => {
          flushBatch();
          setProgress(100);
          setPhaseMessage(null);
          setTimeout(() => setIsSearching(false), 2000);
        },
        onError: (message) => {
          setError(message);
          setIsSearching(false);
          setPhaseMessage(null);
        },
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start search.");
      setIsSearching(false);
      setPhaseMessage(null);
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
