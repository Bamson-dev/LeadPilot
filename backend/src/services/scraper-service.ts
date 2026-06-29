import type { BusinessLead, StreamEvent } from "@leadthur/shared";
import { getBrowserPool } from "../scraper/browser/browser-pool";
import {
  continueMapsExtraction,
  scrapeGoogleMaps,
} from "../scraper/googleMaps/maps-scraper";
import { geocodeCity } from "../scraper/googleMaps/grid-search";
import {
  getSearchJob,
  getAllSearchLeads,
  countSearchLeads,
  insertBusinessLead,
  markSearchComplete,
  tryClaimResultsEmailSend,
  updateSearchJob,
} from "../database/search-repository";
import { saveUserSearch } from "../database/user-search-repository";
import { recordSearchHistorySafe } from "../database/search-history-repository";
import { getLicenseEmailBySearchId } from "../database/license-repository";
import {
  sendSearchFailedEmail,
  sendSearchResultsReadyEmail,
  sendSearchRunningEmail,
} from "../services/email";
import { formatScraperError } from "../scraper/utils/scraper-errors";
import { logger } from "../utils/logger";
import { rawLeadToBusinessLead } from "../utils/lead-mapper";
import { formatSearchMessage } from "../utils/search-messages";
import { generateAreaSuggestions } from "./suggestion-service";
import { runBatchEmailScraping } from "./email-batch-scraper";
import { computeSearchStats } from "./search-stats";
import { findNearbyCities } from "./nearby-cities";
import { PHASE1_DEADLINE_MS, MEMORY_SKIP_SCRAPE_PERCENT } from "../scraper/utils/constants";
import type { RawLeadInput } from "../types/scraper";
import { isMemoryPressureHigh, getMemoryUsagePercent } from "../utils/memory";

export type ScrapeEmitter = (event: StreamEvent) => void;

type SearchJobStep =
  | "init"
  | "browser_acquire"
  | "phase1_maps_scrape"
  | "phase1_persist"
  | "background_extraction"
  | "email_scraping"
  | "finalize"
  | "nearby_cities";

function logSearchStep(
  searchId: string,
  step: SearchJobStep,
  extra?: Record<string, unknown>
): void {
  logger.info("[search-job] step", { searchId, step, ...extra });
}

function logSearchFailure(
  searchId: string,
  step: SearchJobStep,
  err: unknown,
  leadsCollected: number
): void {
  logger.error("[search-job] step failed", {
    searchId,
    step,
    leadsCollected,
    error: err instanceof Error ? err.message : String(err),
    stack: err instanceof Error ? err.stack : undefined,
  });
}

function emitLead(emit: ScrapeEmitter, lead: BusinessLead): void {
  emit({ type: "lead", lead, data: lead });
}

function leadDedupeKey(lead: BusinessLead): string {
  return `${lead.name?.toLowerCase().trim()}-${lead.phone?.replace(/\s/g, "") || "nophone"}`;
}

