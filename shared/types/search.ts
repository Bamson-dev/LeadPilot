import type { BusinessLead } from "./business";

export interface SearchJob {
  id: string;
  query: string;
  location: string;
  status: "pending" | "running" | "completed" | "failed";
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
}

export type StreamEventType =
  | "lead"
  | "progress"
  | "complete"
  | "error"
  | "phase";

export interface StreamEvent {
  type: StreamEventType;
  lead?: BusinessLead;
  count?: number;
  max?: number;
  total?: number;
  message?: string;
  phase?: string;
}
