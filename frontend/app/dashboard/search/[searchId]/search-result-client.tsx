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
import { DiscoveryWorkspaceHeader } from "@/components/discovery/discovery-workspace-header";
import { DiscoveryResultsLayout } from "@/components/discovery/discovery-results-layout";
import { DiscoveryBulkBar } from "@/components/discovery/discovery-bulk-bar";
import { WhatsappTemplateModal } from "@/components/dashboard/whatsapp-template-modal";
import { toast } from "@/components/ui/toast";
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
  const [activeLeadId, setActiveLeadId] = useState<string | null>(null);
  const [tableFilter, setTableFilter] = useState("");

  useEffect(() => {
    if (jobQuery) setBusinessType(jobQuery);
    if (jobLocation) setLocation(jobLocation);
  }, [jobQuery, jobLocation]);

  const { leadStatuses, setLeadStatus, statusFilter, setStatusFilter } =
    useLeadStatuses(leads);

  const visibleLeads = useMemo(() => {
    const q = tableFilter.trim().toLowerCase();
    if (!q) return leads;
    return leads.filter((lead) => {
      const haystack = [
        lead.business_name,
        lead.category,
        lead.address,
        lead.phone,
        lead.email,
        ...(lead.verified_emails || []),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [leads, tableFilter]);

  const selectedLeads = useMemo(
    () => leads.filter((lead) => selectedLeadIds.has(getLeadSelectionId(lead))),
    [leads, selectedLeadIds]
  );

  const activeLead = useMemo(
    () => visibleLeads.find((lead) => lead.id === activeLeadId) ?? null,
    [visibleLeads, activeLeadId]
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
    const slug = [businessType, location].filter(Boolean).join("-") || "leads";
    exportToCSV(leads, slug);
  }, [leads, businessType, location]);

  const handleClearResults = useCallback(() => {
    router.push("/dashboard");
  }, [router]);

  const handleSearch = useCallback(() => {
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
        <h1 className="text-xl font-semibold text-[var(--lt-text)]">Search not found</h1>
        <p className="mt-2 text-sm text-[var(--lt-text-muted)]">
          This search does not exist or belongs to another account.
        </p>
      </div>
    );
  }

  const displayCount = Math.max(totalFound, leads.length);

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="rounded-xl border border-[var(--lt-border)] bg-[var(--lt-surface)] p-4 sm:p-6">
        <DiscoveryWorkspaceHeader
          title={
            businessType && location
              ? `${businessType} in ${location}`
              : "Your search results"
          }
          subtitle={
            fullyComplete
              ? displayCount === 0
                ? "No potential clients found in this area. Try a nearby city."
                : `${displayCount.toLocaleString()} businesses found`
              : `Finding potential clients${
                  displayCount > 0
                    ? `… ${displayCount.toLocaleString()} found so far`
                    : "…"
                }`
          }
          filterQuery={tableFilter}
          onFilterQueryChange={setTableFilter}
          onExportClick={leads.length > 0 ? handleDownload : undefined}
          exportDisabled={leads.length === 0}
        />
        <DiscoveryBulkBar
          className="mt-4"
          selectedCount={selectedLeadIds.size}
          onClear={() => setSelectedLeadIds(new Set())}
          onExport={leads.length > 0 ? handleDownload : undefined}
          onOutreach={() => setSendPanelOpen(true)}
        />
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
          <DiscoveryResultsLayout
            activeLead={activeLead}
            leadStatus={activeLead ? leadStatuses[activeLead.id] || "new" : undefined}
            onCloseDetails={() => setActiveLeadId(null)}
            onSaveLead={(lead) => setLeadStatus(lead.id, "interested")}
            onAddToOutreach={(lead) => {
              const id = getLeadSelectionId(lead);
              setSelectedLeadIds((prev) => new Set(prev).add(id));
              setSendPanelOpen(true);
            }}
            onGenerateOutreach={(lead) => {
              const id = getLeadSelectionId(lead);
              setSelectedLeadIds((prev) => new Set(prev).add(id));
              setSendPanelOpen(true);
              toast.message("Compose outreach for the selected business");
            }}
          >
            <ResultsTable
              leads={visibleLeads}
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
              activeLeadId={activeLeadId}
              onLeadClick={(lead) =>
                setActiveLeadId((prev) => (prev === lead.id ? null : lead.id))
              }
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
          </DiscoveryResultsLayout>
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
