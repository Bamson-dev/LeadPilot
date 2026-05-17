export interface ScrapeStats {
  listingsFound: number;
  processed: number;
  succeeded: number;
  failed: number;
  skippedDuplicate: number;
  phonesFound: number;
  websitesFound: number;
  emailsFound: number;
  emailsGenerated: number;
}

export function createScrapeStats(): ScrapeStats {
  return {
    listingsFound: 0,
    processed: 0,
    succeeded: 0,
    failed: 0,
    skippedDuplicate: 0,
    phonesFound: 0,
    websitesFound: 0,
    emailsFound: 0,
    emailsGenerated: 0,
  };
}

export function logScrape(
  level: "info" | "warn" | "error",
  message: string,
  meta?: Record<string, unknown>
) {
  const prefix = "[LeadPilot Scraper]";
  const payload = meta ? ` ${JSON.stringify(meta)}` : "";
  if (level === "error") console.error(prefix, message, payload);
  else if (level === "warn") console.warn(prefix, message, payload);
  else console.log(prefix, message, payload);
}

export function logScrapeSummary(stats: ScrapeStats, durationMs: number) {
  const phoneRate =
    stats.succeeded > 0
      ? Math.round((stats.phonesFound / stats.succeeded) * 100)
      : 0;
  const websiteRate =
    stats.succeeded > 0
      ? Math.round((stats.websitesFound / stats.succeeded) * 100)
      : 0;
  const emailRate =
    stats.succeeded > 0
      ? Math.round((stats.emailsFound / stats.succeeded) * 100)
      : 0;

  logScrape("info", "Scrape complete", {
    durationSec: Math.round(durationMs / 1000),
    listingsFound: stats.listingsFound,
    processed: stats.processed,
    succeeded: stats.succeeded,
    failed: stats.failed,
    skippedDuplicate: stats.skippedDuplicate,
    phonesFound: stats.phonesFound,
    websitesFound: stats.websitesFound,
    emailsFound: stats.emailsFound,
    emailsGenerated: stats.emailsGenerated,
    phoneRate: `${phoneRate}%`,
    websiteRate: `${websiteRate}%`,
    emailRate: `${emailRate}%`,
  });
}
