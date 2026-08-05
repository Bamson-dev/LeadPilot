"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSearchHistory, getResults } from "@/services/api";
import { exportToCSV } from "@/features/export/csv-export";
import type { Lead } from "@/types/lead";
import { Button } from "@/components/ui/button";

export interface HistoryItem {
  id: string;
  query: string;
  location: string;
  total_found: number;
  created_at: string;
  search_id: string | null;
}

interface SearchHistoryProps {
  isMobile?: boolean;
  refreshKey?: number;
  onViewResults?: (leads: Lead[], meta: { query: string; location: string; date: string }) => void;
}

export function SearchHistory({
  isMobile = false,
  refreshKey = 0,
}: SearchHistoryProps) {
  const router = useRouter();
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [exportingId, setExportingId] = useState<string | null>(null);
  const [historyExpanded, setHistoryExpanded] = useState(() => {
    if (typeof window === "undefined") return true;
    const stored = localStorage.getItem("lp_history_expanded");
    if (stored === "false") return false;
    return true;
  });

  useEffect(() => {
    void (async () => {
      try {
        const data = await getSearchHistory();
        setHistory(data.history ?? []);
      } catch {
        // Preserve existing rows on transient errors (e.g. temporary 429).
      } finally {
        setLoading(false);
      }
    })();
  }, [refreshKey]);

  function toggleHistory() {
    const newVal = !historyExpanded;
    setHistoryExpanded(newVal);
    localStorage.setItem("lp_history_expanded", String(newVal));
  }

  if (loading) {
    return (
      <div className="rounded-xl border border-[var(--lt-border)] bg-[var(--lt-surface)] px-6 py-4">
        <div className="text-sm text-[var(--lt-text-muted)]">Loading search history…</div>
      </div>
    );
  }

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString(undefined, {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

  const handleView = async (item: HistoryItem) => {
    if (!item.search_id) return;
    router.push(`/dashboard/search/${encodeURIComponent(item.search_id)}`);
  };

  const handleExport = async (item: HistoryItem) => {
    if (!item.search_id) return;
    setExportingId(item.id);
    try {
      const { leads } = await getResults(item.search_id);
      exportToCSV(leads, `leadthur-${item.query}-${item.location}-${item.id}.csv`);
    } catch {
      window.alert("Could not download leads for this search.");
    } finally {
      setExportingId(null);
    }
  };

  return (
    <div className="rounded-xl border border-[var(--lt-border)] bg-[var(--lt-surface)] px-6 pt-4 pb-2">
      <div
        role="button"
        tabIndex={0}
        onClick={toggleHistory}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") toggleHistory();
        }}
        className={`flex cursor-pointer items-center justify-between py-3 ${
          historyExpanded ? "border-b border-[var(--lt-border)]" : ""
        }`}
      >
        <div>
          <div className="text-[15px] font-bold text-[var(--lt-text)]">
            Search History
          </div>
          <div className="text-xs text-[var(--lt-text-muted)]">
            {history.length > 0
              ? `${history.length} saved searches — view or export anytime`
              : "Your completed searches will appear here"}
          </div>
        </div>
        <span
          className={`text-lg text-[var(--lt-text-muted)] transition-transform duration-200 ${
            historyExpanded ? "rotate-180" : "rotate-0"
          }`}
        >
          ⌄
        </span>
      </div>

      {historyExpanded && (
        <div className="mt-4 pb-4">
          {history.length === 0 ? (
            <p className="pb-2 text-sm text-[var(--lt-text-muted)]">
              No saved searches yet. Run a search above and it will show up here when complete.
            </p>
          ) : isMobile ? (
            <div className="flex flex-col gap-2.5">
              {history.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between gap-3 rounded-[10px] bg-[var(--lt-surface-2)] p-3.5"
                >
                  <div className="min-w-0">
                    <div className="text-[13px] font-semibold text-[var(--lt-text)]">
                      {item.query} in {item.location}
                    </div>
                    <div className="mt-0.5 text-[11px] text-[var(--lt-text-muted)]">
                      {item.total_found} potential clients ·{" "}
                      {new Date(item.created_at).toLocaleDateString()}
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-1.5">
                    <button
                      type="button"
                      disabled={!item.search_id}
                      onClick={() => void handleView(item)}
                      className="cursor-pointer rounded-md border-0 bg-[var(--lt-accent)]/15 px-2.5 py-1.5 text-[11px] text-[var(--lt-accent-soft)] disabled:cursor-not-allowed"
                    >
                      View
                    </button>
                    <button
                      type="button"
                      disabled={!item.search_id || exportingId === item.id}
                      onClick={() => void handleExport(item)}
                      className="cursor-pointer rounded-md border-0 bg-[var(--lt-surface-3)] px-2.5 py-1.5 text-[11px] text-[var(--lt-text-muted)] disabled:cursor-not-allowed"
                    >
                      {exportingId === item.id ? "…" : "Leads"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="border-b border-[var(--lt-border)] text-left text-xs uppercase tracking-wider text-[var(--lt-text-muted)]">
                    <th className="px-3 py-2">Business Type</th>
                    <th className="px-3 py-2">Location</th>
                    <th className="px-3 py-2">Leads Found</th>
                    <th className="px-3 py-2">Date</th>
                    <th className="px-3 py-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((item) => (
                    <tr
                      key={item.id}
                      className="border-b border-[var(--lt-border)] text-[var(--lt-text-muted)]"
                    >
                      <td className="px-3 py-3 text-[var(--lt-text)]">{item.query}</td>
                      <td className="px-3 py-3">{item.location}</td>
                      <td className="px-3 py-3">{item.total_found}</td>
                      <td className="px-3 py-3 whitespace-nowrap">
                        {formatDate(item.created_at)}
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex flex-wrap gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={!item.search_id}
                            onClick={() => void handleView(item)}
                          >
                            View Results
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            disabled={!item.search_id || exportingId === item.id}
                            onClick={() => void handleExport(item)}
                          >
                            {exportingId === item.id ? "Downloading…" : "Download Leads"}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
