"use client";

import { RecentSearchesPanel } from "@/components/dashboard/recent-searches-panel";
import { SearchHistory } from "@/components/dashboard/search-history";

interface DashboardHistorySectionsProps {
  isMobile?: boolean;
  refreshKey?: number;
  onSearchAgain: (businessType: string, location: string) => void;
}

export function DashboardHistorySections({
  isMobile = false,
  refreshKey = 0,
  onSearchAgain,
}: DashboardHistorySectionsProps) {
  return (
    <div className="space-y-4 sm:space-y-6" data-dashboard-history-sections>
      <RecentSearchesPanel refreshKey={refreshKey} onSearchAgain={onSearchAgain} />
      <SearchHistory isMobile={isMobile} refreshKey={refreshKey} />
    </div>
  );
}