function deduplicateLeads(leads: BusinessLead[]): BusinessLead[] {
  const seen = new Set<string>();
  return leads.filter((lead) => {
    const key = leadDedupeKey(lead);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function resolveNotificationEmail(
  searchId: string,
  licenseEmail?: string | null
): Promise<string | null> {
  if (licenseEmail?.trim()) return licenseEmail.toLowerCase().trim();
  return getLicenseEmailBySearchId(searchId);
}

export async function commitPartialSearchResults(
  searchId: string,
  query: string,
  location: string,
  licenseEmail: string | null,
  options?: { skipEmailScraping?: boolean; emailTimedOut?: boolean }
): Promise<number> {
  const count = await countSearchLeads(searchId);
  if (count <= 0) return 0;

  logSearchStep(searchId, "finalize", {
    reason: "partial_commit",
    leadsCollected: count,
  });

  await finalizeSearchAndNotify(
    searchId,
    query,
    location,
    licenseEmail,
    options?.emailTimedOut ?? true,
    { skipEmailScraping: options?.skipEmailScraping }
  );

  return count;
}

export async function forceFinalizeSearchJob(
  searchId: string,
  query: string,
  location: string,
  licenseEmail: string | null,
  emailTimedOut: boolean,
  options?: { skipEmailScraping?: boolean }
): Promise<void> {
  await finalizeSearchAndNotify(
    searchId,
    query,
    location,
    licenseEmail,
    emailTimedOut,
    options
  );
}

async function finalizeSearchAndNotify(
  searchId: string,
  query: string,
  location: string,
  licenseEmail: string | null,
  emailTimedOut: boolean,
  notifyOptions?: { skipEmailScraping?: boolean }
): Promise<void> {
  const leads = await getAllSearchLeads(searchId);
  const uniqueLeads = deduplicateLeads(leads);
  const stats = computeSearchStats(uniqueLeads);
  const totalFound = stats.total;

  await updateSearchJob(searchId, {
    totalFound,
    processed: totalFound,
    status: "completed",
    scrapingInProgress: false,
    statsSummary: stats,
    error: null,
  });

  if (licenseEmail && totalFound > 0) {
    void recordSearchHistorySafe({
      email: licenseEmail,
      business_type: query,
      location,
      results_count: totalFound,
    });

    const claimed = await tryClaimResultsEmailSend(searchId);
    if (claimed) {
      const jobStats = (await getSearchJob(searchId))?.statsSummary ?? stats;
      void sendSearchResultsReadyEmail(
        licenseEmail,
        searchId,
        query,
        location,
        {
          total: jobStats.total,
          withPhone: jobStats.withPhone,
          withEmail: jobStats.withEmail,
          withWebsite: jobStats.withWebsite,
        },
        {
          timedOut: emailTimedOut,
          skipEmailScraping: notifyOptions?.skipEmailScraping,
        }
      ).catch((err) =>
        logger.error("Failed to send results ready email", {
          searchId,
          error: err instanceof Error ? err.message : "unknown",
        })
      );
    }
  }
}

async function runBackgroundWork(
  searchId: string,
  query: string,
  location: string,
  remainingUrls: string[],
  isTrial: boolean,
  emit: ScrapeEmitter,
  options?: { licenseKey?: string; licenseEmail?: string | null }
): Promise<void> {
  const pool = getBrowserPool();
  let emailTimedOut = false;
  let skipEmailScraping = false;

  try {
    if (remainingUrls.length > 0 && pool.isReady()) {
      logSearchStep(searchId, "background_extraction", {
        remainingUrls: remainingUrls.length,
      });
      const browser = await pool.acquire(60_000);
      const seenKeys = new Set<string>();
      const existing = await getAllSearchLeads(searchId);
      for (const lead of existing) {
        seenKeys.add(leadDedupeKey(lead));
      }

      try {
        await continueMapsExtraction(browser, {
          query,
          location,
          isTrial,
          placeUrls: remainingUrls,
          startCount: existing.length,
          onProgress: (count, max) => {
            emit({
              type: "progress",
              message: `Found ${count} of ${max} businesses...`,
              processed: count,
              count,
              max,
            });
          },
          onLead: (raw: RawLeadInput) => {
            const basic = rawLeadToBusinessLead(raw, searchId);
            const key = leadDedupeKey(basic);
            if (seenKeys.has(key)) return;
            seenKeys.add(key);
            emitLead(emit, basic);
            void insertBusinessLead(basic).catch(() => undefined);
            void updateSearchJob(searchId, {
              processed: seenKeys.size,
              totalFound: seenKeys.size,
            }).catch(() => undefined);
          },
        });
      } finally {
        pool.release(browser);
      }
    }

    if (!isTrial) {
      const leadCount = await countSearchLeads(searchId);
      const memoryPercent = Math.round(getMemoryUsagePercent());

      if (isMemoryPressureHigh(MEMORY_SKIP_SCRAPE_PERCENT)) {
        skipEmailScraping = true;
        logger.warn("[search-job] Skipping Playwright email scrape — high memory", {
          searchId,
          memoryPercent,
          leadCount,
        });
        const { markBusinessLeadEmailScraped } = await import(
          "../database/search-repository"
        );
        const pending = (await getAllSearchLeads(searchId)).filter(
          (lead) => lead.website && !lead.emailScraped
        );
        for (const lead of pending) {
          await markBusinessLeadEmailScraped(lead.id, []).catch(() => undefined);
        }
      } else {
        logSearchStep(searchId, "email_scraping", { leadCount, memoryPercent });
        const emailStart = Date.now();
        await runBatchEmailScraping(searchId, emit, undefined, {
          totalResultCount: leadCount,
        });
        emailTimedOut = Date.now() - emailStart >= 3 * 60 * 1000 - 1000;
      }
    } else {
      const trialLeads = await getAllSearchLeads(searchId);
      for (const lead of trialLeads) {
        if (lead.website && !lead.emailScraped) {
          const { markBusinessLeadEmailScraped } = await import(
            "../database/search-repository"
          );
          await markBusinessLeadEmailScraped(lead.id, []).catch(() => undefined);
        }
      }
    }

    const leads = deduplicateLeads(await getAllSearchLeads(searchId));
    const stats = computeSearchStats(leads);

    let nearbyCities = undefined;
    if (!isTrial && stats.total < 300) {
      const geo = await geocodeCity(location);
      if (geo) {
        nearbyCities = findNearbyCities(
          location,
          geo.lat,
          geo.lng,
          5,
          100
        );
        if (nearbyCities.length > 0) {
          await updateSearchJob(searchId, { nearbyCities });
          emit({ type: "suggestions", suggestions: nearbyCities.map((c) => c.city) });
        }
      }
    }

    await updateSearchJob(searchId, {
      totalFound: stats.total,
      processed: stats.total,
      statsSummary: stats,
    });

    const licenseEmail = await resolveNotificationEmail(
      searchId,
      options?.licenseEmail
    );

    await finalizeSearchAndNotify(
      searchId,
      query,
      location,
      licenseEmail,
      emailTimedOut,
      { skipEmailScraping }
    );

    emit({
      type: "complete",
      total: stats.total,
      message: `Search complete. Found ${stats.total} businesses in ${location}.`,
    });

    if (!isTrial) {
      void generateAreaSuggestions(query, location, stats.total)
        .then((suggestions) => {
          if (suggestions.length > 0) {
            emit({ type: "suggestions", suggestions });
          }
        })
        .catch(() => undefined);
    }
  } catch (err) {
    const leadsCollected = await countSearchLeads(searchId);
    logSearchFailure(searchId, "background_extraction", err, leadsCollected);
    const licenseEmail = await resolveNotificationEmail(
      searchId,
      options?.licenseEmail
    );
    if (leadsCollected > 0) {
      await finalizeSearchAndNotify(
        searchId,
        query,
        location,
        licenseEmail,
        true,
        { skipEmailScraping }
      ).catch(() => undefined);
      emit({
        type: "complete",
        total: leadsCollected,
        message: `Search complete. Found ${leadsCollected} businesses in ${location}.`,
      });
      return;
    }
    throw err;
  }
}

export async function runScraperJob(
  searchId: string,
  query: string,
  location: string,
  emit: ScrapeEmitter,
  options?: { licenseKey?: string; licenseEmail?: string; isTrial?: boolean }
): Promise<void> {
  const pool = getBrowserPool();
  let searchComplete = false;
  let leadsFoundSoFar = 0;
  let runningEmailSent = false;

  const jobRecord = await getSearchJob(searchId);
  const isTrial = options?.isTrial ?? jobRecord?.isTrial ?? false;

  const resolveLicenseEmail = async (): Promise<string | null> => {
    if (options?.licenseEmail) return options.licenseEmail;
    return getLicenseEmailBySearchId(searchId);
  };

  const runningEmailTimer = setTimeout(() => {
    void (async () => {
      if (isTrial || searchComplete || leadsFoundSoFar >= 5 || runningEmailSent) {
        return;
      }
      runningEmailSent = true;
      const licenseEmail = await resolveLicenseEmail();
      if (licenseEmail) {
        void sendSearchRunningEmail(licenseEmail, query, location).catch((err) =>
          logger.error("Failed to send running email", {
            error: err instanceof Error ? err.message : "unknown",
          })
        );
      }
    })();
  }, 2 * 60 * 1000);

  if (!pool.isReady()) {
    emit({
      type: "phase",
      phase: "Starting scraper — this may take up to a minute on first search...",
    });
    await pool.ensureReady();
    const ready = await pool.waitUntilReady(90_000);
    if (!ready) {
      clearTimeout(runningEmailTimer);
      throw new Error("Scraper is not ready yet. Please try again in one minute.");
    }
  }

  const browser = await pool.acquire(90_000);
  let browserReleased = false;
  let progressMax = 100;
  const seenLeadKeys = new Set<string>();
  const collectedLeads: BusinessLead[] = [];
  const phase1DeadlineMs = Date.now() + PHASE1_DEADLINE_MS;
  let step: SearchJobStep = "init";

  logSearchStep(searchId, "init", { query, location, isTrial });

  try {
    step = "browser_acquire";
    logSearchStep(searchId, step);
    await updateSearchJob(searchId, {
      status: "running",
      scrapingInProgress: !isTrial,
    });

    const startMessage = formatSearchMessage(query, location);
    if (!isTrial) {
      emit({ type: "phase", phase: startMessage });
      emit({
        type: "progress",
        message: startMessage,
        processed: 0,
        count: 0,
        max: 0,
      });
    }

    const onBusinessFound = (raw: RawLeadInput) => {
      const basic = rawLeadToBusinessLead(raw, searchId);
      const key = leadDedupeKey(basic);
      if (seenLeadKeys.has(key)) return;
      seenLeadKeys.add(key);

      leadsFoundSoFar = seenLeadKeys.size;
      collectedLeads.push(basic);
      emitLead(emit, basic);
      emit({
        type: "progress",
        ...(isTrial
          ? { processed: leadsFoundSoFar, count: leadsFoundSoFar }
          : {
              message: `Found ${leadsFoundSoFar} businesses so far...`,
              processed: leadsFoundSoFar,
              count: leadsFoundSoFar,
              max: progressMax,
            }),
      });

      void insertBusinessLead(basic).catch((err) => {
        logger.error("Failed to insert business lead", {
          searchId,
          error: err instanceof Error ? err.message : "unknown",
        });
      });

      if (leadsFoundSoFar % 3 === 0) {
        void updateSearchJob(searchId, {
          processed: leadsFoundSoFar,
          totalFound: leadsFoundSoFar,
        }).catch(() => undefined);
      }
    };

    step = "phase1_maps_scrape";
    logSearchStep(searchId, step, { phase1DeadlineMs });

    const scrapeResult = await scrapeGoogleMaps(browser, {
      query,
      location,
      isTrial,
      phase1DeadlineMs: isTrial ? undefined : phase1DeadlineMs,
      onPhase: (phase) => {
        if (!isTrial) emit({ type: "phase", phase });
      },
      onProgress: (count, max) => {
        progressMax = max;
        if (isTrial) {
          emit({ type: "progress", processed: count, count });
        } else {
          emit({
            type: "progress",
            message: `Found ${count} of ${max} businesses...`,
            processed: count,
            count,
            max,
          });
        }
      },
      onLead: onBusinessFound,
    });

    searchComplete = true;
    clearTimeout(runningEmailTimer);

    const uniqueCount = deduplicateLeads(collectedLeads).length;
    const phase1Total = uniqueCount > 0 ? uniqueCount : scrapeResult.count;
    const stats = computeSearchStats(deduplicateLeads(collectedLeads));

    if (isTrial) {
      await markSearchComplete(searchId, phase1Total);
      emit({
        type: "complete",
        total: phase1Total,
        message: `Search complete. Found ${phase1Total} businesses in ${location}.`,
      });
      return;
    }

    step = "phase1_persist";
    logSearchStep(searchId, step, { phase1Total });

    await updateSearchJob(searchId, {
      status: "completed",
      totalFound: phase1Total,
      processed: phase1Total,
      scrapingInProgress: true,
      statsSummary: stats,
    });

    emit({
      type: "complete",
      total: phase1Total,
      message: `Found ${phase1Total} businesses. Finding email addresses in the background...`,
    });

    if (options?.licenseKey) {
      await saveUserSearch({
        licenseKey: options.licenseKey,
        searchId,
        query,
        location,
        totalFound: phase1Total,
      });
    }

    const licenseEmail =
      options?.licenseEmail?.toLowerCase().trim() ||
      (await resolveLicenseEmail());
    if (licenseEmail && phase1Total > 0) {
      void recordSearchHistorySafe({
        email: licenseEmail,
        business_type: query,
        location,
        results_count: phase1Total,
      });
    }

    pool.release(browser);
    browserReleased = true;

    await runBackgroundWork(
      searchId,
      query,
      location,
      scrapeResult.remainingUrls,
      isTrial,
      emit,
      {
        licenseKey: options?.licenseKey,
        licenseEmail: licenseEmail ?? options?.licenseEmail,
      }
    );
  } catch (err) {
    searchComplete = true;
    clearTimeout(runningEmailTimer);

    const leadsCollected = await countSearchLeads(searchId);
    logSearchFailure(searchId, step, err, leadsCollected);

    if (leadsCollected > 0) {
      const licenseEmail = await resolveLicenseEmail();
      const committed = await commitPartialSearchResults(
        searchId,
        query,
        location,
        licenseEmail,
        { emailTimedOut: true }
      );
      emit({
        type: "complete",
        total: committed,
        message: `We found ${committed.toLocaleString()} potential clients for you.`,
      });
      return;
    }

    const message = formatScraperError(err);
    await updateSearchJob(searchId, {
      status: "failed",
      error: message,
      scrapingInProgress: false,
    });

    const licenseEmail = await resolveLicenseEmail();
    if (licenseEmail) {
      void sendSearchFailedEmail(licenseEmail, query, location).catch((emailErr) =>
        logger.error("Failed to send failed email", {
          error: emailErr instanceof Error ? emailErr.message : "unknown",
        })
      );
    }

    emit({
      type: "error",
      message,
    });
    throw err;
  } finally {
    if (!browserReleased) {
      try {
        pool.release(browser);
      } catch {
        /* ignore */
      }
    }
  }
}

export const runSearch = runScraperJob;
