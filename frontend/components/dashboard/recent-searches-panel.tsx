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
      // Preserve existing rows on transient errors (e.g. temporary 429).
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
    <div className="rounded-xl border border-[var(--lt-border)] bg-[var(--lt-surface)] px-4 sm:px-6 pt-4 pb-2">
      <div
        role="button"
        tabIndex={0}
        onClick={toggleExpanded}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") toggleExpanded();
        }}
        className={`flex cursor-pointer items-center justify-between py-3 ${
          expanded ? "border-b border-[var(--lt-border)]" : ""
        }`}
      >
        <div>
          <div className="text-[15px] font-bold text-[var(--lt-text)]">
            Recent Searches
          </div>
          <div className="text-xs text-[var(--lt-text-muted)]">
            {loading
              ? "Loading..."
              : history.length > 0
                ? `${history.length} saved searches`
                : "Your past dashboard searches"}
          </div>
        </div>
        <span
          className={`text-lg text-[var(--lt-text-muted)] transition-transform duration-200 ${
            expanded ? "rotate-180" : "rotate-0"
          }`}
        >
          ⌄
        </span>
      </div>

      {expanded && (
        <div className="mt-4 pb-4">
          {loading ? (
            <p className="m-0 text-[13px] text-[var(--lt-text-muted)]">
              Loading search history...
            </p>
          ) : history.length === 0 ? (
            <p className="m-0 text-[13px] text-[var(--lt-text-muted)]">
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
                      className="flex items-center justify-between gap-3 rounded-[10px] border border-[var(--lt-border)] bg-[var(--lt-surface-2)] px-3.5 py-3"
                    >
                      <div className="min-w-0">
                        <div className="text-[13px] font-semibold text-[var(--lt-text)]">
                          {item.business_type} in {item.city}
                        </div>
                        <div className="mt-0.5 text-[11px] text-[var(--lt-text-muted)]">
                          {item.results_count.toLocaleString()} potential clients ·{" "}
                          {formatRelativeSearchTime(item.created_at)}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => onSearchAgain(item.business_type, location)}
                        className="shrink-0 cursor-pointer rounded-md border border-[var(--lt-accent)]/25 bg-[var(--lt-accent)]/15 px-3 py-1.5 text-[11px] font-bold text-[var(--lt-accent-soft)]"
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
