import os from "os";
import { Router, type NextFunction, type Request, type Response } from "express";
import type { SearchResponse, SearchResultsResponse } from "@leadthur/shared";
import { computeFullyComplete } from "@leadthur/shared";
import {
  createSearchJob,
  getSearchJob,
  getSearchJobAccess,
  getSearchResults,
  getAllSearchLeads,
  countSearchLeads,
  setSearchJobLicenseEmail,
  markSearchComplete,
  markSearchFailed,
  updateSearchJob,
  type SearchJobAccess,
} from "../database/search-repository";
import { computeSearchStats } from "../services/search-stats";
import { getSoftRegionCitySuggestions } from "../services/region-detection";
import {
  copyCachedLeadsForInsert,
  getCachedSearch,
} from "../services/cache-service";
import { recordSearchHistorySafe } from "../database/search-history-repository";
import {
  getUserSearchHistory,
  saveUserSearch,
  searchJobHasOwnershipRecord,
  userOwnsSearchJob,
} from "../database/user-search-repository";
import {
  enqueueSearch,
  enqueueSearchJob,
  recoverStuckTrialSearch,
  refreshSearchQueueStatus,
  resolveQueuePosition,
} from "../queue/search-queue";
import { checkSearchLimit } from "../middleware/check-search-limit";
import { requireLicense } from "../middleware/require-license";
import { trackSearch } from "../services/abuse-detection";
import { registerStream, removeStream } from "../services/stream-registry";
import { formatSearchMessage } from "../utils/search-messages";
import { supabase } from "../database/client";
import { logger } from "../utils/logger";
import { generateAreaSuggestions } from "../services/suggestion-service";
import { claimTrialSearch, getTrialSignupByEmail, releaseTrialSearch } from "../database/free-trial-repository";
import {
  claimTrialIpSearch,
  getTrialIpSearchStatus,
  releaseTrialIpSearch,
} from "../database/free-trial-ip-repository";
import { clientIp, isRateLimitAllowlisted } from "../middleware/rate-limit";

export const searchRouter = Router();

const TRIAL_EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function getMemoryUsagePercent(): number {
  const total = os.totalmem();
  const free = os.freemem();
  return ((total - free) / total) * 100;
}

function licenseCredentialsFromQuery(req: Request): void {
  if (!req.headers["x-license-key"] && req.query.licenseKey) {
    req.headers["x-license-key"] = String(req.query.licenseKey);
  }
  if (!req.headers["x-license-email"] && req.query.licenseEmail) {
    req.headers["x-license-email"] = String(req.query.licenseEmail);
  }
  if (!req.headers["x-trial-email"] && req.query.trialEmail) {
    req.headers["x-trial-email"] = String(req.query.trialEmail);
  }
}

function licenseQueryToHeaders(req: Request, _res: Response, next: NextFunction): void {
  licenseCredentialsFromQuery(req);
  next();
}

function resolveLicenseEmailFromRequest(req: Request): string | undefined {
  return (
    req.licenseEmail ??
    (req.headers["x-license-email"] as string | undefined)?.toLowerCase().trim() ??
    undefined
  );
}

function resolveLicenseKeyFromRequest(req: Request): string | undefined {
  return (
    req.licenseKey ??
    (req.headers["x-license-key"] as string | undefined)?.trim().toUpperCase() ??
    undefined
  );
}

function resolveTrialEmailFromRequest(req: Request): string | undefined {
  const raw =
    (req.headers["x-trial-email"] as string | undefined) ??
    (req.query.trialEmail as string | undefined) ??
    "";
  const normalized = raw.toLowerCase().trim();
  return TRIAL_EMAIL_RE.test(normalized) ? normalized : undefined;
}

const ORPHAN_SEARCH_CLAIM_MS = 30 * 60 * 1000;

async function loadSearchAccess(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const access = await getSearchJobAccess(String(req.params.id));
    if (!access) {
      res.status(404).json({ error: "Search not found" });
      return;
    }
    req.searchAccess = access;
    next();
  } catch (err) {
    logger.error("Failed to load search access", {
      error: err instanceof Error ? err.message : "unknown",
    });
    res.status(500).json({ error: "Failed to fetch search" });
  }
}

