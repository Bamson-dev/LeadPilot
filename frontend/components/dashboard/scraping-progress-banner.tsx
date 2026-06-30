"use client";

import type { Lead } from "@/types/lead";
import { Progress } from "@/components/ui/progress";
import { computeLeadStats } from "@/utils/lead-stats";

interface ScrapingProgressBannerProps {
  scrapingInProgress: boolean;
  leads: Lead[];
}

function formatEtaMinutes(remainingWebsites: number, scrapedWebsites: number): string {
  if (scrapedWebsites <= 0) return "2–4";
  const secondsPerSite = 12;
  const etaMin = Math.max(1, Math.ceil((remainingWebsites * secondsPerSite) / 60));
  return String(etaMin);
}

export function ScrapingProgressBanner({
  scrapingInProgress,
  leads,
}: ScrapingProgressBannerProps) {
  const stats = computeLeadStats(leads);
  const emailsTarget = stats.withWebsite;
  const emailsFound = stats.withEmail;
  const emailsScraped = stats.emailsScrapedFor;
  const remainingWebsites = Math.max(0, emailsTarget - emailsScraped);

  if (!scrapingInProgress && stats.total > 0 && emailsTarget > 0 && emailsFound > 0) {
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

  if (!scrapingInProgress) return null;

  const progressPct =
    emailsTarget > 0
      ? Math.min(99, Math.round((emailsScraped / emailsTarget) * 100))
      : 35;
  const etaMin = formatEtaMinutes(remainingWebsites, emailsScraped);

  return (
    <div className="rounded-xl border border-violet-500/25 bg-violet-500/10 px-4 py-3 space-y-2">
      <p className="text-sm text-violet-100">
        Finding email addresses for these businesses. This can take several
        minutes for larger result sets.
      </p>
      <p className="text-xs text-violet-200/80">
        Scraped{" "}
        <span className="font-semibold text-white">{emailsScraped}</span> of{" "}
        <span className="font-semibold text-white">{emailsTarget}</span>{" "}
        websites ({progressPct}%). Found emails for{" "}
        <span className="font-semibold text-white">{emailsFound}</span>{" "}
        businesses. About {etaMin} min remaining.
      </p>
      <Progress value={progressPct} className="h-1.5 bg-violet-950/50" />
    </div>
  );
}
