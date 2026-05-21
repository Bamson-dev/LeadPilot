import type { StreamEvent } from "@leadpilot/shared";
import { markSearchFailed } from "../database/search-repository";
import { logger } from "../utils/logger";
import { runScraperJob } from "../services/scraper-service";
import { clearStreamBuffer, emitToStream } from "../services/stream-registry";
import { SEARCH_JOB_TIMEOUT_MS } from "../scraper/utils/constants";

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(() => reject(new Error(message)), ms);
    }),
  ]);
}

class SearchQueue {
  private queue: Array<{
    searchId: string;
    query: string;
    location: string;
    licenseKey?: string;
    licenseEmail?: string;
    resolve: () => void;
    reject: (err: Error) => void;
  }> = [];
  private running = 0;
  private readonly maxConcurrent: number;

  constructor(maxConcurrent = 5) {
    this.maxConcurrent = maxConcurrent;
  }

  async add(
    searchId: string,
    query: string,
    location: string,
    options?: { licenseKey?: string; licenseEmail?: string }
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      this.queue.push({
        searchId,
        query,
        location,
        licenseKey: options?.licenseKey,
        licenseEmail: options?.licenseEmail,
        resolve,
        reject,
      });
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
      await withTimeout(
        runScraperJob(job.searchId, job.query, job.location, emit, {
          licenseKey: job.licenseKey,
          licenseEmail: job.licenseEmail,
        }),
        SEARCH_JOB_TIMEOUT_MS,
        "Search timed out on the server. Try a broader location or a simpler business type."
      );
      job.resolve();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      emitToStream(job.searchId, { type: "error", message });
      markSearchFailed(job.searchId, message).catch(() => undefined);
      job.reject(err instanceof Error ? err : new Error(message));
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

  /** Jobs waiting in line (not including currently running). */
  getQueuePosition(): number {
    return this.queue.length;
  }

  getQueuePositionForSearch(searchId: string): number | null {
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
  location: string,
  options?: { licenseKey?: string; licenseEmail?: string }
): void {
  searchQueue.add(searchId, query, location, options).catch((err) => {
    logger.error("Search queue error", {
      searchId,
      error: err.message,
    });
    emitToStream(searchId, { type: "error", message: err.message });
    markSearchFailed(searchId, err.message).catch(() => undefined);
  });
}

export function getQueuePosition(searchId: string): number | null {
  return searchQueue.getQueuePositionForSearch(searchId);
}
