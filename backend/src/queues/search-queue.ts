import { getEnv } from "../config/env";
import { logger } from "../utils/logger";
import { runScraperJob, type ScrapeEmitter } from "../services/scraper-service";

interface QueueJob {
  searchId: string;
  query: string;
  location: string;
  emit: ScrapeEmitter;
  retries: number;
}

const queue: QueueJob[] = [];
let active = 0;
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

export function enqueueSearch(
  searchId: string,
  query: string,
  location: string
): void {
  const emit: ScrapeEmitter = (event) => broadcast(searchId, event);
  queue.push({ searchId, query, location, emit, retries: 0 });
  void drainQueue();
}

async function drainQueue(): Promise<void> {
  const maxConcurrency = getEnv().SCRAPER_CONCURRENCY;
  while (queue.length > 0 && active < maxConcurrency) {
    const job = queue.shift();
    if (!job) break;
    active++;
    void processJob(job).finally(() => {
      active--;
      void drainQueue();
    });
  }
}

async function processJob(job: QueueJob): Promise<void> {
  try {
    await runScraperJob(job.searchId, job.query, job.location, job.emit);
  } catch (err) {
    if (job.retries < 2) {
      const delay = Math.pow(2, job.retries) * 1000;
      logger.warn("Retrying search job", { searchId: job.searchId, retry: job.retries + 1 });
      await new Promise((r) => setTimeout(r, delay));
      queue.push({ ...job, retries: job.retries + 1 });
      void drainQueue();
      return;
    }
    logger.error("Search job failed after retries", {
      searchId: job.searchId,
      error: err instanceof Error ? err.message : "unknown",
    });
  }
}
