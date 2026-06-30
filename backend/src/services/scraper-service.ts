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
import { formatSearchMessage, PHASE1_LOADING_MESSAGE } from "../utils/search-messages";
import { generateAreaSuggestions } from "./suggestion-service";
import { runBatchEmailScraping } from "./email-batch-scraper";
import { computeSearchStats } from "./search-stats";
import { findNearbyCities } from "./nearby-cities";
import { PHASE1_DEADLINE_MS, MEMORY_SKIP_SCRAPE_PERCENT, PHASE2_EMAIL_SCRAPE_MAX_MS, PHASE2_TRIGGER_WATCHDOG_MS } from "../scraper/utils/constants";
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
  const totalFound = await countSearchLeads(searchId);
  const stats = computeSearchStats(leads);

  await updateSearchJob(searchId, {
    totalFound,
    processed: totalFound,
    status: "completed",
    scrapingInProgress: false,
    emailScrapingComplete: true,
    statsSummary: { ...stats, total: totalFound },
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
      void sendSearchResultsReadyEmail(
        licenseEmail,
        searchId,
        query,
        location,
        {
          total: totalFound,
          withPhone: stats.withPhone,
          withEmail: stats.withEmail,
          withWebsite: stats.withWebsite,
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

async function markAllLeadsEmailScrapeSkipped(searchId: string): Promise<void> {
  const { markBusinessLeadEmailScraped } = await import(
    "../database/search-repository"
  );
  const pending = (await getAllSearchLeads(searchId)).filter(
    (lead) => lead.website && !lead.emailScraped
  );
  for (const lead of pending) {
    await markBusinessLeadEmailScraped(lead.id, []).catch(() => undefined);
  }
  await updateSearchJob(searchId, { emailScrapingComplete: true });
}

async function runPhase2EmailScraping(
  searchId: string,
  query: string,
  location: string,
  leadCount: number,
  jobStartedAt: number,
  phase1CompletedAt: number,
  emit: ScrapeEmitter,
  options: {
    licenseEmail?: string | null;
    skipEmailScraping?: boolean;
  }
): Promise<{ emailTimedOut: boolean; skipEmailScraping: boolean }> {
  const pool = getBrowserPool();
  let emailTimedOut = false;
  let skipEmailScraping = options.skipEmailScraping ?? false;
  let phase2Triggered = false;
  let phase2Finished = false;

  const phase1ElapsedMs = phase1CompletedAt - jobStartedAt;

  if (leadCount <= 0) {
    logger.info("[search-job] Phase 1 complete — no leads, skipping Phase 2", {
      searchId,
      phase1ElapsedMs,
    });
    await updateSearchJob(searchId, { emailScrapingComplete: true });
    return { emailTimedOut: false, skipEmailScraping: true };
  }

  logger.info(
    "[search-job] Phase 1 complete, starting Phase 2 email scraping",
    {
      searchId,
      query,
      location,
      leadCount,
      phase1ElapsedMs,
      phase2BudgetMs: PHASE2_EMAIL_SCRAPE_MAX_MS,
    }
  );

  const runPhase2Attempt = async (attempt: number): Promise<void> => {
    phase2Triggered = true;
    logSearchStep(searchId, "email_scraping", {
      attempt,
      leadCount,
      phase1ElapsedMs,
      phase2BudgetMs: PHASE2_EMAIL_SCRAPE_MAX_MS,
    });

    const memoryPercent = Math.round(getMemoryUsagePercent());
    if (isMemoryPressureHigh(MEMORY_SKIP_SCRAPE_PERCENT)) {
      skipEmailScraping = true;
      logger.warn("[search-job] Skipping Playwright email scrape — high memory", {
        searchId,
        memoryPercent,
        leadCount,
        attempt,
      });
      await markAllLeadsEmailScrapeSkipped(searchId);
      phase2Finished = true;
      return;
    }

    const emailStart = Date.now();
    const emailBrowser = await pool.acquire(60_000);
    try {
      await runBatchEmailScraping(searchId, emit, PHASE2_EMAIL_SCRAPE_MAX_MS, {
        totalResultCount: leadCount,
        browser: emailBrowser,
      });
    } finally {
      pool.release(emailBrowser);
    }
    emailTimedOut = Date.now() - emailStart >= PHASE2_EMAIL_SCRAPE_MAX_MS - 1000;
    await updateSearchJob(searchId, { emailScrapingComplete: true });
    phase2Finished = true;

    logger.info("[search-job] Phase 2 email scraping complete", {
      searchId,
      leadCount,
      attempt,
      emailTimedOut,
      phase2ElapsedMs: Date.now() - emailStart,
    });
  };

  const watchdog = setTimeout(() => {
    if (phase2Triggered || phase2Finished) return;
    logger.error(
      "[search-job] Phase 2 failed to trigger within 10s — retrying immediately",
      { searchId, leadCount, phase1ElapsedMs }
    );
    void runPhase2Attempt(2).catch(async (err) => {
      logger.error("[search-job] Phase 2 watchdog retry failed", {
        searchId,
        error: err instanceof Error ? err.message : "unknown",
      });
      await markAllLeadsEmailScrapeSkipped(searchId);
      phase2Finished = true;
    });
  }, PHASE2_TRIGGER_WATCHDOG_MS);

  try {
    await runPhase2Attempt(1);
  } catch (err) {
    logger.error("[search-job] Phase 2 first attempt failed — retrying", {
      searchId,
      error: err instanceof Error ? err.message : "unknown",
    });
    if (!phase2Finished) {
      try {
        await runPhase2Attempt(2);
      } catch (retryErr) {
        logger.error("[search-job] Phase 2 retry failed — committing Maps-only results", {
          searchId,
          error: retryErr instanceof Error ? retryErr.message : "unknown",
        });
        await markAllLeadsEmailScrapeSkipped(searchId);
      }
    }
  } finally {
    clearTimeout(watchdog);
  }

  return { emailTimedOut, skipEmailScraping };
}

async function runBackgroundWork(
  searchId: string,
  query: string,
  location: string,
  remainingUrls: string[],
  isTrial: boolean,
  emit: ScrapeEmitter,
  options?: {
    licenseKey?: string;
    licenseEmail?: string | null;
    jobStartedAt?: number;
  }
): Promise<void> {
  const pool = getBrowserPool();
  const jobStartedAt = options?.jobStartedAt ?? Date.now();
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
          },
        });
      } finally {
        pool.release(browser);
      }
    }

    const phase1CompletedAt = Date.now();
    await updateSearchJob(searchId, { scrapingInProgress: false });

    if (!isTrial) {
      const leadCount = await countSearchLeads(searchId);
      const phase2 = await runPhase2EmailScraping(
        searchId,
        query,
        location,
        leadCount,
        jobStartedAt,
        phase1CompletedAt,
        emit,
        { licenseEmail: options?.licenseEmail }
      );
      emailTimedOut = phase2.emailTimedOut;
      skipEmailScraping = phase2.skipEmailScraping;
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
      await updateSearchJob(searchId, { emailScrapingComplete: true });
    }

    const leads = await getAllSearchLeads(searchId);
    const totalFound = await countSearchLeads(searchId);
    const stats = computeSearchStats(leads);

    let nearbyCities = undefined;
    if (!isTrial && totalFound < 300) {
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
      totalFound,
      processed: totalFound,
      statsSummary: { ...stats, total: totalFound },
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
      total: totalFound,
      message: `Search complete. Found ${totalFound} businesses in ${location}.`,
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
      if (!isTrial) {
        try {
          const phase2 = await runPhase2EmailScraping(
            searchId,
            query,
            location,
            leadsCollected,
            options?.jobStartedAt ?? Date.now(),
            Date.now(),
            emit,
            { licenseEmail }
          );
          skipEmailScraping = phase2.skipEmailScraping;
          emailTimedOut = phase2.emailTimedOut;
        } catch (phase2Err) {
          logger.error("[search-job] Phase 2 failed after background error", {
            searchId,
            error: phase2Err instanceof Error ? phase2Err.message : "unknown",
          });
          await markAllLeadsEmailScrapeSkipped(searchId);
        }
      }
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
  const jobStartedAt = Date.now();
  let step: SearchJobStep = "init";

  logSearchStep(searchId, "init", { query, location, isTrial });

  try {
    step = "browser_acquire";
    logSearchStep(searchId, step);
    await updateSearchJob(searchId, {
      status: "running",
      scrapingInProgress: !isTrial,
    });

    const startMessage = PHASE1_LOADING_MESSAGE;
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
        jobStartedAt,
      }
    );
  } catch (err) {
    searchComplete = true;
    clearTimeout(runningEmailTimer);

    const leadsCollected = await countSearchLeads(searchId);
    logSearchFailure(searchId, step, err, leadsCollected);

    if (leadsCollected > 0) {
      const licenseEmail = await resolveLicenseEmail();
      if (!isTrial) {
        try {
          await runPhase2EmailScraping(
            searchId,
            query,
            location,
            leadsCollected,
            jobStartedAt,
            Date.now(),
            emit,
            { licenseEmail }
          );
        } catch (phase2Err) {
          logger.error("[search-job] Phase 2 failed in main catch — committing Maps results", {
            searchId,
            error: phase2Err instanceof Error ? phase2Err.message : "unknown",
          });
          await markAllLeadsEmailScrapeSkipped(searchId);
        }
      }
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