async function requireSearchOwnership(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const access = req.searchAccess as SearchJobAccess | undefined;
  if (!access) {
    res.status(404).json({ error: "Search not found" });
    return;
  }

  if (access.isTrial) {
    const trialEmail = resolveTrialEmailFromRequest(req);
    if (!trialEmail || !access.licenseEmail || trialEmail !== access.licenseEmail) {
      res.status(401).json({
        error: "Trial email required to access this search.",
        code: "TRIAL_AUTH_REQUIRED",
      });
      return;
    }
    next();
    return;
  }

  await new Promise<void>((resolve) => {
    void requireLicense(req, res, () => resolve());
  });
  if (res.headersSent) return;

  const requestEmail = req.licenseEmail!;
  const requestKey = req.licenseKey!;

  if (access.licenseEmail === requestEmail) {
    next();
    return;
  }

  const ownsViaHistory = await userOwnsSearchJob(
    access.job.id,
    requestKey,
    requestEmail
  );
  if (ownsViaHistory) {
    if (access.licenseEmail !== requestEmail) {
      void setSearchJobLicenseEmail(access.job.id, requestEmail).catch((err) =>
        logger.error("Failed to lazy-backfill license_email", {
          searchId: access.job.id,
          error: err instanceof Error ? err.message : "unknown",
        })
      );
    }
    next();
    return;
  }

  const isInFlight =
    access.job.status === "pending" || access.job.status === "running";
  if (!access.licenseEmail && isInFlight) {
    void setSearchJobLicenseEmail(access.job.id, requestEmail).catch((err) =>
      logger.error("Failed to claim in-flight search license_email", {
        searchId: access.job.id,
        error: err instanceof Error ? err.message : "unknown",
      })
    );
    next();
    return;
  }

  const jobAgeMs = Date.now() - new Date(access.job.createdAt).getTime();
  const isRecentOrphan =
    !access.licenseEmail &&
    !access.isTrial &&
    jobAgeMs >= 0 &&
    jobAgeMs <= ORPHAN_SEARCH_CLAIM_MS;
  if (isRecentOrphan) {
    const hasOwnershipRecord = await searchJobHasOwnershipRecord(access.job.id);
    if (!hasOwnershipRecord) {
      void setSearchJobLicenseEmail(access.job.id, requestEmail).catch((err) =>
        logger.error("Failed to claim orphan search license_email", {
          searchId: access.job.id,
          error: err instanceof Error ? err.message : "unknown",
        })
      );
      next();
      return;
    }
  }

  res.status(403).json({ error: "Not authorized to access this search." });
}

searchRouter.get("/queue/status", async (_req: Request, res: Response) => {
  res.json(await refreshSearchQueueStatus());
});

function resolveEmailScrapingComplete(
  job: Awaited<ReturnType<typeof getSearchJob>>
): boolean {
  if (!job) return true;
  return Boolean(job.emailScrapingComplete);
}

async function buildSearchResultsPayload(
  searchId: string,
  page: number,
  limit: number
): Promise<SearchResultsResponse> {
  const job = await getSearchJob(searchId);
  const total = await countSearchLeads(searchId);
  const { leads } = await getSearchResults(searchId, page, limit);
  const summary =
    job?.statsSummary ??
    computeSearchStats(
      page === 1 && leads.length >= total
        ? leads
        : await getAllSearchLeads(searchId)
    );

  const queuePosition = await resolveQueuePosition(searchId);

  if (job?.isTrial && job.status === "pending" && queuePosition === 0) {
    recoverStuckTrialSearch({
      id: job.id,
      query: job.query,
      location: job.location,
      status: job.status,
      isTrial: job.isTrial,
    });
  }

  const scrapingInProgress = Boolean(job?.scrapingInProgress);
  const emailScrapingComplete = resolveEmailScrapingComplete(job);
  const status = job?.status ?? "unknown";

  return {
    searchId,
    status,
    leads,
    total,
    totalFound: total,
    scrapingInProgress,
    emailScrapingComplete,
    fullyComplete: computeFullyComplete({
      status,
      scrapingInProgress,
      emailScrapingComplete,
    }),
    queuePosition,
    summary,
    nearbyCities: job?.nearbyCities ?? [],
    page,
    limit,
  };
}

