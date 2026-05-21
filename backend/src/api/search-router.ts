import { Router, type Request, type Response } from "express";
import type { SearchResponse } from "@leadpilot/shared";
import {
  copyLeadsToSearch,
  createSearchJob,
  getSearchJob,
  getSearchResults,
  markSearchComplete,
  markSearchFailed,
} from "../database/search-repository";
import { getCachedResults } from "../services/cache-service";
import { searchQueue, getQueuePosition } from "../queues/search-queue";
import { checkSearchLimit } from "../middleware/check-search-limit";
import { trackSearch } from "../services/abuse-detection";
import { registerStream, removeStream } from "../services/stream-registry";
import { formatSearchMessage } from "../utils/search-messages";
import { logger } from "../utils/logger";

export const searchRouter = Router();

searchRouter.get("/queue/status", (_req: Request, res: Response) => {
  res.json(searchQueue.getStatus());
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

    if (req.licenseId && req.licenseId !== "unknown") {
      trackSearch(req.licenseId);
    }

    const cachedResults = await getCachedResults(trimmedQuery, trimmedLocation);
    if (cachedResults && cachedResults.length > 0) {
      const searchJob = await createSearchJob(trimmedQuery, trimmedLocation);
      await copyLeadsToSearch(searchJob.id, cachedResults);
      await markSearchComplete(searchJob.id, cachedResults.length);

      res.status(201).json({
        searchId: searchJob.id,
        status: "completed",
        cached: true,
        totalFound: cachedResults.length,
        searchesRemaining: req.searchesRemaining ?? null,
        message: formatSearchMessage(trimmedQuery, trimmedLocation),
      } satisfies SearchResponse);
      return;
    }

    const searchJob = await createSearchJob(trimmedQuery, trimmedLocation);

    res.status(201).json({
      searchId: searchJob.id,
      status: "queued",
      searchesRemaining: req.searchesRemaining ?? null,
      message: formatSearchMessage(trimmedQuery, trimmedLocation),
    } satisfies SearchResponse);

    setImmediate(() => {
      searchQueue
        .add(searchJob.id, trimmedQuery, trimmedLocation)
        .catch((err) => {
          logger.error("Queue error", {
            searchId: searchJob.id,
            error: err instanceof Error ? err.message : "unknown",
          });
          markSearchFailed(
            searchJob.id,
            err instanceof Error ? err.message : "Search failed"
          ).catch(() => undefined);
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
    const limit = Math.min(200, Math.max(1, parseInt(String(req.query.limit ?? "50"), 10) || 50));
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
          res.write(`data: ${JSON.stringify({ type: "lead", data: lead, lead })}\n\n`);
        }
        res.write(
          `data: ${JSON.stringify({
            type: "complete",
            total: leads.length,
            message: `Search complete. Found ${leads.length} businesses.`,
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
    if (position != null) {
      res.write(
        `data: ${JSON.stringify({
          type: "progress",
          message: `${formatSearchMessage(job.query, job.location)} (queued position ${position})`,
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
                message: current.error ?? "Search failed",
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
