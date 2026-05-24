import type { BusinessLead } from "./business";

export interface SearchJob {
  id: string;
  query: string;
  location: string;
  status: "pending" | "queued" | "running" | "completed" | "failed";
  totalFound: number;
  processed: number;
  isTrial?: boolean;
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

export interface AreaSuggestion {
  query: string;
  location: string;
  label: string;
}

export type StreamEventType =
  | "started"
  | "lead"
  | "progress"
  | "complete"
  | "error"
  | "phase"
  | "email_update"
  | "suggestions";

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
  businessId?: string;
  email?: string | null;
  emails?: string[];
  emailSource?: "website" | "predicted";
  suggestions?: AreaSuggestion[] | string[];
}
