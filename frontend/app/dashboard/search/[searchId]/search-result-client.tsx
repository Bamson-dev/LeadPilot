"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ResultsTable } from "@/features/results/results-table";
import { ResultsSummaryBar } from "@/components/dashboard/results-summary-bar";
import { NearbyCityChips } from "@/components/dashboard/nearby-city-chips";
import { pollSearchResults } from "@/services/api";
import { businessLeadToLead } from "@/types/lead";
import type { Lead } from "@/types/lead";
import type { BusinessLead } from "@leadthur/shared";
import { normalizeApiBusinessLeads } from "@/utils/normalize-api-lead";
import { useLeadStatuses } from "@/hooks/useLeadStatuses";
import { useIsMobile } from "@/hooks/useIsMobile";
import { hasStoredLicense } from "@/lib/license";

const POLL_MS = 3000;

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

export default function SearchResultPage() {
  const params = useParams();
  const router = useRouter();
  const searchId = String(params.searchId ?? "");
  const isMobile = useIsMobile();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [emailScrapingComplete, setEmailScrapingComplete] = useState(true);
  const [nearbyCities, setNearbyCities] = useState<
    Awaited<ReturnType<typeof pollSearchResults>>["nearbyCities"]
  >([]);

  const { leadStatuses, setLeadStatus, statusFilter, setStatusFilter } =
    useLeadStatuses(leads);

  useEffect(() => {
    if (!hasStoredLicense()) {
      router.replace("/activate");
      return;
    }
    if (!searchId) {
      setNotFound(true);
      setLoading(false);
      return;
    }

    let cancelled = false;
    let interval: ReturnType<typeof setInterval> | null = null;
    let mergedBusinessLeads: BusinessLead[] = [];

    const load = async () => {
      try {
        const payload = await pollSearchResults(searchId);
        if (cancelled) return;

        if (payload.leads.length > 0) {
          mergedBusinessLeads = mergePollLeads(
            mergedBusinessLeads,
            normalizeApiBusinessLeads(payload.leads)
          );
          setLeads(mergedBusinessLeads.map(businessLeadToLead));
        }

        setEmailScrapingComplete(payload.emailScrapingComplete);
        setNearbyCities(payload.nearbyCities ?? []);
        setNotFound(false);
        setLoading(false);

        const keepPolling =
          payload.scrapingInProgress || !payload.emailScrapingComplete;

        if (keepPolling && !interval) {
          interval = setInterval(() => {
            void load();
          }, POLL_MS);
        } else if (!keepPolling && interval) {
          clearInterval(interval);
          interval = null;
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
  }, [searchId, router]);

  if (notFound) {
    return (
      <div className="mx-auto max-w-lg py-16 text-center">
        <h1 className="text-xl font-bold text-white">Search not found</h1>
        <p className="mt-2 text-sm text-zinc-400">
          This search does not exist or belongs to another account.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-white">Your search results</h1>
      </div>

      <ResultsSummaryBar leads={leads} />
      <NearbyCityChips
        show={emailScrapingComplete && !loading}
        cities={nearbyCities}
        onSelectCity={(city) =>
          router.push(`/dashboard?location=${encodeURIComponent(city)}`)
        }
      />

      <ResultsTable
        leads={leads}
        isLoading={loading}
        isMobile={isMobile}
        leadStatuses={leadStatuses}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        onLeadStatusChange={setLeadStatus}
        totalLeadCount={leads.length}
        emailScrapingInProgress={!emailScrapingComplete && leads.length > 0}
      />
    </div>
  );
}
