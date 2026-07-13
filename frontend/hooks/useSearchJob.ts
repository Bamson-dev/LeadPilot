"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { BusinessLead, NearbyCitySuggestion } from "@leadthur/shared";
import { pollSearchResults, getSearch } from "@/services/api";
import { normalizeApiBusinessLeads } from "@/utils/normalize-api-lead";
import { isSearchFullyComplete } from "@/utils/search-completion";
import { businessLeadToLead } from "@/types/lead";
import type { Lead } from "@/types/lead";

const POLL_MS = 5000;

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
    const key = placeIdFromLead(lead);
    const prev = byPlace.get(key);
    byPlace.set(
      key,
      prev
        ? {
            ...prev,
            ...lead,
            id: prev.id || lead.id,
            email: lead.email ?? prev.email,
            emails: lead.emails?.length ? lead.emails : prev.emails,
            verifiedEmails: lead.verifiedEmails?.length
              ? lead.verifiedEmails
              : prev.verifiedEmails,
            predictedEmails: lead.predictedEmails?.length
              ? lead.predictedEmails
              : prev.predictedEmails,
            emailSource: lead.emailSource ?? prev.emailSource,
            emailScraped: lead.emailScraped || prev.emailScraped,
          }
        : lead
    );
  }
  return [...byPlace.values()];
}

/**
 * Poll an existing search until fullyComplete. Shared completion predicate
 * with useSearch / free trial — no separate invent-your-own done check.
 */
export function useSearchJob(searchId: string) {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [businessLeads, setBusinessLeads] = useState<BusinessLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [fullyComplete, setFullyComplete] = useState(false);
  const [emailScrapingComplete, setEmailScrapingComplete] = useState(true);
  const [scrapingInProgress, setScrapingInProgress] = useState(false);
  const [totalFound, setTotalFound] = useState(0);
  const [status, setStatus] = useState<string>("idle");
  const [query, setQuery] = useState("");
  const [location, setLocation] = useState("");
  const [nearbyCities, setNearbyCities] = useState<NearbyCitySuggestion[]>([]);
  const mergedRef = useRef<BusinessLead[]>([]);

  const applyPayload = useCallback(
    (
      payload: Awaited<ReturnType<typeof pollSearchResults>>,
      job: Awaited<ReturnType<typeof getSearch>> | null
    ) => {
      if (job?.query) setQuery(job.query);
      if (job?.location) setLocation(job.location);

      if (payload.leads.length > 0) {
        mergedRef.current = mergePollLeads(
          mergedRef.current,
          normalizeApiBusinessLeads(payload.leads)
        );
        setBusinessLeads(mergedRef.current);
        setLeads(mergedRef.current.map(businessLeadToLead));
      }

      const done = isSearchFullyComplete(payload);
      setFullyComplete(done);
      setEmailScrapingComplete(Boolean(payload.emailScrapingComplete));
      setScrapingInProgress(Boolean(payload.scrapingInProgress));
      setTotalFound(
        Math.max(payload.totalFound ?? 0, mergedRef.current.length)
      );
      setStatus(payload.status ?? job?.status ?? "unknown");
      setNearbyCities(payload.nearbyCities ?? []);
      setNotFound(false);
      setLoading(false);

      const leadsStillCatchingUp =
        (payload.totalFound ?? 0) > 0 &&
        mergedRef.current.length < (payload.totalFound ?? 0);

      return done && !leadsStillCatchingUp;
    },
    []
  );

  useEffect(() => {
    if (!searchId) {
      setNotFound(true);
      setLoading(false);
      return;
    }

    let cancelled = false;
    let interval: ReturnType<typeof setInterval> | null = null;
    mergedRef.current = [];

    const load = async () => {
      try {
        const [payload, job] = await Promise.all([
          pollSearchResults(searchId),
          getSearch(searchId).catch(() => null),
        ]);
        if (cancelled) return;

        const settled = applyPayload(payload, job);
        if (settled) {
          if (interval) {
            clearInterval(interval);
            interval = null;
          }
          return;
        }

        if (!interval) {
          interval = setInterval(() => {
            void load();
          }, POLL_MS);
        }
      } catch {
        if (!cancelled) {
          setNotFound(true);
          setLoading(false);
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
      if (interval) clearInterval(interval);
    };
  }, [searchId, applyPayload]);

  return {
    leads,
    businessLeads,
    loading,
    notFound,
    fullyComplete,
    emailScrapingComplete,
    scrapingInProgress,
    totalFound,
    status,
    query,
    location,
    nearbyCities,
    isSearching: !fullyComplete && status !== "failed" && status !== "idle",
  };
}
