"use client";

import { motion } from "framer-motion";
import { Search, Download, RotateCcw, Trash2, Loader2 } from "lucide-react";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { LiveCounter } from "@/components/dashboard/live-counter";
import { ExportModal } from "@/components/dashboard/export-modal";
import { ResultsTable } from "@/features/results/results-table";
import { useSearch } from "@/hooks/useSearch";
import { exportCSV } from "@/features/export/csv-export";
import { MAX_EXPORT_ROWS } from "@/utils/constants";

export function SearchDashboard() {
  const [businessType, setBusinessType] = useState("");
  const [location, setLocation] = useState("");
  const [exportOpen, setExportOpen] = useState(false);
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
    clearResults,
    closeStream,
  } = useSearch();

  const handleSearch = () => {
    void runSearch(businessType, location);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSearch();
  };

  const handleDownload = () => {
    exportCSV(
      leads.slice(0, MAX_EXPORT_ROWS),
      searchMeta.business || businessType,
      searchMeta.location || location
    );
    setExportOpen(false);
  };

  const handleNewSearch = () => {
    closeStream();
    clearResults();
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
          {leads.length > 0 && (
            <>
              <Button variant="outline" onClick={() => setExportOpen(true)} disabled={isSearching}>
                <Download className="h-4 w-4" /> Export CSV
              </Button>
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
                date shown above. Contact support to increase your limit.
              </p>
            )}
            <Button variant="outline" size="sm" className="mt-3" onClick={clearResults}>
              Try Again
            </Button>
          </div>
        )}

        {status === "completed" && !error && (
          <p className="mt-4 text-sm text-emerald-400">
            Search complete. Found {totalFound} businesses.
          </p>
        )}
      </div>

      {(isSearching || leads.length > 0) && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-4"
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <LiveCounter count={leads.length} isSearching={isSearching} />
            {isSearching && (
              <span className="flex items-center gap-2 text-xs text-[#A855F7] sm:max-w-[60%]">
                <Loader2 className="h-3 w-3 shrink-0 animate-spin" />
                {phaseMessage || `Found ${leads.length} businesses so far...`}
              </span>
            )}
          </div>
          {isSearching && <Progress value={progress} className="h-2" />}
          {isSearching && leads.length > 0 && (
            <p className="text-sm text-[#6B6B80]">
              Found {leads.length} businesses so far...
            </p>
          )}
        </motion.div>
      )}

      <ResultsTable leads={leads} isLoading={isSearching && leads.length === 0} />

      <ExportModal
        open={exportOpen}
        onOpenChange={setExportOpen}
        count={Math.min(leads.length, MAX_EXPORT_ROWS)}
        onDownload={handleDownload}
      />
    </div>
  );
}
