import type { BusinessLead } from "./business";

export interface SearchJob {
  id: string;
  query: string;
  location: string;
  status: "pending" | "queued" | "running" | "completed" | "failed";
  totalFound: number;
  processed: number;
  createdAt: string;
  updatedAt: string;
  error: string | null;
}

export interface SearchRequest {
  query: string;
  location: string;
}

export interface SearchResponse {
  searchId: string;
  status: string;
  cached?: boolean;
  totalFound?: number;
  queuePosition?: number;
  searchesRemaining?: number | null;
  message?: string;
}

export type StreamEventType =
  | "started"
  | "lead"
  | "progress"
  | "complete"
  | "error"
  | "phase";

export interface StreamEvent {
  type: StreamEventType;
  searchId?: string;
  lead?: BusinessLead;
  data?: BusinessLead;
  count?: number;
  max?: number;
  processed?: number;
  total?: number;
  message?: string;
  phase?: string;
}
