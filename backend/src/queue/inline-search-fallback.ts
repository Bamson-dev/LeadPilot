import type { StreamEvent } from "@leadthur/shared";
import { getSearchJob, markSearchFailed } from "../database/search-repository";
import { logger } from "../utils/logger";
import {
  recoverSearchJobEmailScraping,
  runScraperJob,
} from "../services/scraper-service";
import { clearStreamBuffer, emitToStream } from "../services/stream-registry";
import { logSearchLifecycle } from "../utils/search-job-lifecycle";

const INLINE_MAX_CONCURRENT = 2;

import type { SearchQueueJobData } from "./search-queue-types";

class InlineSearchQueue {
  private queue: Array<{
    data: SearchQueueJobData;
    resolve: () => void;
    reject: (err: Error) => void;
  }> = [];
  private running = 0;

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

  private async process(): Promise<void> {
    if (this.running >= INLINE_MAX_CONCURRENT || this.queue.length === 0) return;

    const job = this.queue.shift()!;
    this.running++;

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

      await runScraperJob(job.data.searchId, job.data.query, job.data.location, emit, {
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

      try {
        await recoverSearchJobEmailScraping(
          job.data.searchId,
          job.data.query,
          job.data.location,
          emit,
          { licenseEmail: job.data.licenseEmail, jobStartedAt }
        );
        job.resolve();
      } catch (recoverErr) {
        emitToStream(job.data.searchId, { type: "error", message });
        markSearchFailed(job.data.searchId, message).catch(() => undefined);
        job.reject(recoverErr instanceof Error ? recoverErr : new Error(message));
      }
    } finally {
      this.running--;
      void this.process();
    }
  }

  getStatus() {
    return {
      running: this.running,
      queued: this.queue.length,
      maxConcurrent: INLINE_MAX_CONCURRENT,
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
