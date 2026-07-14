import type { StreamEvent } from "@leadthur/shared";
import { getSearchJob, countSearchLeads } from "../database/search-repository";
import { logger } from "../utils/logger";
import {
  recoverSearchJobEmailScraping,
  runScraperJob,
} from "../services/scraper-service";
import { notifySearchTerminalFailure } from "../services/search-failure-notify";
import { clearStreamBuffer, emitToStream } from "../services/stream-registry";
import { logSearchLifecycle } from "../utils/search-job-lifecycle";
import { SEARCH_JOB_TIMEOUT_MS, SEARCH_WORKER_CONCURRENCY } from "../scraper/utils/constants";
import { getBrowserPool } from "../scraper/browser/browser-pool";

import type { SearchQueueJobData } from "./search-queue-types";

async function runInlineScraperWithHardTimeout(
  ...args: Parameters<typeof runScraperJob>
): Promise<void> {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  try {
    await Promise.race([
      runScraperJob(...args),
      new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => {
          reject(
            new Error(
              `Search exceeded the ${Math.round(SEARCH_JOB_TIMEOUT_MS / 60_000)} minute limit. Please try again.`
            )
          );
        }, SEARCH_JOB_TIMEOUT_MS);
      }),
    ]);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes("exceeded the") && message.includes("minute limit")) {
      try {
        await getBrowserPool().resetAfterDeadlock();
      } catch (resetErr) {
        logger.error("[inline-queue] Browser pool reset after timeout failed", {
          error: resetErr instanceof Error ? resetErr.message : "unknown",
        });
      }
    }
    throw err;
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

class InlineSearchQueue {
  private queue: Array<{
    data: SearchQueueJobData;
    resolve: () => void;
    reject: (err: Error) => void;
  }> = [];
  private running = 0;
  private runningSearchIds = new Set<string>();

  isTracked(searchId: string): boolean {
    if (this.runningSearchIds.has(searchId)) return true;
    return this.queue.some((job) => job.data.searchId === searchId);
  }

  async add(data: SearchQueueJobData): Promise<void> {
    logSearchLifecycle("job_enqueued", data.searchId, {
      queue: "inline",
      query: data.query,
      location: data.location,
    });
    return new Promise((resolve, reject) => {
      this.queue.push({ data, resolve, reject });
      void this.process();
    });
  }

  /** Queue a job without blocking the caller until scraping finishes. */
  schedule(data: SearchQueueJobData): void {
    logSearchLifecycle("job_enqueued", data.searchId, {
      queue: "inline",
      query: data.query,
      location: data.location,
    });
    this.queue.push({
      data,
      resolve: () => undefined,
      reject: (err) => {
        logger.error("[inline-queue] Scheduled search job failed", {
          searchId: data.searchId,
          error: err.message,
        });
      },
    });
    void this.process();
  }

  private async process(): Promise<void> {
    if (this.running >= SEARCH_WORKER_CONCURRENCY || this.queue.length === 0) return;

    const job = this.queue.shift()!;
    this.running++;
    this.runningSearchIds.add(job.data.searchId);

    const emit = (event: StreamEvent) => {
      emitToStream(job.data.searchId, event);
      if (event.type === "complete" || event.type === "error") {
        clearStreamBuffer(job.data.searchId);
      }
    };

    const jobStartedAt = Date.now();

    try {
      const jobRecord = await getSearchJob(job.data.searchId);
      const isTrial = job.data.isTrial ?? jobRecord?.isTrial ?? false;

      logSearchLifecycle("job_dequeued", job.data.searchId, {
        queue: "inline",
        running: this.running,
        waiting: this.queue.length,
      });
      logSearchLifecycle("job_processing_start", job.data.searchId, {
        queue: "inline",
        query: job.data.query,
        location: job.data.location,
      });

      await runInlineScraperWithHardTimeout(job.data.searchId, job.data.query, job.data.location, emit, {
        licenseKey: job.data.licenseKey,
        licenseEmail: job.data.licenseEmail,
        isTrial,
        jobStartedAt,
      });

      logSearchLifecycle("job_processing_end", job.data.searchId, {
        queue: "inline",
        elapsedMs: Date.now() - jobStartedAt,
      });
      job.resolve();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error("[inline-queue] Search job failed", {
        searchId: job.data.searchId,
        error: message,
      });

      const searchId = job.data.searchId;
      const existing = await getSearchJob(searchId).catch(() => null);
      const leadsCollected = await countSearchLeads(searchId).catch(() => 0);

      if (existing?.emailScrapingComplete || existing?.status === "completed") {
        job.resolve();
      } else if (existing?.status === "running" || existing?.scrapingInProgress) {
        logger.warn(
          "[inline-queue] Failure while scrape still active — leaving job running",
          { searchId, status: existing?.status, leadsCollected }
        );
        job.resolve();
      } else if (leadsCollected > 0 && !existing?.emailScrapingComplete) {
        try {
          await recoverSearchJobEmailScraping(
            searchId,
            job.data.query,
            job.data.location,
            emit,
            {
              licenseEmail: job.data.licenseEmail,
              jobStartedAt,
              licenseKey: job.data.licenseKey,
            }
          );
          job.resolve();
        } catch (recoverErr) {
          emitToStream(searchId, { type: "error", message });
          void notifySearchTerminalFailure({
            searchId,
            query: job.data.query,
            location: job.data.location,
            licenseEmail: job.data.licenseEmail,
            errorMessage: message,
            kind: "queue",
          });
          job.reject(recoverErr instanceof Error ? recoverErr : new Error(message));
        }
      } else {
        emitToStream(searchId, { type: "error", message });
        void notifySearchTerminalFailure({
          searchId,
          query: job.data.query,
          location: job.data.location,
          licenseEmail: job.data.licenseEmail,
          errorMessage: message,
          kind: "queue",
        });
        job.reject(err instanceof Error ? err : new Error(message));
      }
    } finally {
      this.runningSearchIds.delete(job.data.searchId);
      this.running--;
      void this.process();
    }
  }

  getStatus() {
    return {
      running: this.running,
      queued: this.queue.length,
      maxConcurrent: SEARCH_WORKER_CONCURRENCY,
      mode: "inline" as const,
    };
  }

  getQueuePosition(): number {
    return this.queue.length;
  }

  getQueuePositionForSearch(searchId: string): number | null {
    const idx = this.queue.findIndex((j) => j.data.searchId === searchId);
    return idx >= 0 ? idx + 1 : null;
  }

  async getAdminMetrics() {
    return {
      active: this.running,
      waiting: this.queue.length,
      failedLast24h: 0,
      mode: "inline" as const,
    };
  }
}

export const inlineSearchQueue = new InlineSearchQueue();
