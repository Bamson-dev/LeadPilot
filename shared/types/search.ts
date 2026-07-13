import type { BusinessLead, NearbyCitySuggestion, SearchStatsSummary } from "./business";

export interface SearchJob {
  id: string;
  query: string;
  location: string;
  status: "pending" | "queued" | "running" | "completed" | "failed";
  totalFound: number;
  processed: number;
  isTrial?: boolean;
  scrapingInProgress?: boolean;
  emailScrapingComplete?: boolean;
  /**
   * True only when status is completed, Maps backfill is done, and Phase 2
   * email scraping has finished. Additive — does not replace the raw flags.
   */
  fullyComplete?: boolean;
  nearbyCities?: NearbyCitySuggestion[];
  statsSummary?: SearchStatsSummary | null;
  createdAt: string;
  updatedAt: string;
  error: string | null;
}

export interface SearchResultsResponse {
  searchId: string;
  status: string;
  leads: BusinessLead[];
  total: number;
  totalFound: number;
  scrapingInProgress: boolean;
  emailScrapingComplete: boolean;
  fullyComplete: boolean;
  queuePosition: number;
  summary: SearchStatsSummary;
  nearbyCities: NearbyCitySuggestion[];
  page?: number;
  limit?: number;
}

export interface SearchRequest {
  query: string;
  location: string;
}

export interface CitySelectionSuggestion {
  city: string;
  label: string;
}

export interface SearchResponse {
  searchId: string;
  status: string;
  cached?: boolean;
  totalFound?: number;
  scrapingInProgress?: boolean;
  emailScrapingComplete?: boolean;
  fullyComplete?: boolean;
  queuePosition?: number;
  searchesRemaining?: number | null;
  message?: string;
  requiresCitySelection?: boolean;
  citySuggestions?: CitySelectionSuggestion[];
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
  /** Present on complete events — false after Phase 1, true when fully done. */
  fullyComplete?: boolean;
  scrapingInProgress?: boolean;
  emailScrapingComplete?: boolean;
  status?: string;
}
