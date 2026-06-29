export const SEARCH_QUEUE_NAME = "leadthur-search-queue";

export interface SearchQueueJobData {
  searchId: string;
  query: string;
  location: string;
  licenseKey?: string;
  licenseEmail?: string;
  isTrial?: boolean;
}

export interface SearchQueueStatus {
  running: number;
  queued: number;
  maxConcurrent: number;
  mode: "bullmq" | "inline";
}

export interface AdminQueueMetrics {
  active: number;
  waiting: number;
  failedLast24h: number;
  mode: "bullmq" | "inline";
}
