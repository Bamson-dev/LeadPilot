import type { StreamEvent } from "@leadthur/shared";
import { getSearchJob, markSearchFailed } from "../database/search-repository";
import { logger } from "../utils/logger";
import { runScraperJob } from "../services/scraper-service";
import { clearStreamBuffer, emitToStream } from "../services/stream-registry";
import { SEARCH_JOB_TIMEOUT_MS } from "../scraper/utils/constants";

const INLINE_MAX_CONCURRENT = 2;
const JOB_TIMEOUT_MS = 5 * 60 * 1000;

import type { SearchQueueJobData } from "./search-queue-types";

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(() => reject(new Error(message)), ms);
    }),
  ]);
}

class InlineSearchQueue {
  private queue: Array<{
    data: SearchQueueJobData;
    resolve: () => void;
    reject: (err: Error) => void;
  }> = [];
  private running = 0;

  async add(data: SearchQueueJobData): Promise<void> {
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

    try {
      const jobRecord = await getSearchJob(job.data.searchId);
      const isTrial = job.data.isTrial ?? jobRecord?.isTrial ?? false;

      await withTimeout(
        runScraperJob(job.data.searchId, job.data.query, job.data.location, emit, {
          licenseKey: job.data.licenseKey,
          licenseEmail: job.data.licenseEmail,
          isTrial,
        }),
        Math.min(SEARCH_JOB_TIMEOUT_MS, JOB_TIMEOUT_MS),
        "Search timed out on the server. Try a broader location or a simpler business type."
      );
      job.resolve();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      emitToStream(job.data.searchId, { type: "error", message });
      markSearchFailed(job.data.searchId, message).catch(() => undefined);
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