searchRouter.get(
  "/results/:searchId",
  licenseQueryToHeaders,
  async (req: Request, res: Response, next: NextFunction) => {
    req.params.id = req.params.searchId;
    next();
  },
  loadSearchAccess,
  requireSearchOwnership,
  async (req: Request, res: Response) => {
    try {
      const searchId = String(req.params.searchId);
      const page = Math.max(1, parseInt(String(req.query.page ?? "1"), 10) || 1);
      const limit = Math.min(
        1000,
        Math.max(1, parseInt(String(req.query.limit ?? "1000"), 10) || 1000)
      );
      const payload = await buildSearchResultsPayload(searchId, page, limit);
      res.json(payload);
    } catch (err) {
      logger.error("GET /search/results/:searchId failed", {
        error: err instanceof Error ? err.message : "unknown",
      });
      res.status(500).json({ error: "Failed to fetch results" });
    }
  }
);

searchRouter.get("/suggestions", async (req: Request, res: Response) => {
  // Area suggestions: DeepSeek → Nominatim sub-areas → Nominatim nearby cities
  try {
    const { query, location, totalFound, exclude } = req.query as {
      query?: string;
      location?: string;
      totalFound?: string;
      exclude?: string;
    };

    if (!query || !location) {
      res.json({ suggestions: [], message: "" });
      return;
    }

    const found = parseInt(totalFound || "0", 10);
    const excludeLocations = exclude
      ? String(exclude).split("|").map((s) => s.trim()).filter(Boolean)
      : undefined;

    const result = await generateAreaSuggestions(query, location, found, {
      excludeLocations,
    });

    res.json({
      suggestions: result.suggestions,
      message: result.message,
      totalAreas: result.suggestions.length,
      source: result.source,
    });
  } catch (err) {
    logger.error("Suggestions endpoint failed", {
      error: err instanceof Error ? err.message : "unknown",
    });
    res.json({ suggestions: [], message: "" });
  }
});

searchRouter.get("/region-hint", async (req: Request, res: Response) => {
  try {
    const { query, location, totalFound } = req.query as {
      query?: string;
      location?: string;
      totalFound?: string;
    };

    if (!location?.trim()) {
      res.json({
        showRegionSuggestions: false,
        citySuggestions: [],
        message: "",
      });
      return;
    }

    const found = parseInt(totalFound || "0", 10);
    const result = await getSoftRegionCitySuggestions(
      location.trim(),
      found,
      query?.trim()
    );

    res.json({
      showRegionSuggestions:
        result.isBroadRegion && (result.citySuggestions?.length ?? 0) > 0,
      citySuggestions: result.citySuggestions ?? [],
      message: result.message ?? "",
    });
  } catch (err) {
    logger.error("Region hint endpoint failed", {
      error: err instanceof Error ? err.message : "unknown",
    });
    res.json({
      showRegionSuggestions: false,
      citySuggestions: [],
      message: "",
    });
  }
});

searchRouter.get("/activity", async (_req: Request, res: Response) => {
  try {
    const { data } = await supabase
      .from("user_searches")
      .select("query, location, total_found, created_at")
      .order("created_at", { ascending: false })
      .limit(10);

    res.json({ activity: data || [] });
  } catch {
    res.json({ activity: [] });
  }
});

searchRouter.get("/stats/total", async (_req: Request, res: Response) => {
  try {
    const { count } = await supabase
      .from("business_leads")
      .select("*", { count: "exact", head: true });

    res.json({ total: count || 0 });
  } catch {
    res.json({ total: 0 });
  }
});

searchRouter.get("/history", requireLicense, async (req: Request, res: Response) => {
  try {
    const history = await getUserSearchHistory(req.licenseKey!, 20);
    res.json({ history });
  } catch (err) {
    logger.error("GET /search/history failed", {
      error: err instanceof Error ? err.message : "unknown",
    });
    res.status(500).json({ error: "Failed to fetch history" });
  }
});

