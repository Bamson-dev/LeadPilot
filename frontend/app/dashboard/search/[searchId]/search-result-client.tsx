"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ResultsTable } from "@/features/results/results-table";
import { ResultsSummaryBar } from "@/components/dashboard/results-summary-bar";
import { ScrapingProgressBanner } from "@/components/dashboard/scraping-progress-banner";
import { NearbyCityChips } from "@/components/dashboard/nearby-city-chips";
import { pollSearchResults } from "@/services/api";
import { businessLeadToLead } from "@/types/lead";
import type { Lead } from "@/types/lead";
import { useLeadStatuses } from "@/hooks/useLeadStatuses";
import { useIsMobile } from "@/hooks/useIsMobile";
import { hasStoredLicense } from "@/lib/license";

const POLL_MS = 3000;

export default function SearchResultPage() {
  const params = useParams();
  const router = useRouter();
  const searchId = String(params.searchId ?? "");
  const isMobile = useIsMobile();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [scrapingInProgress, setScrapingInProgress] = useState(false);
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

    const load = async () => {
      try {
        const payload = await pollSearchResults(searchId);
        if (cancelled) return;
        setLeads(payload.leads.map(businessLeadToLead));
        setScrapingInProgress(payload.scrapingInProgress);
        setNearbyCities(payload.nearbyCities ?? []);
        setNotFound(false);
        setLoading(false);

        if (payload.scrapingInProgress && !interval) {
          interval = setInterval(() => {
            void load();
          }, POLL_MS);
        } else if (!payload.scrapingInProgress && interval) {
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
        <h1 className="text-lg font-bold text-white">Your search results</h1>
      </div>

      <ResultsSummaryBar leads={leads} />
      <ScrapingProgressBanner
        scrapingInProgress={scrapingInProgress}
        leads={leads}
      />
      <NearbyCityChips
        show={!scrapingInProgress && !loading}
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
      />
    </div>
  );
}
