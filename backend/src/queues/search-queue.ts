import type { StreamEvent } from "@leadpilot/shared";
import { getEnv } from "../config/env";
import { markSearchFailed } from "../database/search-repository";
import { logger } from "../utils/logger";
import { runScraperJob } from "../services/scraper-service";
import { clearStreamBuffer, emitToStream } from "../services/stream-registry";

class SearchQueue {
  private queue: Array<{
    searchId: string;
    query: string;
    location: string;
    resolve: () => void;
    reject: (err: Error) => void;
  }> = [];
  private running = 0;
  private readonly maxConcurrent: number;

  constructor(maxConcurrent = 5) {
    this.maxConcurrent = maxConcurrent;
  }

  async add(searchId: string, query: string, location: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.queue.push({ searchId, query, location, resolve, reject });
      void this.process();
    });
  }

  private async process(): Promise<void> {
    if (this.running >= this.maxConcurrent || this.queue.length === 0) return;

    const job = this.queue.shift()!;
    this.running++;

    const emit = (event: StreamEvent) => {
      emitToStream(job.searchId, event);
      if (event.type === "complete" || event.type === "error") {
        clearStreamBuffer(job.searchId);
      }
    };

    try {
      await runScraperJob(job.searchId, job.query, job.location, emit);
      job.resolve();
    } catch (err) {
      job.reject(err instanceof Error ? err : new Error(String(err)));
    } finally {
      this.running--;
      void this.process();
    }
  }

  getStatus() {
    return {
      running: this.running,
      queued: this.queue.length,
      maxConcurrent: this.maxConcurrent,
    };
  }

  getQueuePosition(searchId: string): number | null {
    const idx = this.queue.findIndex((j) => j.searchId === searchId);
    return idx >= 0 ? idx + 1 : null;
  }
}

export const searchQueue = new SearchQueue(
  parseInt(process.env.SCRAPER_CONCURRENCY || "5", 10)
);

export function enqueueSearch(
  searchId: string,
  query: string,
  location: string
): void {
  searchQueue.add(searchId, query, location).catch((err) => {
    logger.error("Search queue error", {
      searchId,
      error: err.message,
    });
    emitToStream(searchId, { type: "error", message: err.message });
    markSearchFailed(searchId, err.message).catch(() => undefined);
  });
}

export function getQueuePosition(searchId: string): number | null {
  return searchQueue.getQueuePosition(searchId);
}
