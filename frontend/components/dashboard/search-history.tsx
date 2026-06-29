"use client";

import { useEffect, useState } from "react";
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
  onViewResults: (leads: Lead[], meta: { query: string; location: string; date: string }) => void;
}

export function SearchHistory({
  isMobile = false,
  refreshKey = 0,
  onViewResults,
}: SearchHistoryProps) {
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [exportingId, setExportingId] = useState<string | null>(null);
  const [historyExpanded, setHistoryExpanded] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("lp_history_expanded") === "true";
  });

  useEffect(() => {
    void (async () => {
      try {
        const data = await getSearchHistory();
        setHistory(data.history ?? []);
      } catch {
        setHistory([]);
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

  if (loading || history.length === 0) return null;

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
    try {
      const { leads } = await getResults(item.search_id);
      onViewResults(leads, {
        query: item.query,
        location: item.location,
        date: formatDate(item.created_at),
      });
    } catch {
      window.alert("Could not load this search. Try running it again from the dashboard.");
    }
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
    <div className="glass rounded-2xl px-6 pt-4 pb-2">
      <div
        role="button"
        tabIndex={0}
        onClick={toggleHistory}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") toggleHistory();
        }}
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          cursor: "pointer",
          padding: "12px 0",
          borderBottom: historyExpanded ? "1px solid rgba(255,255,255,0.07)" : "none",
        }}
      >
        <div>
          <div
            style={{
              color: "#F4F4FF",
              fontWeight: 700,
              fontSize: 15,
              fontFamily: "Bricolage Grotesque, sans-serif",
            }}
          >
            Search History
          </div>
          <div style={{ color: "#6B6B80", fontSize: 12 }}>
            {history.length} saved searches — view or export anytime
          </div>
        </div>
        <span
          style={{
            color: "#6B6B80",
            fontSize: 18,
            transform: historyExpanded ? "rotate(180deg)" : "rotate(0deg)",
            transition: "transform 0.2s",
          }}
        >
          ⌄
        </span>
      </div>

      {historyExpanded && (
        <div className="mt-4 pb-4">
          {isMobile ? (
            <div className="flex flex-col gap-2.5">
              {history.map((item) => (
                <div
                  key={item.id}
                  style={{
                    background: "#16161E",
                    borderRadius: 10,
                    padding: 14,
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 12,
                  }}
                >
                  <div className="min-w-0">
                    <div
                      style={{
                        color: "#F4F4FF",
                        fontSize: 13,
                        fontWeight: 600,
                      }}
                    >
                      {item.query} in {item.location}
                    </div>
                    <div style={{ color: "#6B6B80", fontSize: 11, marginTop: 2 }}>
                      {item.total_found} potential clients ·{" "}
                      {new Date(item.created_at).toLocaleDateString()}
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-1.5">
                    <button
                      type="button"
                      disabled={!item.search_id}
                      onClick={() => void handleView(item)}
                      style={{
                        background: "rgba(124,58,237,0.15)",
                        border: "none",
                        color: "#A855F7",
                        padding: "6px 10px",
                        borderRadius: 6,
                        fontSize: 11,
                        cursor: item.search_id ? "pointer" : "not-allowed",
                      }}
                    >
                      View
                    </button>
                    <button
                      type="button"
                      disabled={!item.search_id || exportingId === item.id}
                      onClick={() => void handleExport(item)}
                      style={{
                        background: "rgba(255,255,255,0.05)",
                        border: "none",
                        color: "#6B6B80",
                        padding: "6px 10px",
                        borderRadius: 6,
                        fontSize: 11,
                        cursor: item.search_id ? "pointer" : "not-allowed",
                      }}
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
                  <tr className="border-b border-white/[0.08] text-left text-xs uppercase tracking-wider text-[#6B6B80]">
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
                      className="border-b border-white/[0.04] text-[#A1A1B5]"
                    >
                      <td className="px-3 py-3 text-white">{item.query}</td>
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
