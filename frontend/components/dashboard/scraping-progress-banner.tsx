"use client";

import type { SearchStatsSummary } from "@leadthur/shared";
import { Progress } from "@/components/ui/progress";

interface ScrapingProgressBannerProps {
  scrapingInProgress: boolean;
  summary: SearchStatsSummary | null;
  totalFound: number;
}

export function ScrapingProgressBanner({
  scrapingInProgress,
  summary,
  totalFound,
}: ScrapingProgressBannerProps) {
  const total = summary?.total ?? totalFound;
  const emailsFound = summary?.emailsFoundFor ?? summary?.withEmail ?? 0;
  const emailsTarget = summary?.emailsScrapedFor ?? total;

  if (!scrapingInProgress && total > 0 && (summary?.emailsScrapedFor ?? 0) > 0) {
    const coverage = Math.round((emailsFound / Math.max(total, 1)) * 100);
    return (
      <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
        Email coverage complete — found addresses for{" "}
        <span className="font-semibold text-white">
          {emailsFound} of {total}
        </span>{" "}
        businesses ({coverage}%).
      </div>
    );
  }

  if (!scrapingInProgress) return null;

  const progressPct =
    emailsTarget > 0 ? Math.min(95, Math.round((emailsFound / emailsTarget) * 100)) : 35;

  return (
    <div className="rounded-xl border border-violet-500/25 bg-violet-500/10 px-4 py-3 space-y-2">
      <p className="text-sm text-violet-100">
        Finding email addresses for these businesses. This usually takes 1 to 2
        minutes.
      </p>
      <p className="text-xs text-violet-200/80">
        Emails found for{" "}
        <span className="font-semibold text-white">{emailsFound}</span> of{" "}
        <span className="font-semibold text-white">{total}</span> businesses.
      </p>
      <Progress value={progressPct} className="h-1.5 bg-violet-950/50" />
    </div>
  );
}
