import { Router, type Request, type Response } from "express";
import { z } from "zod";
import type { SearchResponse } from "@leadpilot/shared";
import {
  createSearchJob,
  getSearchJob,
  getSearchResults,
} from "../database/search-repository";
import { enqueueSearch, subscribeToSearch } from "../queues/search-queue";
import { logger } from "../utils/logger";

const searchBodySchema = z.object({
  query: z.string().min(2).max(100),
  location: z.string().min(2).max(100),
});

export const searchRouter = Router();

searchRouter.post("/", async (req: Request, res: Response) => {
  try {
    const parsed = searchBodySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid search. Provide query and location." });
      return;
    }

    const { query, location } = parsed.data;
    const job = await createSearchJob(query.trim(), location.trim());
    enqueueSearch(job.id, job.query, job.location);

    const response: SearchResponse = {
      searchId: job.id,
      status: job.status,
    };
    res.status(201).json(response);
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
    res.json(job);
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
    const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? "50"), 10) || 50));
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

    send({ type: "progress", count: job.processed, max: job.totalFound || 200 });

    const heartbeat = setInterval(() => {
      res.write(": heartbeat\n\n");
    }, 15000);

    const unsubscribe = subscribeToSearch(searchId, (event) => {
      send(event);
      if (event.type === "complete" || event.type === "error") {
        clearInterval(heartbeat);
        res.end();
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