export async function handleFreeTrialSearch(
  req: Request,
  res: Response
): Promise<void> {
  let claimedEmail: string | null = null;
  let claimedIp: string | null = null;
  let ipCapBypassed = true;

  try {
    const { query, location, email: rawEmail } = req.body as {
      query?: string;
      location?: string;
      email?: string;
      visitorId?: string;
    };

    if (!query || !location) {
      res.status(400).json({
        error: "Business type and location are required",
      });
      return;
    }

    if (!rawEmail || typeof rawEmail !== "string") {
      res.status(403).json({
        error: "Trial email required. Complete the signup gate first.",
        code: "TRIAL_GATE_REQUIRED",
      });
      return;
    }

    const email = rawEmail.toLowerCase().trim();
    if (!TRIAL_EMAIL_RE.test(email)) {
      res.status(400).json({
        error: "Invalid email address",
      });
      return;
    }

    const signup = await getTrialSignupByEmail(email);
    if (!signup) {
      res.status(403).json({
        error: "Trial email required. Complete the signup gate first.",
        code: "TRIAL_GATE_REQUIRED",
      });
      return;
    }

    if ((signup.searches_used ?? 0) >= 2) {
      res.status(429).json({
        error: "Free trial limit reached",
        code: "TRIAL_LIMIT",
        message:
          "You have used your 2 free previews. Get full access to continue.",
        searchesUsed: signup.searches_used ?? 2,
        searchesRemaining: 0,
      });
      return;
    }

    const memUsage = getMemoryUsagePercent();
    if (memUsage > 85) {
      res.status(503).json({
        error: "Server is busy. Please try again in a moment.",
      });
      return;
    }

    const requestIp = clientIp(req);
    ipCapBypassed = isRateLimitAllowlisted(requestIp);

    if (!ipCapBypassed) {
      const ipStatus = await getTrialIpSearchStatus(requestIp);
      if (ipStatus.searchesUsed >= 2) {
        res.status(429).json({
          error: "Free trial limit reached for this network",
          code: "TRIAL_IP_LIMIT",
          message:
            "This network has already used the 2 free trial searches. Get full access to continue.",
          ipSearchesUsed: ipStatus.searchesUsed,
          ipSearchesRemaining: 0,
        });
        return;
      }
    }

    const claim = await claimTrialSearch(email);
    if (!claim.allowed) {
      if (claim.reason === "limit") {
        res.status(429).json({
          error: "Free trial limit reached",
          code: "TRIAL_LIMIT",
          message:
            "You have used your 2 free previews. Get full access to continue.",
          searchesUsed: claim.searchesUsed,
          searchesRemaining: claim.searchesRemaining,
        });
        return;
      }

      res.status(403).json({
        error: "Trial email required. Complete the signup gate first.",
        code: "TRIAL_GATE_REQUIRED",
      });
      return;
    }
    claimedEmail = email;

    if (!ipCapBypassed) {
      try {
        const ipClaim = await claimTrialIpSearch(requestIp);
        if (!ipClaim.allowed) {
          await releaseTrialSearch(email);
          res.status(429).json({
            error: "Free trial limit reached for this network",
            code: "TRIAL_IP_LIMIT",
            message:
              "This network has already used the 2 free trial searches. Get full access to continue.",
            ipSearchesUsed: ipClaim.searchesUsed,
            ipSearchesRemaining: ipClaim.searchesRemaining,
          });
          return;
        }
        claimedIp = requestIp;
      } catch (ipErr) {
        await releaseTrialSearch(email);
        throw ipErr;
      }
    }

    const trimmedQuery = query.trim();
    const trimmedLocation = location.trim();
    const searchJob = await createSearchJob(trimmedQuery, trimmedLocation, {
      isTrial: true,
      trialEmail: email,
    });

    await enqueueSearchJob({
      searchId: searchJob.id,
      query: trimmedQuery,
      location: trimmedLocation,
      isTrial: true,
    });
    const queuePosition = await resolveQueuePosition(searchJob.id);

    res.status(201).json({
      searchId: searchJob.id,
      status: queuePosition > 0 ? "queued" : "running",
      queuePosition,
      isTrial: true,
      maxResults: 15,
      searchesUsed: claim.searchesUsed,
      searchesRemaining: claim.searchesRemaining,
      scrapingInProgress: queuePosition === 0,
      emailScrapingComplete: false,
      fullyComplete: false,
      message:
        queuePosition > 0
          ? `Your search is queued. You are number ${queuePosition} in line.`
          : `Searching for ${trimmedQuery} in ${trimmedLocation}`,
    });
  } catch (err) {
    if (claimedEmail) {
      await releaseTrialSearch(claimedEmail).catch(() => undefined);
    }
    if (claimedIp) {
      await releaseTrialIpSearch(claimedIp).catch(() => undefined);
    }
    logger.error("Free trial search failed", {
      error: err instanceof Error ? err.message : "unknown",
    });
    if (!res.headersSent) {
      res.status(500).json({ error: "Search failed. Please try again." });
    }
  }
}

