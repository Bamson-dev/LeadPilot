import os from "os";
import { Router, type NextFunction, type Request, type Response } from "express";
import type { SearchResponse, SearchResultsResponse } from "@leadthur/shared";
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
import { checkBroadRegionLocation } from "../services/region-detection";
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

export const searchRouter = Router();

const freeTrialTracker = new Map<string, number>();

setInterval(() => {
  freeTrialTracker.clear();
}, 60 * 60 * 1000);

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

  if (access.isTrial && !access.licenseEmail) {
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

  return {
    searchId,
    status: job?.status ?? "unknown",
    leads,
    total,
    totalFound: total,
    scrapingInProgress: Boolean(job?.scrapingInProgress),
    emailScrapingComplete: resolveEmailScrapingComplete(job),
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
  try {
    const { query, location, totalFound, exclude } = req.query as {
      query?: string;
      location?: string;
      totalFound?: string;
      exclude?: string | string[];
    };

    if (!query || !location) {
      res.json({ suggestions: [], message: "" });
      return;
    }

    const found = parseInt(totalFound || "0", 10);
    const excludeRaw = exclude
      ? Array.isArray(exclude)
        ? exclude
        : exclude.split("|")
      : [];
    const excludeLocations = excludeRaw.map((v) => v.trim()).filter(Boolean);

    const suggestions = await generateAreaSuggestions(
      query,
      location,
      found,
      { excludeLocations }
    );

    if (suggestions.length === 0) {
      res.json({
        suggestions: [],
        message:
          found >= 200
            ? "Great coverage. You already have a large result set for this area."
            : "Try a nearby city from the suggestions above, or broaden your search location.",
      });
      return;
    }

    const usedNearbyFallback = suggestions.some((s) => {
      const loc = s.location.toLowerCase();
      const parent = location.toLowerCase();
      return !loc.includes(parent.split(",")[0]?.trim() ?? parent);
    });

    res.json({
      suggestions,
      message: usedNearbyFallback
        ? `Find more ${query} businesses in these nearby cities`
        : `Split your search across these areas to find more ${query} businesses`,
      totalAreas: suggestions.length,
    });
  } catch (err) {
    logger.error("Suggestions endpoint failed", {
      error: err instanceof Error ? err.message : "unknown",
    });
    res.json({ suggestions: [], message: "" });
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
  try {
    const { query, location, visitorId } = req.body as {
      query?: string;
      location?: string;
      visitorId?: string;
    };

    if (!query || !location) {
      res.status(400).json({
        error: "Business type and location are required",
      });
      return;
    }

    if (!visitorId) {
      res.status(400).json({
        error: "Visitor ID required",
      });
      return;
    }

    const ip = req.ip || req.socket.remoteAddress || "unknown";
    const limitKey = `${visitorId}:${ip}`;
    const searchCount = freeTrialTracker.get(limitKey) || 0;

    if (searchCount >= 2) {
      res.status(429).json({
        error: "Free trial limit reached",
        code: "TRIAL_LIMIT",
        message:
          "You have used your 2 free previews. Get full access to continue.",
      });
      return;
    }

    freeTrialTracker.set(limitKey, searchCount + 1);

    const memUsage = getMemoryUsagePercent();
    if (memUsage > 85) {
      res.status(503).json({
        error: "Server is busy. Please try again in a moment.",
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

    const trimmedQuery = query.trim();
    const trimmedLocation = location.trim();
    const searchJob = await createSearchJob(trimmedQuery, trimmedLocation, {
      isTrial: true,
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
      message:
        queuePosition > 0
          ? `Your search is queued. You are number ${queuePosition} in line.`
          : `Searching for ${trimmedQuery} in ${trimmedLocation}`,
    });
  } catch (err) {
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

    const regionCheck = await checkBroadRegionLocation(trimmedLocation, trimmedQuery);
    if (regionCheck.isBroadRegion && regionCheck.citySuggestions?.length) {
      res.status(200).json({
        searchId: "",
        status: "city_selection_required",
        requiresCitySelection: true,
        citySuggestions: regionCheck.citySuggestions,
        message:
          regionCheck.message ??
          "LeadThur works best for specific cities. Pick a city below to search.",
        searchesRemaining: req.searchesRemaining ?? null,
      } satisfies SearchResponse);
      return;
    }

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

      res.status(201).json({
        searchId: newJob.id,
        status: "completed",
        cached: true,
        totalFound: cached.leads.length,
        scrapingInProgress: false,
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
        res.write(": heartbeat\n\n");
      } else {
        clearInterval(heartbeat);
      }
    }, 5000);

    try {
      const existingJob = await getSearchJob(searchId);
      if (existingJob && existingJob.status === "completed") {
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
