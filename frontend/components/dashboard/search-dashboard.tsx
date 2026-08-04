"use client";

import { Loader2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { BusinessLead } from "@leadthur/shared";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Chip } from "@/components/ui/chip";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { LiveCounter } from "@/components/dashboard/live-counter";
import { AffiliateSection } from "@/components/dashboard/affiliate-section";
import { DashboardHistorySections } from "@/components/dashboard/dashboard-history-sections";
import { ResultsActionsBar } from "@/components/dashboard/results-actions-bar";
import { OutreachWorkspace, requestMailboxesTab } from "@/components/dashboard/outreach-workspace";
import { DiscoveryWorkspaceHeader } from "@/components/discovery/discovery-workspace-header";
import { DiscoveryBulkBar } from "@/components/discovery/discovery-bulk-bar";
import { DiscoveryResultsLayout } from "@/components/discovery/discovery-results-layout";
import { toast } from "@/components/ui/toast";
import { useOutreach } from "@/hooks/useOutreach";
import { WelcomeState } from "@/components/dashboard/welcome-state";
import { SearchQueueCard } from "@/components/dashboard/search-queue-card";
import { NearbyCityChips } from "@/components/dashboard/nearby-city-chips";
import { RegionCityChips } from "@/components/dashboard/region-city-chips";
import { ResultsTable } from "@/features/results/results-table";
import { WhatsappTemplateModal } from "@/components/dashboard/whatsapp-template-modal";
import { useSearch } from "@/hooks/useSearch";
import { useLeadStatuses } from "@/hooks/useLeadStatuses";
import { useIsMobile } from "@/hooks/useIsMobile";
import { exportToCSV } from "@/features/export/csv-export";
import { markRecipientReplied } from "@/services/outreach-api";
import SearchLimitModal from "@/components/SearchLimitModal";
import SearchUpgradeBanner from "@/components/SearchUpgradeBanner";
import {
  getLicenseUsage,
  getSearchSuggestions,
  getRecentActivity,
  getTotalDiscovered,
  claimAiBonus,
  type LicenseUsage,
} from "@/services/api";
import type { Lead } from "@/types/lead";
import { applyRatingFilter, type RatingFilterValue } from "@/lib/rating-filter";
import { applyStatusFilter } from "@/lib/lead-status";
import { getQueryVariations } from "@/utils/query-variations";
import { getLeadSelectionId } from "@/lib/lead-selection";

interface ActivityItem {
  query: string;
  location: string;
  total_found: number;
  created_at: string;
}