searchRouter.post("/freetrial", handleFreeTrialSearch);

searchRouter.post("/", checkSearchLimit, async (req: Request, res: Response) => {
  try {
    const { query, location } = req.body as { query?: string; location?: string };

    if (!query || !location) {
      res.status(400).json({
        error: "Both query and location are required",
        example: { query: "restaurants", location: "Lagos, Nigeria" },
      });
      return;
    }

    const trimmedQuery = query.trim();
    const trimmedLocation = location.trim();

    const memUsage = getMemoryUsagePercent();
    if (memUsage > 85) {
      res.status(503).json({
        error: "Server is under high load. Please try again in a few minutes.",
        code: "SERVER_BUSY",
      });
      return;
    }

    const queueStatus = await refreshSearchQueueStatus();
    if (queueStatus.queued >= 10) {
      res.status(503).json({
        error: "Search queue is full. Please try again in a few minutes.",
        code: "QUEUE_FULL",
      });
      return;
    }

    if (req.licenseId && req.licenseId !== "unknown") {
      trackSearch(req.licenseId);
    }

    const licenseEmail = resolveLicenseEmailFromRequest(req);
    const licenseKey = resolveLicenseKeyFromRequest(req);

    const cached = await getCachedSearch(trimmedQuery, trimmedLocation);
    if (cached && cached.leads.length > 0) {
      const newJob = await createSearchJob(trimmedQuery, trimmedLocation, {
        licenseEmail,
      });
      const rows = copyCachedLeadsForInsert(cached.leads, newJob.id);
      const { error: insertError } = await supabase
        .from("business_leads")
        .insert(rows);

      if (insertError) {
        logger.error("Failed to insert cached leads", { error: insertError.message });
      }

      await markSearchComplete(newJob.id, cached.leads.length);
      const cachedStats = computeSearchStats(cached.leads.map((l) => ({ ...l, searchId: newJob.id })));
      await updateSearchJob(newJob.id, {
        scrapingInProgress: false,
        statsSummary: cachedStats,
      });

      if (licenseKey) {
        void saveUserSearch({
          licenseKey,
          searchId: newJob.id,
          query: trimmedQuery,
          location: trimmedLocation,
          totalFound: cached.leads.length,
        });
      }

      if (licenseEmail && cached.leads.length > 0) {
        void recordSearchHistorySafe({
          email: licenseEmail,
          business_type: trimmedQuery,
          location: trimmedLocation,
          results_count: cached.leads.length,
        });
      }

      logger.info("[search-diag] Serving cached search", {
        searchId: newJob.id,
        priorSearchId: cached.searchId,
        totalFound: cached.leads.length,
        priorTotalFound: cached.priorTotalFound,
        cacheHit: true,
      });

      res.status(201).json({
        searchId: newJob.id,
        status: "completed",
        cached: true,
        totalFound: cached.leads.length,
        scrapingInProgress: false,
        emailScrapingComplete: true,
        fullyComplete: true,
        searchesRemaining: req.searchesRemaining ?? null,
        message: `Found ${cached.leads.length} businesses instantly`,
      } satisfies SearchResponse);
      return;
    }

    const searchJob = await createSearchJob(trimmedQuery, trimmedLocation, {
      licenseEmail,
    });

    await enqueueSearchJob({
      searchId: searchJob.id,
      query: trimmedQuery,
      location: trimmedLocation,
      licenseKey,
      licenseEmail,
      isTrial: false,
    });
    const queuePosition = await resolveQueuePosition(searchJob.id);

    res.status(201).json({
      searchId: searchJob.id,
      status: queuePosition > 0 ? "queued" : "running",
      queuePosition,
      scrapingInProgress: queuePosition === 0,
      emailScrapingComplete: false,
      fullyComplete: false,
      searchesRemaining: req.searchesRemaining ?? null,
      message:
        queuePosition > 0
          ? `Your search is queued. You are number ${queuePosition} in line.`
          : `Searching for ${trimmedQuery} in ${trimmedLocation}`,
    } satisfies SearchResponse);
  } catch (err) {
    logger.error("POST /search failed", {
      error: err instanceof Error ? err.message : "unknown",
    });
    if (!res.headersSent) {
      res.status(500).json({ error: "Failed to create search job" });
    }
  }
});

