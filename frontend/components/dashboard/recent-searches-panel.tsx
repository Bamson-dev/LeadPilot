"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchRecentSearchHistory, saveSearchHistory } from "@/services/api";
import { formatRelativeSearchTime, formatSearchLocation } from "@/lib/search-location";

export type RecentSearchItem = {
  id: string;
  business_type: string;
  city: string;
  country: string | null;
  results_count: number;
  created_at: string;
};

interface RecentSearchesPanelProps {
  refreshKey?: number;
  onSearchAgain: (businessType: string, location: string) => void;
}

export function RecentSearchesPanel({
  refreshKey = 0,
  onSearchAgain,
}: RecentSearchesPanelProps) {
  const [history, setHistory] = useState<RecentSearchItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(() => {
    if (typeof window === "undefined") return true;
    return localStorage.getItem("lp_recent_searches_expanded") !== "false";
  });

  const loadHistory = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchRecentSearchHistory();
      setHistory(data.history ?? []);
    } catch {
      setHistory([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory, refreshKey]);

  function toggleExpanded() {
    const next = !expanded;
    setExpanded(next);
    localStorage.setItem("lp_recent_searches_expanded", String(next));
  }

  return (
    <div className="glass rounded-2xl px-4 sm:px-6 pt-4 pb-2">
      <div
        role="button"
        tabIndex={0}
        onClick={toggleExpanded}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") toggleExpanded();
        }}
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          cursor: "pointer",
          padding: "12px 0",
          borderBottom: expanded ? "1px solid rgba(255,255,255,0.07)" : "none",
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
            Recent Searches
          </div>
          <div style={{ color: "#6B6B80", fontSize: 12 }}>
            {loading
              ? "Loading..."
              : history.length > 0
                ? `${history.length} saved searches`
                : "Your past dashboard searches"}
          </div>
        </div>
        <span
          style={{
            color: "#6B6B80",
            fontSize: 18,
            transform: expanded ? "rotate(180deg)" : "rotate(0deg)",
            transition: "transform 0.2s",
          }}
        >
          ⌄
        </span>
      </div>

      {expanded && (
        <div className="mt-4 pb-4">
          {loading ? (
            <p style={{ color: "#6B6B80", fontSize: 13, margin: 0 }}>
              Loading search history...
            </p>
          ) : history.length === 0 ? (
            <p style={{ color: "#6B6B80", fontSize: 13, margin: 0 }}>
              Your searches will appear here automatically.
            </p>
          ) : (
            <div
              style={{
                maxHeight: history.length > 10 ? 420 : undefined,
                overflowY: history.length > 10 ? "auto" : "visible",
                paddingRight: history.length > 10 ? 4 : 0,
              }}
            >
              <div className="flex flex-col gap-2.5">
                {history.map((item) => {
                  const location = formatSearchLocation(item.city, item.country);
                  return (
                    <div
                      key={item.id}
                      style={{
                        background: "#16161E",
                        borderRadius: 10,
                        padding: "12px 14px",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        gap: 12,
                        border: "1px solid rgba(255,255,255,0.06)",
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
                          {item.business_type} in {item.city}
                        </div>
                        <div style={{ color: "#6B6B80", fontSize: 11, marginTop: 3 }}>
                          {item.results_count.toLocaleString()} potential clients ·{" "}
                          {formatRelativeSearchTime(item.created_at)}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => onSearchAgain(item.business_type, location)}
                        style={{
                          background: "rgba(124,58,237,0.15)",
                          border: "1px solid rgba(124,58,237,0.25)",
                          color: "#A855F7",
                          padding: "6px 12px",
                          borderRadius: 6,
                          fontSize: 11,
                          fontWeight: 700,
                          cursor: "pointer",
                          flexShrink: 0,
                          fontFamily: "Inter, sans-serif",
                        }}
                      >
                        Search Again
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export async function recordDashboardSearchHistory(input: {
  email: string;
  businessType: string;
  location: string;
  resultsCount: number;
}): Promise<void> {
  if (!input.email || !input.businessType.trim() || !input.location.trim()) return;
  if (input.resultsCount <= 0) return;

  const { parseSearchLocation } = await import("@/lib/search-location");
  const { city, country } = parseSearchLocation(input.location);

  await saveSearchHistory({
    email: input.email,
    business_type: input.businessType.trim(),
    city: city || input.location.trim(),
    country,
    results_count: input.resultsCount,
  });
}
