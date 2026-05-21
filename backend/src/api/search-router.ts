import os from "os";
import { Router, type Request, type Response } from "express";
import type { SearchResponse } from "@leadpilot/shared";
import {
  createSearchJob,
  getSearchJob,
  getSearchResults,
  markSearchComplete,
  markSearchFailed,
} from "../database/search-repository";
import {
  copyCachedLeadsForInsert,
  getCachedSearch,
} from "../services/cache-service";
import { getUserSearchHistory } from "../database/user-search-repository";
import { searchQueue, getQueuePosition, enqueueSearch } from "../queues/search-queue";
import { checkSearchLimit } from "../middleware/check-search-limit";
import { trackSearch } from "../services/abuse-detection";
import { registerStream, removeStream } from "../services/stream-registry";
import { formatSearchMessage } from "../utils/search-messages";
import { supabase } from "../database/client";
import { logger } from "../utils/logger";
import { generateAreaSuggestions } from "../services/suggestion-service";

export const searchRouter = Router();

function getMemoryUsagePercent(): number {
  const total = os.totalmem();
  const free = os.freemem();
  return ((total - free) / total) * 100;
}

searchRouter.get("/queue/status", (_req: Request, res: Response) => {
  res.json(searchQueue.getStatus());
});

searchRouter.get("/suggestions", async (req: Request, res: Response) => {
  try {
    const { query, location, totalFound } = req.query as {
      query?: string;
      location?: string;
      totalFound?: string;
    };

    if (!query || !location) {
      res.json({ suggestions: [], message: "" });
      return;
    }

    const found = parseInt(totalFound || "0", 10);
    const suggestions = await generateAreaSuggestions(query, location, found);

    if (suggestions.length === 0) {
      res.json({
        suggestions: [],
        message:
          found >= 200
            ? "Great coverage. You already have a large result set for this area."
            : "",
      });
      return;
    }

    res.json({
      suggestions,
      message: `Split your search across these areas to find more ${query} businesses`,
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

searchRouter.get("/history", async (req: Request, res: Response) => {
  try {
    const licenseKey = req.headers["x-license-key"] as string;
    if (!licenseKey) {
      res.status(401).json({ error: "License key required" });
      return;
    }

    const history = await getUserSearchHistory(licenseKey, 20);
    res.json({ history });
  } catch (err) {
    logger.error("GET /search/history failed", {
      error: err instanceof Error ? err.message : "unknown",
    });
    res.status(500).json({ error: "Failed to fetch history" });
  }
});

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

    const queueStatus = searchQueue.getStatus();
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

    const cached = await getCachedSearch(trimmedQuery, trimmedLocation);
    if (cached && cached.leads.length > 0) {
      const newJob = await createSearchJob(trimmedQuery, trimmedLocation);
      const rows = copyCachedLeadsForInsert(cached.leads, newJob.id);
      const { error: insertError } = await supabase
        .from("business_leads")
        .insert(rows);

      if (insertError) {
        logger.error("Failed to insert cached leads", { error: insertError.message });
      }

      await markSearchComplete(newJob.id, cached.leads.length);

      res.status(201).json({
        searchId: newJob.id,
        status: "completed",
        cached: true,
        totalFound: cached.leads.length,
        searchesRemaining: req.searchesRemaining ?? null,
        message: `Found ${cached.leads.length} businesses instantly`,
      } satisfies SearchResponse);
      return;
    }

    const searchJob = await createSearchJob(trimmedQuery, trimmedLocation);
    const licenseEmail = (req.headers["x-license-email"] as string) || undefined;
    const queuePosition = searchQueue.getQueuePosition();

    res.status(201).json({
      searchId: searchJob.id,
      status: "queued",
      queuePosition,
      searchesRemaining: req.searchesRemaining ?? null,
      message: `Searching for ${trimmedQuery} in ${trimmedLocation}`,
    } satisfies SearchResponse);

    setImmediate(() => {
      enqueueSearch(searchJob.id, trimmedQuery, trimmedLocation, {
        licenseKey: req.licenseKey,
        licenseEmail,
      });
    });
  } catch (err) {
    logger.error("POST /search failed", {
      error: err instanceof Error ? err.message : "unknown",
    });
    if (!res.headersSent) {
      res.status(500).json({ error: "Failed to create search job" });
    }
  }
});

searchRouter.get("/:id", async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const job = await getSearchJob(id);
    if (!job) {
      res.status(404).json({ error: "Search not found" });
      return;
    }
    const position = getQueuePosition(id);
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
});

searchRouter.get("/:id/results", async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const page = Math.max(1, parseInt(String(req.query.page ?? "1"), 10) || 1);
    const limit = Math.min(
      250,
      Math.max(1, parseInt(String(req.query.limit ?? "250"), 10) || 250)
    );
    const { leads, total } = await getSearchResults(id, page, limit);
    res.json({ leads, total, page, limit });
  } catch (err) {
    logger.error("GET /search/:id/results failed", {
      error: err instanceof Error ? err.message : "unknown",
    });
    res.status(500).json({ error: "Failed to fetch results" });
  }
});

searchRouter.get("/:id/stream", async (req: Request, res: Response) => {
  const searchId = String(req.params.id);

  try {
    const job = await getSearchJob(searchId);
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
        const { leads } = await getSearchResults(searchId, 1, 200);
        for (const lead of leads) {
          res.write(
            `data: ${JSON.stringify({ type: "lead", data: lead, lead })}\n\n`
          );
        }
        res.write(
          `data: ${JSON.stringify({
            type: "complete",
            total: leads.length,
            message: `Search complete. Found ${leads.length} businesses in ${existingJob.location}.`,
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

    const position = getQueuePosition(searchId);
    if (position != null && position > 0) {
      res.write(
        `data: ${JSON.stringify({
          type: "progress",
          message: `Your search is queued. Position ${position} in line.`,
          processed: 0,
        })}\n\n`
      );
    }

    const statusPoll = setInterval(() => {
      void (async () => {
        try {
          const current = await getSearchJob(searchId);
          if (!current || res.writableEnded) return;
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
});
