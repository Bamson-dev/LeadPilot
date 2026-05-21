import { Router, type Request, type Response } from "express";
import { z } from "zod";
import type { SearchResponse } from "@leadpilot/shared";
import {
  copyLeadsToSearch,
  createSearchJob,
  getSearchJob,
  getSearchResults,
  markSearchComplete,
} from "../database/search-repository";
import { getCachedResults } from "../services/cache-service";
import { enqueueSearch, getQueuePosition, searchQueue } from "../queues/search-queue";
import { checkSearchLimit } from "../middleware/check-search-limit";
import { trackSearch } from "../services/abuse-detection";
import {
  emitToStream,
  onStreamEvent,
  registerStream,
  removeStream,
} from "../services/stream-registry";
import { logger } from "../utils/logger";

const searchBodySchema = z.object({
  query: z.string().min(2).max(100),
  location: z.string().min(2).max(100),
});

export const searchRouter = Router();

searchRouter.get("/queue/status", (_req: Request, res: Response) => {
  res.json(searchQueue.getStatus());
});

searchRouter.post("/", checkSearchLimit, async (req: Request, res: Response) => {
  try {
    const parsed = searchBodySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "query and location are required" });
      return;
    }

    const query = parsed.data.query.trim();
    const location = parsed.data.location.trim();

    trackSearch(req.licenseId!);

    const cachedResults = await getCachedResults(query, location);
    if (cachedResults && cachedResults.length > 0) {
      const searchJob = await createSearchJob(query, location);
      await copyLeadsToSearch(searchJob.id, cachedResults);
      await markSearchComplete(searchJob.id, cachedResults.length);

      const response: SearchResponse = {
        searchId: searchJob.id,
        status: "completed",
        cached: true,
        totalFound: cachedResults.length,
        searchesRemaining: req.searchesRemaining,
      };
      res.status(201).json(response);
      return;
    }

    const searchJob = await createSearchJob(query, location);

    res.status(201).json({
      searchId: searchJob.id,
      status: "queued",
      searchesRemaining: req.searchesRemaining,
    } satisfies SearchResponse);

    enqueueSearch(searchJob.id, query, location);
  } catch (err) {
    logger.error("POST /search failed", {
      error: err instanceof Error ? err.message : "unknown",
    });
    res.status(500).json({ error: "Failed to create search job" });
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

    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
      "Access-Control-Allow-Origin": "*",
    });
    res.flushHeaders();

    registerStream(searchId, res);
    emitToStream(searchId, { type: "started", searchId });

    const heartbeat = setInterval(() => {
      if (!res.writableEnded) {
        res.write(": heartbeat\n\n");
      }
    }, 5000);

    const endStream = () => {
      clearInterval(heartbeat);
      removeStream(searchId);
      if (!res.writableEnded) {
        res.end();
      }
    };

    const unsubscribe = onStreamEvent(searchId, (data) => {
      const event = data as { type?: string };
      if (event.type === "complete" || event.type === "error") {
        endStream();
      }
    });

    if (job.status === "completed") {
      emitToStream(searchId, { type: "complete", total: job.totalFound });
      endStream();
      return;
    }

    if (job.status === "failed") {
      emitToStream(searchId, { type: "error", message: job.error ?? "Search failed" });
      endStream();
      return;
    }

    const position = getQueuePosition(searchId);
    if (position != null) {
      emitToStream(searchId, {
        type: "phase",
        phase: `Your search is queued (position ${position}). Results will appear shortly.`,
      });
    }

    req.on("close", () => {
      clearInterval(heartbeat);
      unsubscribe();
      removeStream(searchId);
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
