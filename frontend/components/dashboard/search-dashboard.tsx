"use client";

import { motion } from "framer-motion";
import { Search, Download, RotateCcw, Trash2, Loader2 } from "lucide-react";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { LiveCounter } from "@/components/dashboard/live-counter";
import { SearchHistory } from "@/components/dashboard/search-history";
import { ResultsTable } from "@/features/results/results-table";
import { useSearch } from "@/hooks/useSearch";
import { exportToCSV } from "@/features/export/csv-export";
export function SearchDashboard() {
  const [businessType, setBusinessType] = useState("");
  const [location, setLocation] = useState("");
  const [savedBanner, setSavedBanner] = useState<string | null>(null);
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
    searchesRemaining,
    runSearch,
    clearResults,
    closeStream,
    loadSavedLeads,
  } = useSearch();

  const handleSearch = () => {
    setSavedBanner(null);
    void runSearch(businessType, location);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSearch();
  };

  const handleDownload = () => {
    exportToCSV(
      leads,
      `leadpilot-${searchMeta.business || businessType}-${searchMeta.location || location}-${Date.now()}.csv`
    );
  };

  const handleNewSearch = () => {
    closeStream();
    clearResults();
    setSavedBanner(null);
    setBusinessType("");
    setLocation("");
  };

  return (
    <div className="space-y-8">
      <div className="glass rounded-2xl p-6">
        <h1 className="text-2xl font-bold text-[#F4F4FF]">Discover Prospects</h1>
        <p className="mt-1 text-sm text-[#6B6B80]">
          Build client lists by niche and location — contacts stream in realtime.
        </p>

        {searchesRemaining != null && (
          <p className="mt-3 text-xs text-[#6B6B80]">
            {searchesRemaining} searches remaining this month
          </p>
        )}

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-[#6B6B80]">Business type</label>
            <Input
              placeholder="e.g. restaurants, dentists, gyms"
              value={businessType}
              onChange={(e) => setBusinessType(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isSearching}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-[#6B6B80]">Location</label>
            <Input
              placeholder="e.g. Lagos Nigeria, London UK, California USA"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isSearching}
            />
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-3">
          <Button type="button" variant="glow" onClick={handleSearch} disabled={isSearching}>
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
            disabled={leads.length === 0}
          >
            <Download className="h-4 w-4" />
            Export {leads.length} leads to CSV
          </Button>
          {leads.length > 0 && (
            <>
              <Button variant="ghost" onClick={handleNewSearch}>
                <RotateCcw className="h-4 w-4" /> New Search
              </Button>
              <Button variant="ghost" onClick={clearResults}>
                <Trash2 className="h-4 w-4" /> Clear Results
              </Button>
            </>
          )}
        </div>

        {error && (
          <div
            role="alert"
            className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3"
          >
            <p className="text-sm text-red-300">{error}</p>
            {showLimitMessage && (
              <p className="mt-2 text-sm text-[#A1A1B5]">
                You have used all your searches for this month. Your searches reset on the
                date shown in the message above. Contact support to increase your limit.
              </p>
            )}
            <Button variant="outline" size="sm" className="mt-3" onClick={clearResults}>
              Try Again
            </Button>
          </div>
        )}

        {status === "completed" && !error && !savedBanner && (
          <p className="mt-4 text-sm text-[#A1A1B5]">
            Search complete. Found {totalFound} businesses.
          </p>
        )}
      </div>

      <SearchHistory
        onViewResults={(historyLeads, meta) => {
          loadSavedLeads(historyLeads);
          setSavedBanner(
            `Showing saved results from ${meta.date}. Run a new search to get fresh results.`
          );
        }}
      />

      {(isSearching || leads.length > 0) && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-4"
        >
          {savedBanner && (
            <div className="rounded-lg border border-violet-500/30 bg-violet-500/10 px-4 py-3 text-sm text-[#A1A1B5]">
              {savedBanner}
            </div>
          )}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <LiveCounter count={leads.length} isSearching={isSearching} />
            {(isSearching || phaseMessage) && (
              <span className="flex items-center gap-2 text-sm text-[#A1A1B5] sm:max-w-[65%]">
                {isSearching && (
                  <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-[#A855F7]" />
                )}
                {phaseMessage}
              </span>
            )}
          </div>
          {isSearching && <Progress value={progress} className="h-2" />}
        </motion.div>
      )}

      <ResultsTable leads={leads} isLoading={isSearching && leads.length === 0} />
    </div>
  );
}