searchRouter.get(
  "/:id",
  licenseQueryToHeaders,
  loadSearchAccess,
  requireSearchOwnership,
  async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const job = req.searchAccess?.job ?? (await getSearchJob(id));
    if (!job) {
      res.status(404).json({ error: "Search not found" });
      return;
    }
    const position = await resolveQueuePosition(id);
    res.json({
      ...job,
      queuePosition: position,
    });
  } catch (err) {
    logger.error("GET /search/:id failed", {
      error: err instanceof Error ? err.message : "unknown",
    });
    res.status(500).json({ error: "Failed to fetch search status" });
  }
}
);

searchRouter.get(
  "/:id/results",
  licenseQueryToHeaders,
  loadSearchAccess,
  requireSearchOwnership,
  async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const page = Math.max(1, parseInt(String(req.query.page ?? "1"), 10) || 1);
    const limit = Math.min(
      1000,
      Math.max(1, parseInt(String(req.query.limit ?? "1000"), 10) || 1000)
    );
    const job = req.searchAccess?.job ?? (await getSearchJob(id));
    const payload = await buildSearchResultsPayload(id, page, limit);
    res.json({
      ...payload,
      status: job?.status ?? payload.status,
    });
  } catch (err) {
    logger.error("GET /search/:id/results failed", {
      error: err instanceof Error ? err.message : "unknown",
    });
    res.status(500).json({ error: "Failed to fetch results" });
  }
}
);

