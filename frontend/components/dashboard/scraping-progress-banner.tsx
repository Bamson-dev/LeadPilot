"use client";

import type { Lead } from "@/types/lead";
import { Progress } from "@/components/ui/progress";
import { computeLeadStats } from "@/utils/lead-stats";

interface ScrapingProgressBannerProps {
  scrapingInProgress: boolean;
  emailScrapingComplete: boolean;
  leads: Lead[];
}

export function ScrapingProgressBanner({
  scrapingInProgress,
  emailScrapingComplete,
  leads,
}: ScrapingProgressBannerProps) {
  const stats = computeLeadStats(leads);
  const emailsTarget = stats.withScrappableWebsite;
  const emailsFound = stats.withEmail;
  const emailScrapingActive =
    !emailScrapingComplete && (scrapingInProgress || stats.total > 0);

  if (!emailScrapingActive && stats.total > 0 && emailsTarget > 0 && emailsFound > 0) {
    const coverage = Math.round((emailsFound / Math.max(emailsTarget, 1)) * 100);
    return (
      <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
        Email coverage complete — found addresses for{" "}
        <span className="font-semibold text-white">
          {emailsFound} of {emailsTarget}
        </span>{" "}
        businesses with websites ({coverage}%).
      </div>
    );
  }

  if (!emailScrapingActive) return null;

  const progressPct =
    emailsTarget > 0
      ? Math.min(95, Math.round((emailsFound / emailsTarget) * 100))
      : 35;

  return (
    <div className="rounded-xl border border-violet-500/25 bg-violet-500/10 px-4 py-3 space-y-2">
      <p className="text-sm text-violet-100">
        Finding email addresses for these businesses. This usually takes 1 to 2
        minutes.
      </p>
      <p className="text-xs text-violet-200/80">
        Emails found for{" "}
        <span className="font-semibold text-white">{emailsFound}</span> of{" "}
        <span className="font-semibold text-white">
          {emailsTarget}
        </span>{" "}
        businesses with websites.
      </p>
      <Progress value={progressPct} className="h-1.5 bg-violet-950/50" />
    </div>
  );
}
