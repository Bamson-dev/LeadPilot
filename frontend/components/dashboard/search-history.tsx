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
  onViewResults: (leads: Lead[], meta: { query: string; location: string; date: string }) => void;
}

export function SearchHistory({ onViewResults }: SearchHistoryProps) {
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [exportingId, setExportingId] = useState<string | null>(null);

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
  }, []);

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
    const { leads } = await getResults(item.search_id);
    onViewResults(leads, {
      query: item.query,
      location: item.location,
      date: formatDate(item.created_at),
    });
  };

  const handleExport = async (item: HistoryItem) => {
    if (!item.search_id) return;
    setExportingId(item.id);
    try {
      const { leads } = await getResults(item.search_id);
      exportToCSV(
        leads,
        `leadpilot-${item.query}-${item.location}-${item.id}.csv`
      );
    } finally {
      setExportingId(null);
    }
  };

  return (
    <div className="glass rounded-2xl p-6">
      <h2 className="text-lg font-semibold text-[#F4F4FF]">Search History</h2>
      <p className="mt-1 text-sm text-[#6B6B80]">Your recent searches — view or export anytime.</p>

      <div className="mt-4 overflow-x-auto">
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
                      {exportingId === item.id ? "Exporting…" : "Export CSV"}
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
