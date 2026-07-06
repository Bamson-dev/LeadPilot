"use client";

import { motion } from "framer-motion";
import { Search, Download, RotateCcw, Trash2, Loader2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { BusinessLead } from "@leadthur/shared";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { LiveCounter } from "@/components/dashboard/live-counter";
import { RecentSearchesPanel } from "@/components/dashboard/recent-searches-panel";
import { SearchHistory } from "@/components/dashboard/search-history";
import { AffiliateSection } from "@/components/dashboard/affiliate-section";
import { OutreachSection } from "@/components/dashboard/outreach-section";
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
import { hasAnyEmail } from "@/utils/get-display-email";

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
    reset,
    loadSavedLeads,
    scrapingInProgress,
    emailScrapingComplete,
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

  useEffect(() => {
    if (status === "completed") {
      setShowSuccess(true);
      const t = setTimeout(() => setShowSuccess(false), 3000);
      return () => clearTimeout(t);
    }
  }, [status]);

  useEffect(() => {
    if (status === "completed" && totalFound > 0) {
      setHistoryRefreshKey((prev) => prev + 1);
    }
  }, [status, totalFound]);

  useEffect(() => {
    if (status !== "completed" || suggestions.length > 0) return;
    const q = searchMeta.business || businessType;
    const loc = searchMeta.location || location;
    if (!q.trim() || !loc.trim()) return;
    void fetchSuggestions(q, loc, totalFound, searchedExpansionLocations);
  }, [
    status,
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

  const selectedLeads = useMemo(
    () => statusFilteredTableLeads.filter((lead) => selectedLeadIds.has(lead.id)),
    [statusFilteredTableLeads, selectedLeadIds]
  );

  const toggleLeadSelect = useCallback((leadId: string) => {
    setSelectedLeadIds((prev) => {
      const next = new Set(prev);
      if (next.has(leadId)) next.delete(leadId);
      else next.add(leadId);
      return next;
    });
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

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSearch();
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

  const handleViewSavedResults = useCallback(
    (savedLeads: Lead[], meta: { query: string; location: string; date: string }) => {
      loadSavedLeads(savedLeads);
      setBusinessType(meta.query);
      setLocation(meta.location);
      setSavedBanner(`Showing saved results from ${meta.date}`);
      setRatingFilter("all");
    },
    [loadSavedLeads]
  );

  const startNewSession = () => {
    searchAgainVariationRef.current = 0;
    reset();
    setSuggestionsMessage("");
    setSavedBanner(null);
    setBusinessType("");
    setLocation("");
    setRatingFilter("all");
  };

  const handleNewSearch = () => {
    startNewSession();
  };

  const handleClearResults = () => {
    clearResults();
    setSuggestionsMessage("");
    setSavedBanner(null);
  };

  const displayCount = tableLeads.length;

  const isQueuedWaiting =
    queuePosition > 0 && tableLeads.length === 0 && !scrapingInProgress;

  const showWelcome =
    status === "idle" &&
    tableLeads.length === 0 &&
    !isSearching &&
    !savedBanner;

  const exportCount = tableLeads.length;
  const exportPulse = status === "completed" && exportCount > 0;

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
      <div className="glass rounded-2xl p-4 sm:p-6">
        <h1 className="text-xl sm:text-2xl font-bold text-[#F4F4FF]">
          Discover Prospects
        </h1>
        <p className="mt-1 text-sm text-[#6B6B80]">
          Type a niche. Pick a city. Get contacts in seconds.
        </p>

        {totalDiscovered > 0 && (
          <div
            className="flex items-center gap-1.5 mt-2"
            style={{ marginTop: 6 }}
          >
            <span
              className="inline-block rounded-full status-pulse-dot"
              style={{
                width: 6,
                height: 6,
                background: "#10B981",
              }}
            />
            <span style={{ color: "#6B6B80", fontSize: 12 }}>
              <strong style={{ color: "#F4F4FF" }}>
                {totalDiscovered.toLocaleString()}
              </strong>{" "}
              businesses discovered and counting
            </span>
          </div>
        )}

        <div
          className="mt-6 gap-3"
          style={{
            display: "flex",
            flexDirection: isMobile ? "column" : "row",
            gap: isMobile ? 10 : 12,
          }}
        >
          <div className={isMobile ? "w-full" : "flex-1 min-w-0"}>
            <label className="mb-1.5 block text-xs font-medium text-[#6B6B80]">
              Business type
            </label>
            <Input
              placeholder="e.g. restaurants, dentists, gyms"
              value={businessType}
              onChange={(e) => setBusinessType(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isSearching}
              className="w-full"
            />
          </div>
          <div className={isMobile ? "w-full" : "flex-1 min-w-0"}>
            <label className="mb-1.5 block text-xs font-medium text-[#6B6B80]">
              Location
            </label>
            <Input
              placeholder="e.g. Lagos Nigeria, London UK, California USA"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isSearching}
              className="w-full"
            />
            {location.length > 0 &&
              [
                "china",
                "usa",
                "uk",
                "india",
                "australia",
                "canada",
                "france",
                "germany",
                "japan",
                "brazil",
                "russia",
                "mexico",
                "indonesia",
                "nigeria",
              ].some((country) => location.toLowerCase().trim() === country) && (
                <p
                  style={{
                    fontSize: 11,
                    color: "#FBBF24",
                    marginTop: 4,
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                  }}
                >
                  ⚠️ Tip: Use a specific city for better results. Try Beijing, Shanghai, or
                  Guangzhou instead of China.
                </p>
              )}
          </div>
        </div>

        {activity.length > 0 && status === "idle" && !isSearching && (
          <div
            className="flex flex-wrap gap-2 mt-3 mb-1"
            style={{ marginTop: 12, marginBottom: 4 }}
          >
            <span
              className="text-[11px] self-center whitespace-nowrap"
              style={{ color: "#6B6B80" }}
            >
              Recent:
            </span>
            {activity.slice(0, isMobile ? 3 : 5).map((a, i) => (
              <div
                key={`${a.query}-${a.location}-${i}`}
                style={{
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.06)",
                  borderRadius: 100,
                  padding: "4px 10px",
                  fontSize: 11,
                  color: "#A1A1AA",
                  whiteSpace: "nowrap",
                }}
              >
                <span style={{ color: "#F4F4FF" }}>{a.total_found}</span> {a.query}{" "}
                in {a.location}
              </div>
            ))}
          </div>
        )}

        <div
          className="mt-4 gap-2.5"
          style={{
            display: "flex",
            flexDirection: isMobile ? "column" : "row",
            flexWrap: isMobile ? "nowrap" : "wrap",
            gap: 10,
            marginTop: 10,
          }}
        >
          <Button
            type="button"
            variant="glow"
            onClick={handleSearch}
            disabled={isSearching}
            className={isMobile ? "w-full" : ""}
            style={isMobile ? { flex: 1, width: "100%" } : undefined}
          >
            {isSearching ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Search className="h-4 w-4" />
            )}
            Search
          </Button>
          <Button
            variant="outline"
            onClick={handleDownload}
            disabled={exportCount === 0}
            className={[
              isMobile ? "w-full" : "",
              exportPulse ? "export-pulse-btn" : "",
            ].join(" ")}
            style={isMobile ? { flex: 1, width: "100%" } : undefined}
          >
            <Download className="h-4 w-4" />
            Download {exportCount > 0 ? exportCount : ""} Leads
          </Button>
          {(tableLeads.length > 0 || isSearching) && (
            <>
              <Button
                variant="ghost"
                onClick={handleNewSearch}
                className={isMobile ? "w-full" : ""}
                style={isMobile ? { flex: 1, width: "100%" } : undefined}
              >
                <RotateCcw className="h-4 w-4" /> New Search
              </Button>
              <Button
                variant="ghost"
                onClick={handleClearResults}
                className={isMobile ? "w-full" : ""}
                style={isMobile ? { flex: 1, width: "100%" } : undefined}
              >
                <Trash2 className="h-4 w-4" /> Clear Results
              </Button>
            </>
          )}
        </div>

        {showSuccess && (
          <div
            className="success-banner-fade mt-4"
            style={{
              background: "rgba(16,185,129,0.1)",
              border: "1px solid rgba(16,185,129,0.2)",
              borderRadius: 10,
              padding: "12px 16px",
              display: "flex",
              alignItems: "center",
              gap: 10,
            }}
          >
            <span style={{ fontSize: 20 }}>✓</span>
            <div>
              <div style={{ color: "#10B981", fontWeight: 700, fontSize: 14 }}>
                Search complete
              </div>
              <div style={{ color: "#6B6B80", fontSize: 12 }}>
                We found {totalFound.toLocaleString()} potential clients for you. Your leads are
                ready to export.
              </div>
            </div>
          </div>
        )}

        {status === "completed" && !error && !savedBanner && !showSuccess && (
          <p className="mt-4 text-sm text-[#A1A1B5]">
            {tableLeads.length === 0
              ? "No potential clients found in this area. Try a nearby city."
              : `We found ${tableLeads.length.toLocaleString()} potential clients for you.`}
          </p>
        )}

        {error && (
          <div
            role="alert"
            className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3"
          >
            <p className="text-sm text-red-300">{error}</p>
            {showLimitMessage && (
              <p className="mt-2 text-sm text-[#A1A1B5]">
                You have reached your search limit. Top up from the options below to continue
                searching.
              </p>
            )}
            <Button variant="outline" size="sm" className="mt-3" onClick={handleClearResults}>
              Try Again
            </Button>
          </div>
        )}
      </div>

      <OutreachSection
        selectedLeads={selectedLeads}
        sendPanelOpen={sendPanelOpen}
        onCloseSendPanel={() => setSendPanelOpen(false)}
        onRequestSendPanel={() => setSendPanelOpen(true)}
      />

      <AffiliateSection />

      {showWelcome && <WelcomeState onExampleSearch={handleExampleSearch} />}

      {(isSearching || tableLeads.length > 0 || isQueuedWaiting) && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-4"
        >
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
          {status === "completed" &&
            emailScrapingComplete &&
            regionCitySuggestions.length > 0 && (
          <RegionCityChips
            suggestions={regionCitySuggestions}
            message={regionSelectionMessage ?? undefined}
            onSelectCity={(city) => {
              setLocation(city);
              void runSearchWithRegionCity(city);
            }}
          />
          )}
          <NearbyCityChips
            show={status === "completed" && emailScrapingComplete && !isSearching}
            cities={nearbyCities}
            onSelectCity={(city) => {
              setLocation(city);
              void runSearchWithNearbyCity(city);
            }}
          />
        </motion.div>
      )}

      {(isSearching || tableLeads.length > 0 || savedBanner) && (
        <ResultsTable
          leads={statusFilteredTableLeads}
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
          onToggleLeadSelect={(leadId) => {
            const lead = statusFilteredTableLeads.find((l) => l.id === leadId);
            if (lead && hasAnyEmail(lead)) toggleLeadSelect(leadId);
          }}
          onSendSelected={() => setSendPanelOpen(true)}
        />
      )}

      <RecentSearchesPanel
        refreshKey={historyRefreshKey}
        onSearchAgain={handleSearchAgain}
      />

      <SearchHistory
        isMobile={isMobile}
        refreshKey={historyRefreshKey}
        onViewResults={handleViewSavedResults}
      />

      {loadingSuggestions && status === "completed" && (
        <div
          style={{
            background: "#0F0F14",
            border: "1px solid rgba(255,255,255,0.07)",
            borderRadius: 14,
            padding: 16,
            marginTop: 16,
            color: "#6B6B80",
            fontSize: 13,
          }}
        >
          Generating smart suggestions for your search...
        </div>
      )}

      {suggestions.length > 0 && status === "completed" && (
        <div
          style={{
            background: "#0F0F14",
            border: "1px solid rgba(124,58,237,0.2)",
            borderRadius: 14,
            padding: isMobile ? 16 : 24,
            marginTop: 16,
          }}
        >
          <div style={{ marginBottom: 14 }}>
            <p
              style={{
                color: "#F4F4FF",
                fontWeight: 700,
                fontSize: 15,
                margin: "0 0 6px",
                fontFamily: "Bricolage Grotesque, sans-serif",
              }}
            >
              Want more results?
            </p>
            <p
              style={{
                color: "#6B6B80",
                fontSize: 13,
                margin: "0 0 4px",
                lineHeight: 1.6,
              }}
            >
              {suggestionsMessage ||
                `Click an area below to find more potential clients and add them to your list.`}
            </p>
            <p
              style={{
                color: "#A855F7",
                fontSize: 12,
                margin: 0,
                fontWeight: 500,
              }}
            >
              Each area search adds new potential clients without clearing your current results.
            </p>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: isMobile
                ? "1fr 1fr"
                : "repeat(auto-fill, minmax(200px, 1fr))",
              gap: 8,
              marginBottom: 12,
            }}
          >
            {suggestions.map((s, i) => (
              <button
                key={`${s.location}-${i}`}
                type="button"
                onClick={() => handleSuggestionClick(s)}
                disabled={isSearching}
                style={{
                  background: "transparent",
                  border: "1px solid rgba(124,58,237,0.3)",
                  color: "#A855F7",
                  padding: "8px 16px",
                  borderRadius: 8,
                  fontSize: 13,
                  cursor: isSearching ? "not-allowed" : "pointer",
                  fontWeight: 500,
                  transition: "all 0.15s",
                  fontFamily: "Figtree, sans-serif",
                  opacity: isSearching ? 0.5 : 1,
                  textAlign: "center",
                }}
                onMouseOver={(e) => {
                  if (isSearching) return;
                  e.currentTarget.style.background = "rgba(124,58,237,0.12)";
                  e.currentTarget.style.borderColor = "#7C3AED";
                  e.currentTarget.style.color = "#F4F4FF";
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.background = "transparent";
                  e.currentTarget.style.borderColor = "rgba(124,58,237,0.3)";
                  e.currentTarget.style.color = "#A855F7";
                }}
              >
                {s.label}
              </button>
            ))}
          </div>

          <p style={{ color: "#6B6B80", fontSize: 11, margin: 0 }}>
            Powered by LeadThur — suggestions are generated for your specific search and
            location
          </p>
        </div>
      )}

      {isMobile && exportCount > 0 && (
        <>
          <div style={{ height: 80 }} />
          <div
            style={{
              position: "fixed",
              bottom: 0,
              left: 0,
              right: 0,
              padding: "12px 16px",
              background: "rgba(7,7,10,0.95)",
              backdropFilter: "blur(20px)",
              borderTop: "1px solid rgba(255,255,255,0.07)",
              zIndex: 50,
            }}
          >
            <button
              type="button"
              onClick={handleDownload}
              className={exportPulse ? "export-pulse-btn" : ""}
              style={{
                width: "100%",
                background: "#7C3AED",
                color: "white",
                border: "none",
                padding: "14px",
                borderRadius: 10,
                fontSize: 15,
                fontWeight: 700,
                cursor: "pointer",
                fontFamily: "Figtree, sans-serif",
              }}
            >
              Download {exportCount} Leads
            </button>
          </div>
        </>
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
