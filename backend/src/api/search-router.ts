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
import { enqueueSearch, getQueuePosition, searchQueue, subscribeToSearch } from "../queues/search-queue";
import { logger } from "../utils/logger";

const searchBodySchema = z.object({
  query: z.string().min(2).max(100),
  location: z.string().min(2).max(100),
});

export const searchRouter = Router();

searchRouter.get("/queue/status", (_req: Request, res: Response) => {
  res.json(searchQueue.getStatus());
});

searchRouter.post("/", async (req: Request, res: Response) => {
  try {
    const parsed = searchBodySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "query and location are required" });
      return;
    }

    const query = parsed.data.query.trim();
    const location = parsed.data.location.trim();

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
      };
      res.status(201).json(response);
      return;
    }

    const searchJob = await createSearchJob(query, location);

    res.status(201).json({
      searchId: searchJob.id,
      status: "queued",
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

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders();

    const send = (data: unknown) => {
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    send({ type: "started", searchId });

    const heartbeat = setInterval(() => {
      res.write(": heartbeat\n\n");
    }, 5000);

    const unsubscribe = subscribeToSearch(searchId, (event) => {
      send(event);
      if (event.type === "complete" || event.type === "error") {
        clearInterval(heartbeat);
        if (!res.writableEnded) res.end();
      }
    });

    if (job.status === "completed") {
      send({ type: "complete", total: job.totalFound });
      clearInterval(heartbeat);
      unsubscribe();
      res.end();
      return;
    }

    if (job.status === "failed") {
      send({ type: "error", message: job.error ?? "Search failed" });
      clearInterval(heartbeat);
      unsubscribe();
      res.end();
      return;
    }

    const position = getQueuePosition(searchId);
    if (position != null) {
      send({
        type: "phase",
        phase: `Your search is queued (position ${position}). Results will appear shortly.`,
      });
    }

    req.on("close", () => {
      clearInterval(heartbeat);
      unsubscribe();
      if (!res.writableEnded) {
        res.end();
      }
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
