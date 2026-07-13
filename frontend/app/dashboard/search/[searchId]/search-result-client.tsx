"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ResultsTable } from "@/features/results/results-table";
import { ResultsSummaryBar } from "@/components/dashboard/results-summary-bar";
import { NearbyCityChips } from "@/components/dashboard/nearby-city-chips";
import { DashboardHistorySections } from "@/components/dashboard/dashboard-history-sections";
import { ResultsActionsBar } from "@/components/dashboard/results-actions-bar";
import {
  OutreachWorkspace,
  requestMailboxesTab,
} from "@/components/dashboard/outreach-workspace";
import { WhatsappTemplateModal } from "@/components/dashboard/whatsapp-template-modal";
import { useOutreach } from "@/hooks/useOutreach";
import { useSearchJob } from "@/hooks/useSearchJob";
import { getLicenseUsage } from "@/services/api";
import type { Lead } from "@/types/lead";
import { useLeadStatuses } from "@/hooks/useLeadStatuses";
import { useIsMobile } from "@/hooks/useIsMobile";
import { hasStoredLicense } from "@/lib/license";
import { getLeadSelectionId } from "@/lib/lead-selection";
import { exportToCSV } from "@/features/export/csv-export";
import { markRecipientReplied } from "@/services/outreach-api";

function dashboardSearchUrl(
  businessType: string,
  location: string,
  options?: { accumulate?: boolean }
): string {
  const params = new URLSearchParams();
  if (businessType.trim()) params.set("businessType", businessType.trim());
  params.set("location", location.trim());
  if (options?.accumulate) params.set("accumulate", "1");
  return `/dashboard?${params.toString()}`;
}

