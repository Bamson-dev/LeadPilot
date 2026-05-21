import { getEnv } from "../config/env";
import { markSearchFailed } from "../database/search-repository";
import { logger } from "../utils/logger";
import { runScraperJob, type ScrapeEmitter } from "../services/scraper-service";

interface QueueJob {
  searchId: string;
  query: string;
  location: string;
  emit: ScrapeEmitter;
  resolve: () => void;
  reject: (err: Error) => void;
}

const subscribers = new Map<string, Set<ScrapeEmitter>>();

export function subscribeToSearch(searchId: string, emit: ScrapeEmitter): () => void {
  if (!subscribers.has(searchId)) subscribers.set(searchId, new Set());
  subscribers.get(searchId)!.add(emit);
  return () => {
    subscribers.get(searchId)?.delete(emit);
  };
}

function broadcast(searchId: string, event: Parameters<ScrapeEmitter>[0]): void {
  subscribers.get(searchId)?.forEach((emit) => {
    try {
      emit(event);
    } catch (err) {
      logger.warn("SSE subscriber error", {
        error: err instanceof Error ? err.message : "unknown",
      });
    }
  });
}

class SearchQueue {
  private queue: QueueJob[] = [];
  private running = 0;
  private readonly maxConcurrent: number;

  constructor(maxConcurrent = 5) {
    this.maxConcurrent = maxConcurrent;
  }

  async add(
    searchId: string,
    query: string,
    location: string,
    emit: ScrapeEmitter
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      this.queue.push({ searchId, query, location, emit, resolve, reject });
      void this.process();
    });
  }

  private async process(): Promise<void> {
    if (this.running >= this.maxConcurrent || this.queue.length === 0) return;

    const job = this.queue.shift()!;
    this.running++;

    try {
      await runScraperJob(job.searchId, job.query, job.location, job.emit);
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
  const emit: ScrapeEmitter = (event) => broadcast(searchId, event);

  searchQueue.add(searchId, query, location, emit).catch((err) => {
    logger.error("Search queue error", {
      searchId,
      error: err.message,
    });
    markSearchFailed(searchId, err.message).catch(() => undefined);
  });
}

export function getQueuePosition(searchId: string): number | null {
  return searchQueue.getQueuePosition(searchId);
}