searchRouter.get(
  "/:id/stream",
  licenseQueryToHeaders,
  loadSearchAccess,
  requireSearchOwnership,
  async (req: Request, res: Response) => {
  const searchId = String(req.params.id);

  try {
    const job = req.searchAccess?.job ?? (await getSearchJob(searchId));
    if (!job) {
      res.status(404).json({ error: "Search not found" });
      return;
    }

    const origin = req.headers.origin;
    const allowOrigin =
      typeof origin === "string" && origin.length > 0 ? origin : "*";

    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
      "Access-Control-Allow-Origin": allowOrigin,
      "Access-Control-Allow-Credentials": "true",
    });
    res.flushHeaders();

    registerStream(searchId, res);

    res.write(
      `data: ${JSON.stringify({
        type: "started",
        searchId,
        message: formatSearchMessage(job.query, job.location),
      })}\n\n`
    );

    const heartbeat = setInterval(() => {
      if (!res.writableEnded) {
        res.write(`data: ${JSON.stringify({ type: "heartbeat" })}\n\n`);
      } else {
        clearInterval(heartbeat);
      }
    }, 15000);

    try {
      const existingJob = await getSearchJob(searchId);
      // Wait for fullyComplete — status alone flips at Phase 1 end.
      if (existingJob?.fullyComplete) {
        const limit = 250;
        let page = 1;
        let allLeads: Awaited<ReturnType<typeof getSearchResults>>["leads"] = [];
        let dbTotal = 0;
        while (true) {
          const batch = await getSearchResults(searchId, page, limit);
          if (page === 1) dbTotal = batch.total;
          allLeads = allLeads.concat(batch.leads);
          if (batch.leads.length < limit || allLeads.length >= batch.total) break;
          page += 1;
        }
        for (const lead of allLeads) {
          res.write(
            `data: ${JSON.stringify({ type: "lead", data: lead, lead })}\n\n`
          );
        }
        const total =
          existingJob.totalFound > 0 ? existingJob.totalFound : allLeads.length;
        res.write(
          `data: ${JSON.stringify({
            type: "complete",
            total,
            status: existingJob.status,
            scrapingInProgress: existingJob.scrapingInProgress,
            emailScrapingComplete: existingJob.emailScrapingComplete,
            fullyComplete: true,
            message: `Search complete. Found ${total} businesses in ${existingJob.location}.`,
          })}\n\n`
        );
        clearInterval(heartbeat);
        removeStream(searchId);
        res.end();
        return;
      }
    } catch (err) {
      logger.error("Error checking existing results", {
        error: err instanceof Error ? err.message : "unknown",
      });
    }

    const position = await resolveQueuePosition(searchId);
    if (position > 0) {
      res.write(
        `data: ${JSON.stringify({
          type: "progress",
          message: `Your search is queued. You are number ${position} in line.`,
          processed: 0,
        })}\n\n`
      );
    }

    const statusPoll = setInterval(() => {
      void (async () => {
        try {
          const current = await getSearchJob(searchId);
          if (!current || res.writableEnded) return;

          const queuePos = await resolveQueuePosition(searchId);
          if (queuePos > 0) {
            res.write(
              `data: ${JSON.stringify({
                type: "progress",
                message: `Your search is queued. You are number ${queuePos} in line.`,
                processed: 0,
              })}\n\n`
            );
          }

          if (current.fullyComplete) {
            const limit = 250;
            let page = 1;
            let allLeads: Awaited<ReturnType<typeof getSearchResults>>["leads"] = [];
            while (true) {
              const batch = await getSearchResults(searchId, page, limit);
              allLeads = allLeads.concat(batch.leads);
              if (batch.leads.length < limit || allLeads.length >= batch.total) break;
              page += 1;
            }
            for (const lead of allLeads) {
              res.write(
                `data: ${JSON.stringify({ type: "lead", data: lead, lead })}\n\n`
              );
            }
            const total =
              current.totalFound > 0 ? current.totalFound : allLeads.length;
            res.write(
              `data: ${JSON.stringify({
                type: "complete",
                total,
                status: current.status,
                scrapingInProgress: current.scrapingInProgress,
                emailScrapingComplete: current.emailScrapingComplete,
                fullyComplete: true,
                message: `Search complete. Found ${total} businesses in ${current.location}.`,
              })}\n\n`
            );
            clearInterval(statusPoll);
            clearInterval(heartbeat);
            removeStream(searchId);
            res.end();
            return;
          }

          if (current.status === "failed") {
            res.write(
              `data: ${JSON.stringify({
                type: "error",
                message:
                  current.error ??
                  "Search did not complete. Please try a broader location or business type.",
              })}\n\n`
            );
            clearInterval(statusPoll);
            clearInterval(heartbeat);
            removeStream(searchId);
            res.end();
          }
        } catch {
          /* ignore poll errors */
        }
      })();
    }, 8000);

    req.on("close", () => {
      clearInterval(heartbeat);
      clearInterval(statusPoll);
      removeStream(searchId);
      logger.info("SSE client disconnected", { searchId });
    });
  } catch (err) {
    logger.error("GET /search/:id/stream failed", {
      error: err instanceof Error ? err.message : "unknown",
    });
    if (!res.headersSent) {
      res.status(500).json({ error: "Failed to open stream" });
    }
  }
}
);