export default function SearchResultPage() {
  const params = useParams();
  const router = useRouter();
  const searchId = String(params.searchId ?? "");
  const isMobile = useIsMobile();
  const outreach = useOutreach();
  const {
    leads,
    loading,
    notFound,
    fullyComplete,
    emailScrapingComplete,
    totalFound,
    query: jobQuery,
    location: jobLocation,
    nearbyCities,
  } = useSearchJob(searchId);

  const [selectedLeadIds, setSelectedLeadIds] = useState<Set<string>>(
    () => new Set()
  );
  const [sendPanelOpen, setSendPanelOpen] = useState(false);
  const [templateLead, setTemplateLead] = useState<Lead | null>(null);
  const [userEmail, setUserEmail] = useState("");
  const [creditsRemaining, setCreditsRemaining] = useState(0);
  const [businessType, setBusinessType] = useState("");
  const [location, setLocation] = useState("");

  useEffect(() => {
    if (jobQuery) setBusinessType(jobQuery);
    if (jobLocation) setLocation(jobLocation);
  }, [jobQuery, jobLocation]);

  const { leadStatuses, setLeadStatus, statusFilter, setStatusFilter } =
    useLeadStatuses(leads);

  const selectedLeads = useMemo(
    () => leads.filter((lead) => selectedLeadIds.has(getLeadSelectionId(lead))),
    [leads, selectedLeadIds]
  );

  const toggleLeadSelect = useCallback((leadId: string) => {
    setSelectedLeadIds((prev) => {
      const next = new Set(prev);
      if (next.has(leadId)) next.delete(leadId);
      else next.add(leadId);
      return next;
    });
  }, []);

  const handleDownload = useCallback(() => {
    const bt = (businessType || "leads").replace(/\s+/g, "-").toLowerCase();
    const loc = (location || "export").replace(/\s+/g, "-").toLowerCase();
    exportToCSV(leads, `leadthur-${bt}-${loc}-${Date.now()}.csv`);
  }, [leads, businessType, location]);

  const handleClearResults = useCallback(() => {
    router.push("/dashboard");
  }, [router]);

  const handleSearch = useCallback(() => {
    if (!businessType.trim() || !location.trim()) return;
    router.push(dashboardSearchUrl(businessType, location));
  }, [businessType, location, router]);

  const handleSearchAgain = useCallback(
    (bt: string, loc: string) => {
      router.push(dashboardSearchUrl(bt, loc));
    },
    [router]
  );

  const handleNearbyCity = useCallback(
    (city: string) => {
      router.push(
        dashboardSearchUrl(businessType.trim() || "businesses", city, {
          accumulate: true,
        })
      );
    },
    [businessType, router]
  );

  const scrollToMailboxes = useCallback(() => {
    requestMailboxesTab();
  }, []);

  useEffect(() => {
    setUserEmail(localStorage.getItem("leadthur_email") || "");
    void getLicenseUsage().then((usage) => {
      if (usage) setCreditsRemaining(usage.search_credits);
    });
  }, []);

  useEffect(() => {
    if (!hasStoredLicense()) {
      router.replace("/activate");
    }
  }, [router]);

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

  const displayCount = Math.max(totalFound, leads.length);

  return (
    <div className="space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-xl font-bold text-white">Your search results</h1>
        {fullyComplete ? (
          <p className="mt-2 text-sm text-[#A1A1B5]">
            {displayCount === 0
              ? "No potential clients found in this area. Try a nearby city."
              : `We found ${displayCount.toLocaleString()} potential clients for you.`}
          </p>
        ) : (
          <p className="mt-2 text-sm text-[#A1A1B5]">
            Finding potential clients
            {displayCount > 0
              ? `… ${displayCount.toLocaleString()} found so far`
              : "…"}
          </p>
        )}
      </div>

      <OutreachWorkspace
        outreach={outreach}
        businessType={businessType}
        location={location}
        onBusinessTypeChange={setBusinessType}
        onLocationChange={setLocation}
        onSearch={handleSearch}
        searchDisabled={loading || !fullyComplete}
        selectedLeads={selectedLeads}
        sendPanelOpen={sendPanelOpen}
        onCloseSendPanel={() => setSendPanelOpen(false)}
        onSendComplete={() => setSelectedLeadIds(new Set())}
        targetBusinessType={businessType}
        resultsHeader={<ResultsSummaryBar leads={leads} />}
        resultsContent={
          <ResultsTable
            leads={leads}
            isLoading={loading}
            isMobile={isMobile}
            leadStatuses={leadStatuses}
            statusFilter={statusFilter}
            onStatusFilterChange={setStatusFilter}
            onLeadStatusChange={setLeadStatus}
            onUseTemplate={setTemplateLead}
            totalLeadCount={leads.length}
            emailScrapingInProgress={!emailScrapingComplete && leads.length > 0}
            selectedLeadIds={selectedLeadIds}
            onToggleLeadSelect={toggleLeadSelect}
            onSendSelected={() => setSendPanelOpen(true)}
            hasMailbox={outreach.hasMailbox}
            onNoMailboxClick={scrollToMailboxes}
            onMarkReplied={(lead) => {
              const recipient = (
                lead.verified_emails?.[0] ||
                lead.email ||
                ""
              ).trim();
              if (!recipient) return;
              void markRecipientReplied(recipient).then(() => {
                setLeadStatus(lead.id, "interested");
              });
            }}
          />
        }
        resultsFooter={
          <div className="space-y-4">
            <NearbyCityChips
              show={fullyComplete && !loading}
              cities={nearbyCities}
              onSelectCity={handleNearbyCity}
            />
            <ResultsActionsBar
              exportCount={leads.length}
              onDownload={handleDownload}
              onClear={handleClearResults}
              isMobile={isMobile}
            />
          </div>
        }
      />

      <DashboardHistorySections
        isMobile={isMobile}
        onSearchAgain={handleSearchAgain}
      />

      <WhatsappTemplateModal
        lead={templateLead}
        searchLocation={location}
        userEmail={userEmail}
        creditsRemaining={creditsRemaining}
        onClose={() => setTemplateLead(null)}
        onCreditsUpdated={(balance) => setCreditsRemaining(balance)}
        onCreditDeducted={() => {}}
        onGetMoreCredits={() => router.push("/dashboard")}
      />
    </div>
  );
}