export function SearchDashboard() {
  const isMobile = useIsMobile();
  const [businessType, setBusinessType] = useState("");
  const [location, setLocation] = useState("");
  const [savedBanner, setSavedBanner] = useState<string | null>(null);
  const [suggestionsMessage, setSuggestionsMessage] = useState("");
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [totalDiscovered, setTotalDiscovered] = useState(0);
  const [showLimitModal, setShowLimitModal] = useState(false);
  const [userEmail, setUserEmail] = useState("");
  const [userStats, setUserStats] = useState<LicenseUsage | null>(null);
  const [ratingFilter, setRatingFilter] = useState<RatingFilterValue>("all");
  const [historyRefreshKey, setHistoryRefreshKey] = useState(0);
  const [templateLead, setTemplateLead] = useState<Lead | null>(null);
  const [showCreditDeduction, setShowCreditDeduction] = useState(false);
  const [selectedLeadIds, setSelectedLeadIds] = useState<Set<string>>(() => new Set());
  const [sendPanelOpen, setSendPanelOpen] = useState(false);
  const [tableFilter, setTableFilter] = useState("");
  const [activeLeadId, setActiveLeadId] = useState<string | null>(null);
  const outreach = useOutreach();
  const searchAgainVariationRef = useRef(0);

  const loadUserStats = useCallback(async () => {
    const usage = await getLicenseUsage();
    if (usage) setUserStats(usage);
  }, []);

  useEffect(() => {
    setUserEmail(localStorage.getItem("leadthur_email") || "");
    void (async () => {
      await claimAiBonus();
      await loadUserStats();
    })();

    const onTopUpSuccess = () => {
      void loadUserStats();
    };
    window.addEventListener("leadthur:topup-success", onTopUpSuccess);
    return () => window.removeEventListener("leadthur:topup-success", onTopUpSuccess);
  }, [loadUserStats]);

  const handleCreditsUpdated = useCallback((balance: number) => {
    setUserStats((prev) => (prev ? { ...prev, search_credits: balance } : prev));
  }, []);

  const handleCreditDeducted = useCallback(() => {
    setShowCreditDeduction(true);
    window.setTimeout(() => setShowCreditDeduction(false), 2000);
  }, []);

  const onSearchCompleteRef = useRef<
    | ((
        newLeads: BusinessLead[],
        query: string,
        loc: string,
        totalFound: number
      ) => void)
    | null
  >(null);

  const {
    leads,
    isSearching,
    progress,
    error,
    showLimitMessage,
    phaseMessage,
    searchMeta,
    status,
    totalFound,
    runSearch,
    runSearchWithSuggestion,
    runSearchWithNearbyCity,
    runSearchWithRegionCity,
    suggestions,
    searchedExpansionLocations,
    setSuggestions,
    clearResults,
    scrapingInProgress,
    emailScrapingComplete,
    fullyComplete,
    nearbyCities,
    regionCitySuggestions,
    regionSelectionMessage,
    queuePosition,
  } = useSearch({
    onSearchComplete: (...args) => onSearchCompleteRef.current?.(...args),
    onSearchLimitReached: () => {
      setShowLimitModal(true);
      void loadUserStats();
    },
  });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const bt = params.get("businessType")?.trim();
    const loc = params.get("location")?.trim();
    if (bt && loc) {
      setBusinessType(bt);
      setLocation(loc);
      setSavedBanner(null);
      setRatingFilter("all");
      const accumulate = params.get("accumulate") === "1";
      void runSearch(bt, loc, accumulate ? { accumulate: true } : undefined);
      window.history.replaceState({}, "", "/dashboard");
    }
  }, [runSearch]);

  const fetchSuggestions = useCallback(
    async (
      query: string,
      loc: string,
      totalFound: number,
      excludeLocations?: string[]
    ) => {
      setLoadingSuggestions(true);
      try {
        const data = await getSearchSuggestions(
          query,
          loc,
          totalFound,
          excludeLocations
        );
        if ((data.suggestions?.length ?? 0) > 0) {
          setSuggestions(data.suggestions);
        }
        setSuggestionsMessage(data.message || "");
      } finally {
        setLoadingSuggestions(false);
      }
    },
    [setSuggestions]
  );

  onSearchCompleteRef.current = (
    _newLeads: BusinessLead[],
    query: string,
    loc: string,
    totalFound: number
  ) => {
    void fetchSuggestions(query, loc, totalFound, searchedExpansionLocations);

    if (totalFound > 0) {
      setHistoryRefreshKey((prev) => prev + 1);
    }
  };

  const stoppedEarly =
    typeof phaseMessage === "string" &&
    phaseMessage.toLowerCase().includes("stopped early");

  useEffect(() => {
    if (fullyComplete && !stoppedEarly) {
      setShowSuccess(true);
      const t = setTimeout(() => setShowSuccess(false), 3000);
      return () => clearTimeout(t);
    }
  }, [fullyComplete, stoppedEarly]);

  useEffect(() => {
    if (!fullyComplete || suggestions.length > 0) return;
    const q = searchMeta.business || businessType;
    const loc = searchMeta.location || location;
    if (!q.trim() || !loc.trim()) return;
    void fetchSuggestions(q, loc, totalFound, searchedExpansionLocations);
  }, [
    fullyComplete,
    suggestions.length,
    searchMeta.business,
    searchMeta.location,
    businessType,
    location,
    totalFound,
    searchedExpansionLocations,
    fetchSuggestions,
  ]);

  useEffect(() => {
    async function loadActivity() {
      const data = await getRecentActivity();
      setActivity(data.activity || []);
    }
    void loadActivity();
    const interval = setInterval(() => void loadActivity(), 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    async function loadTotal() {
      const data = await getTotalDiscovered();
      setTotalDiscovered(data.total || 0);
    }
    void loadTotal();
    const interval = setInterval(() => void loadTotal(), 60000);
    return () => clearInterval(interval);
  }, []);

  const query = searchMeta.business || businessType;
  const loc = searchMeta.location || location;

  const tableLeads = leads;

  const {
    leadStatuses,
    statusFilter,
    setStatusFilter,
    setLeadStatus,
  } = useLeadStatuses(tableLeads);

  const ratingFilteredTableLeads = useMemo(
    () => applyRatingFilter(tableLeads, ratingFilter),
    [tableLeads, ratingFilter]
  );

  const statusFilteredTableLeads = useMemo(
    () => applyStatusFilter(ratingFilteredTableLeads, statusFilter, leadStatuses),
    [ratingFilteredTableLeads, statusFilter, leadStatuses]
  );

  const visibleTableLeads = useMemo(() => {
    const q = tableFilter.trim().toLowerCase();
    if (!q) return statusFilteredTableLeads;
    return statusFilteredTableLeads.filter((lead) => {
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
  }, [statusFilteredTableLeads, tableFilter]);

  const selectedLeads = useMemo(
    () =>
      statusFilteredTableLeads.filter((lead) =>
        selectedLeadIds.has(getLeadSelectionId(lead))
      ),
    [statusFilteredTableLeads, selectedLeadIds]
  );

  const activeLead = useMemo(
    () => visibleTableLeads.find((lead) => lead.id === activeLeadId) ?? null,
    [visibleTableLeads, activeLeadId]
  );

  function handleLeadClick(lead: Lead) {
    setActiveLeadId((prev) => (prev === lead.id ? null : lead.id));
  }

  function handleSaveLead(lead: Lead) {
    setLeadStatus(lead.id, "interested");
  }

  function handleAddToOutreach(lead: Lead) {
    const id = getLeadSelectionId(lead);
    setSelectedLeadIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
    setSendPanelOpen(true);
  }

  function handleGenerateOutreach(lead: Lead) {
    handleAddToOutreach(lead);
    toast.message("Compose outreach for the selected business");
  }

  const toggleLeadSelect = useCallback((leadId: string) => {
    setSelectedLeadIds((prev) => {
      const next = new Set(prev);
      if (next.has(leadId)) next.delete(leadId);
      else next.add(leadId);
      return next;
    });
  }, []);

  const scrollToMailboxes = useCallback(() => {
    requestMailboxesTab();
  }, []);

  const openSendPanel = useCallback(() => {
    setSendPanelOpen(true);
  }, []);

  const leadsToExport = leads;

  const filteredLeadsToExport = useMemo(
    () =>
      applyStatusFilter(
        applyRatingFilter(leadsToExport, ratingFilter),
        statusFilter,
        Object.fromEntries(
          leadsToExport.map((lead) => [lead.id, leadStatuses[lead.id] || "new"])
        )
      ),
    [leadsToExport, ratingFilter, statusFilter, leadStatuses]
  );

  const handleSearch = () => {
    setSavedBanner(null);
    setRatingFilter("all");
    void runSearch(businessType, location);
  };

  const handleExampleSearch = (exampleQuery: string, exampleLocation: string) => {
    setSavedBanner(null);
    setRatingFilter("all");
    setBusinessType(exampleQuery);
    setLocation(exampleLocation);
    void runSearch(exampleQuery, exampleLocation);
  };

  const handleSuggestionClick = (s: {
    query: string;
    location: string;
    label: string;
  }) => {
    setSavedBanner(null);
    setRatingFilter("all");
    setBusinessType(s.query);
    setLocation(s.location);
    runSearchWithSuggestion(s);
  };

  const handleDownload = () => {
    exportToCSV(filteredLeadsToExport, `leadthur-${query}-${loc}-${Date.now()}.csv`);
  };

  const handleSearchAgain = (businessTypeValue: string, locationValue: string) => {
    setSavedBanner(null);
    setRatingFilter("all");
    setBusinessType(businessTypeValue);
    setLocation(locationValue);
    const variations = getQueryVariations(businessTypeValue);
    const idx = searchAgainVariationRef.current % variations.length;
    searchAgainVariationRef.current += 1;
    const queryVariant = variations[idx] ?? businessTypeValue;
    void runSearch(queryVariant, locationValue, { accumulate: true });
  };

  const handleClearResults = () => {
    clearResults();
    setSuggestionsMessage("");
    setSavedBanner(null);
  };

  const displayCount = Math.max(totalFound, tableLeads.length);

  const isQueuedWaiting =
    queuePosition > 0 && tableLeads.length === 0 && !scrapingInProgress;

  const showWelcome =
    status === "idle" &&
    tableLeads.length === 0 &&
    !isSearching &&
    !savedBanner;

  const exportCount = tableLeads.length;
  const exportPulse = fullyComplete && exportCount > 0;

  const searchesRemaining =
    userStats?.freeSearchesRemaining ??
    Math.max(
      0,
      (userStats?.monthly_search_limit ?? 100) - (userStats?.searches_used ?? 0)
    );
  const creditsRemaining = userStats?.search_credits ?? 0;
  const creditBannerVisible =
    (searchesRemaining <= 0 && creditsRemaining < 3) ||
    (searchesRemaining > 0 && searchesRemaining <= 10) ||
    (searchesRemaining <= 0 && creditsRemaining >= 3);

  return (
    <div className="space-y-6 sm:space-y-8">
      {userStats && (
        <SearchUpgradeBanner
          searchesRemaining={searchesRemaining}
          creditsRemaining={creditsRemaining}
          onUpgradeClick={() => setShowLimitModal(true)}
          showCreditDeduction={showCreditDeduction}
        />
      )}
      {userStats && showCreditDeduction && !creditBannerVisible && (
        <div
          style={{
            position: "relative",
            marginTop: -12,
            marginBottom: 12,
            textAlign: "right",
          }}
        >
          <span
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: "#F87171",
              animation: "leadthur-credit-fade 2s ease-out forwards",
            }}
          >
            −3 credits
          </span>
        </div>
      )}
      <div className="space-y-4 rounded-xl border border-[var(--lt-border)] bg-[var(--lt-surface)] p-4 sm:p-6">
        <DiscoveryWorkspaceHeader
          title={
            query && loc
              ? `${query} in ${loc}`
              : "Discovery Workspace"
          }
          subtitle={
            displayCount > 0
              ? `${displayCount.toLocaleString()} businesses found${
                  fullyComplete ? "" : " · searching…"
                }`
              : totalDiscovered > 0
                ? `${totalDiscovered.toLocaleString()} businesses discovered and counting`
                : "Search by business type and location. Results appear below."
          }
          filterQuery={tableFilter}
          onFilterQueryChange={setTableFilter}
          onExportClick={exportCount > 0 ? handleDownload : undefined}
          exportDisabled={exportCount === 0}
        />

        {activity.length > 0 && status === "idle" && !isSearching && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] text-[var(--lt-text-subtle)]">Recent</span>
            {activity.slice(0, isMobile ? 3 : 5).map((a, i) => (
              <Chip key={`${a.query}-${a.location}-${i}`}>
                <span className="text-[var(--lt-cyan)]">{a.total_found}</span>
                <span className="text-[var(--lt-text-muted)]">
                  {a.query} in {a.location}
                </span>
              </Chip>
            ))}
          </div>
        )}

        <DiscoveryBulkBar
          selectedCount={selectedLeadIds.size}
          onClear={() => setSelectedLeadIds(new Set())}
          onExport={exportCount > 0 ? handleDownload : undefined}
          onOutreach={openSendPanel}
        />

        {showSuccess && fullyComplete && !stoppedEarly && (
          <Alert variant="success">
            <AlertTitle>Search complete</AlertTitle>
            <AlertDescription>
              We found {displayCount.toLocaleString()} potential clients for you. Your leads are
              ready to export.
            </AlertDescription>
          </Alert>
        )}

        {fullyComplete && stoppedEarly && !error && (
          <Alert variant="warning">
            <AlertDescription>
              {phaseMessage ||
                `Search stopped early with ${displayCount.toLocaleString()} leads. Email lookup didn't finish — try searching again for a complete run.`}
            </AlertDescription>
          </Alert>
        )}

        {fullyComplete && !error && !savedBanner && !showSuccess && !stoppedEarly && (
          <p className="text-sm text-[var(--lt-text-muted)]">
            {displayCount === 0
              ? "No potential clients found in this area. Try a nearby city."
              : `We found ${displayCount.toLocaleString()} potential clients for you.`}
          </p>
        )}

        {!fullyComplete && isSearching && !error && (
          <Alert>
            <AlertTitle>
              {displayCount > 0
                ? `Finding potential clients… ${displayCount.toLocaleString()} found so far.`
                : "Finding potential clients…"}
            </AlertTitle>
            <AlertDescription>
              You can leave this page anytime. We&apos;ll email you when your results are ready,
              and you can return to your dashboard to check progress.
            </AlertDescription>
          </Alert>
        )}

        {error && (
          <Alert variant="danger">
            <AlertTitle>{error}</AlertTitle>
            {showLimitMessage && (
              <AlertDescription>
                You have reached your search limit. Top up from the options below to continue
                searching.
              </AlertDescription>
            )}
            <Button variant="outline" size="sm" className="mt-3" onClick={handleClearResults}>
              Try Again
            </Button>
          </Alert>
        )}
      </div>

      <AffiliateSection />

      {showWelcome && <WelcomeState onExampleSearch={handleExampleSearch} />}

      <OutreachWorkspace
        outreach={outreach}
        businessType={businessType}
        location={location}
        onBusinessTypeChange={setBusinessType}
        onLocationChange={setLocation}
        onSearch={handleSearch}
        searchDisabled={isSearching}
        selectedLeads={selectedLeads}
        sendPanelOpen={sendPanelOpen}
        onCloseSendPanel={() => setSendPanelOpen(false)}
        onSendComplete={() => setSelectedLeadIds(new Set())}
        targetBusinessType={query}
        resultsHeader={
          (isSearching || tableLeads.length > 0 || isQueuedWaiting || savedBanner) ? (
            <div className="space-y-4">
              {isQueuedWaiting && <SearchQueueCard queuePosition={queuePosition} />}
              {savedBanner && (
                <div className="rounded-lg border border-violet-500/30 bg-violet-500/10 px-4 py-3 text-sm text-[#A1A1B5]">
                  {savedBanner}
                </div>
              )}
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <LiveCounter count={displayCount} isSearching={isSearching} />
                {(isSearching || phaseMessage) && !isQueuedWaiting && (
                  <span className="flex items-center gap-2 text-sm text-[#A1A1B5] sm:max-w-[65%]">
                    {isSearching && !isQueuedWaiting && (
                      <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-[#A855F7]" />
                    )}
                    {phaseMessage}
                  </span>
                )}
              </div>
              {isSearching && !isQueuedWaiting && <Progress value={progress} className="h-2" />}
              {fullyComplete && regionCitySuggestions.length > 0 && (
                  <RegionCityChips
                    suggestions={regionCitySuggestions}
                    message={regionSelectionMessage ?? undefined}
                    onSelectCity={(city) => {
                      setLocation(city);
                      void runSearchWithRegionCity(city);
                    }}
                  />
                )}
            </div>
          ) : null
        }
        resultsFooter={
          (isSearching || tableLeads.length > 0 || savedBanner) ? (
            <div className="space-y-4">
              <NearbyCityChips
                show={fullyComplete && !isSearching}
                cities={nearbyCities}
                onSelectCity={(city) => {
                  setLocation(city);
                  void runSearchWithNearbyCity(city);
                }}
              />
              <ResultsActionsBar
                exportCount={exportCount}
                onDownload={handleDownload}
                onClear={handleClearResults}
                exportPulse={exportPulse}
                isMobile={isMobile}
              />
            </div>
          ) : null
        }
        resultsContent={
          (isSearching || tableLeads.length > 0 || savedBanner) ? (
            <DiscoveryResultsLayout
              activeLead={activeLead}
              leadStatus={activeLead ? leadStatuses[activeLead.id] || "new" : undefined}
              onCloseDetails={() => setActiveLeadId(null)}
              onSaveLead={handleSaveLead}
              onAddToOutreach={handleAddToOutreach}
              onGenerateOutreach={handleGenerateOutreach}
            >
              <ResultsTable
                leads={visibleTableLeads}
                isLoading={isSearching && tableLeads.length === 0}
                isMobile={isMobile}
                hideEmptyPlaceholder={showWelcome}
                ratingFilter={ratingFilter}
                onRatingFilterChange={setRatingFilter}
                totalLeadCount={tableLeads.length}
                ratingMatchCount={ratingFilteredTableLeads.length}
                summaryLeads={ratingFilteredTableLeads}
                leadStatuses={leadStatuses}
                statusFilter={statusFilter}
                onStatusFilterChange={setStatusFilter}
                onLeadStatusChange={setLeadStatus}
                onUseTemplate={setTemplateLead}
                emailScrapingInProgress={!emailScrapingComplete && tableLeads.length > 0}
                selectedLeadIds={selectedLeadIds}
                onToggleLeadSelect={toggleLeadSelect}
                onSendSelected={openSendPanel}
                hasMailbox={outreach.hasMailbox}
                onNoMailboxClick={scrollToMailboxes}
                activeLeadId={activeLeadId}
                onLeadClick={handleLeadClick}
                onMarkReplied={(lead) => {
                  const recipient = (lead.verified_emails?.[0] || lead.email || "").trim();
                  if (!recipient) return;
                  void markRecipientReplied(recipient).then(() => {
                    setLeadStatus(lead.id, "interested");
                  });
                }}
              />
            </DiscoveryResultsLayout>
          ) : (
            <div className="rounded-xl border border-[var(--lt-border)] bg-[var(--lt-surface)] px-4 py-10 text-center">
              <p className="text-sm font-medium text-[var(--lt-text)]">No results yet</p>
              <p className="mt-1 text-sm text-[var(--lt-text-muted)]">
                Run a search above to discover businesses, then select rows for outreach.
              </p>
            </div>
          )
        }
      />

      <DashboardHistorySections
        isMobile={isMobile}
        refreshKey={historyRefreshKey}
        onSearchAgain={handleSearchAgain}
      />

      {loadingSuggestions && fullyComplete && (
        <div className="rounded-xl border border-[var(--lt-border)] bg-[var(--lt-surface)] p-4 text-sm text-[var(--lt-text-muted)]">
          Generating smart suggestions for your search...
        </div>
      )}

      {suggestions.length > 0 && fullyComplete && (
        <div className="rounded-xl border border-[var(--lt-border)] bg-[var(--lt-surface)] p-4 sm:p-6">
          <p className="text-base font-semibold text-[var(--lt-text)]">Want more results?</p>
          <p className="mt-1 text-sm text-[var(--lt-text-muted)]">
            {suggestionsMessage ||
              "Click an area below to find more potential clients and add them to your list."}
          </p>
          <p className="mt-1 text-xs font-medium text-[var(--lt-cyan)]">
            Each area search adds new potential clients without clearing your current results.
          </p>
          <div
            className={`mt-4 grid gap-2 ${
              isMobile ? "grid-cols-2" : "grid-cols-[repeat(auto-fill,minmax(200px,1fr))]"
            }`}
          >
            {suggestions.map((s, i) => (
              <Button
                key={`${s.location}-${i}`}
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handleSuggestionClick(s)}
                disabled={isSearching}
                className="justify-center"
              >
                {s.label}
              </Button>
            ))}
          </div>
          <p className="mt-3 text-[11px] text-[var(--lt-text-subtle)]">
            Suggestions are generated for your specific search and location.
          </p>
        </div>
      )}

      {showLimitModal && userEmail && (
        <SearchLimitModal email={userEmail} onClose={() => setShowLimitModal(false)} />
      )}

      <WhatsappTemplateModal
        lead={templateLead}
        searchLocation={loc}
        userEmail={userEmail}
        creditsRemaining={creditsRemaining}
        onClose={() => setTemplateLead(null)}
        onCreditsUpdated={handleCreditsUpdated}
        onCreditDeducted={handleCreditDeducted}
        onGetMoreCredits={() => setShowLimitModal(true)}
      />
    </div>
  );
}
