import type { BusinessLead, SearchJob, SearchResponse, SearchResultsResponse } from "@leadthur/shared";
import type { Lead } from "@/types/lead";
import { businessLeadToLead } from "@/types/lead";
import { getApiUrl } from "@/utils/env";

export interface HealthStatus {
  ok: boolean;
  message?: string;
}

export function getLicenseHeaders(): HeadersInit {
  const email =
    typeof window !== "undefined" ? localStorage.getItem("leadthur_email") || "" : "";
  const key =
    typeof window !== "undefined" ? localStorage.getItem("leadthur_key") || "" : "";
  return {
    "Content-Type": "application/json",
    "x-license-key": key,
    "x-license-email": email,
  };
}

export function getLicenseQueryString(): string {
  if (typeof window === "undefined") return "";
  const email = localStorage.getItem("leadthur_email")?.trim();
  const key = localStorage.getItem("leadthur_key")?.trim();
  if (!email || !key) return "";
  const params = new URLSearchParams({
    licenseEmail: email,
    licenseKey: key,
  });
  return `?${params.toString()}`;
}

export class SearchLimitError extends Error {
  creditsRemaining: number;

  constructor(message: string, creditsRemaining: number) {
    super(message);
    this.name = "SearchLimitError";
    this.creditsRemaining = creditsRemaining;
  }
}

export interface LicenseUsage {
  monthly_search_limit: number;
  searches_used: number;
  search_credits: number;
  freeSearchesRemaining: number;
  creditSearchesRemaining: number;
}

export async function getLicenseUsage(): Promise<LicenseUsage | null> {
  try {
    const res = await fetch(`${getApiUrl()}/auth/usage`, {
      headers: getLicenseHeaders(),
      cache: "no-store",
    });
    if (!res.ok) return null;
    return (await res.json()) as LicenseUsage;
  } catch {
    return null;
  }
}

export async function checkHealth(): Promise<HealthStatus> {
  try {
    const res = await fetch(`${getApiUrl()}/health`, {
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) {
      return { ok: false, message: `Backend returned ${res.status}` };
    }
    const text = (await res.text()).trim();
    if (text === "OK") return { ok: true };
    try {
      const data = JSON.parse(text) as { status?: string };
      if (data.status === "ok") return { ok: true };
    } catch {
      /* not JSON */
    }
    if (text.toLowerCase().includes("next.js")) {
      return {
        ok: false,
        message: "Backend URL is serving Next.js — check Coolify Dockerfile Path (backend/Dockerfile)",
      };
    }
    return { ok: false, message: text || "Unexpected health response" };
  } catch (err) {
    const message =
      err instanceof Error && err.name === "TimeoutError"
        ? "Backend health check timed out"
        : "Backend unreachable. Verify NEXT_PUBLIC_API_URL.";
    return { ok: false, message };
  }
}

export async function checkBackendReady(): Promise<HealthStatus> {
  try {
    const res = await fetch(`${getApiUrl()}/health/ready`, {
      cache: "no-store",
      signal: AbortSignal.timeout(30000),
    });
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { status?: string };
      return {
        ok: false,
        message: `Scraper not ready (${data.status ?? res.status})`,
      };
    }
    return { ok: true };
  } catch {
    return { ok: false, message: "Scraper readiness check failed" };
  }
}

async function parseJson<T>(res: Response): Promise<T> {
  const data = await res.json();
  if (!res.ok) {
    const err = data as { error?: string };
    throw new Error(err.error ?? `Request failed (${res.status})`);
  }
  return data as T;
}

export async function startSearch(
  query: string,
  location: string
): Promise<SearchResponse> {
  const apiUrl = getApiUrl();

  if (!apiUrl) {
    throw new Error(
      "API URL not configured. Check NEXT_PUBLIC_API_URL environment variable."
    );
  }

  const url = `${apiUrl}/search`;
  const apiHost = (() => {
    try {
      return new URL(apiUrl).host;
    } catch {
      return apiUrl;
    }
  })();

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: getLicenseHeaders(),
      body: JSON.stringify({ query, location }),
      signal: AbortSignal.timeout(30_000),
    });
  } catch (err) {
    if (err instanceof Error && err.name === "TimeoutError") {
      throw new Error(
        `Search server (${apiHost}) timed out. The backend may be busy or restarting — wait 30 seconds and try again.`
      );
    }
    throw new Error(
      `Cannot reach search server (${apiHost}). The backend may be restarting, or NEXT_PUBLIC_API_URL may be wrong on Vercel. Open DevTools → Network and check the failed /search request.`
    );
  }

  if (res.status === 401) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    if (typeof window !== "undefined") {
      localStorage.removeItem("leadthur_email");
      localStorage.removeItem("leadthur_key");
      window.location.href = "/activate";
    }
    throw new Error(data.error || "Invalid license");
  }

  if (res.status === 403) {
    const data = (await res.json().catch(() => ({}))) as {
      error?: string;
      code?: string;
    };
    if (data.code === "SUSPENDED" && typeof window !== "undefined") {
      localStorage.setItem(
        "lp_suspended_reason",
        data.error ||
          "Your account has been suspended. Contact support on WhatsApp 09067285890."
      );
      localStorage.removeItem("leadthur_email");
      localStorage.removeItem("leadthur_key");
      window.location.href = "/suspended";
      return data as never;
    }
    throw new Error(data.error || "Request forbidden");
  }

  if (res.status === 402) {
    const data = (await res.json().catch(() => ({}))) as {
      error?: string;
      message?: string;
      creditsRemaining?: number;
    };
    if (data.error === "search_limit_reached") {
      throw new SearchLimitError(
        data.message || "You have used all your searches for this month.",
        data.creditsRemaining ?? 0
      );
    }
    throw new Error(data.message || data.error || "Search limit reached");
  }

  if (res.status === 429) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error || "Monthly search limit reached");
  }

  if (res.status === 503) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error || "Server is busy. Please try again shortly.");
  }

  if (!res.ok) {
    const data = (await res.json().catch(() => ({ error: "Unknown error" }))) as {
      error?: string;
    };
    throw new Error(data.error || "Failed to start search");
  }

  const data = (await res.json()) as SearchResponse;
  return data;
}

export async function testBackendConnection(): Promise<string> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL?.trim()?.replace(/\/$/, "") ?? "";
  if (!apiUrl) {
    return "Failed: NEXT_PUBLIC_API_URL is not set";
  }
  try {
    const res = await fetch(`${apiUrl}/health`, { cache: "no-store" });
    const text = await res.text();
    return `Connected (${res.status}): ${text.slice(0, 200)}`;
  } catch (err) {
    return `Failed: ${err instanceof Error ? err.message : "Unknown error"}`;
  }
}

export async function getSearch(id: string): Promise<SearchJob> {
  const res = await fetch(`${getApiUrl()}/search/${id}`, {
    headers: getLicenseHeaders(),
    cache: "no-store",
  });
  return parseJson<SearchJob>(res);
}

export async function probeSearchAccess(
  searchId: string
): Promise<"ok" | "auth" | "unknown"> {
  try {
    const res = await fetch(`${getApiUrl()}/search/${searchId}`, {
      headers: getLicenseHeaders(),
      cache: "no-store",
    });
    if (res.status === 401 || res.status === 403) return "auth";
    if (res.ok) return "ok";
    return "unknown";
  } catch {
    return "unknown";
  }
}

export async function getSearchSuggestions(
  query: string,
  location: string,
  totalFound: number,
  excludeLocations?: string[]
): Promise<{
  suggestions: Array<{ query: string; location: string; label: string }>;
  message: string;
  totalAreas?: number;
  source?: string;
}> {
  try {
    const params = new URLSearchParams({
      query,
      location,
      totalFound: totalFound.toString(),
    });
    if (excludeLocations && excludeLocations.length > 0) {
      params.set("exclude", excludeLocations.join("|"));
    }

    const res = await fetch(`${getApiUrl()}/search/suggestions?${params}`, {
      headers: getLicenseHeaders(),
      cache: "no-store",
    });

    if (!res.ok) return { suggestions: [], message: "" };
    return res.json() as Promise<{
      suggestions: Array<{ query: string; location: string; label: string }>;
      message: string;
      totalAreas?: number;
      source?: string;
    }>;
  } catch {
    return { suggestions: [], message: "" };
  }
}

export async function getRecentActivity(): Promise<{
  activity: Array<{
    query: string;
    location: string;
    total_found: number;
    created_at: string;
  }>;
}> {
  try {
    const res = await fetch(`${getApiUrl()}/search/activity`, { cache: "no-store" });
    if (!res.ok) return { activity: [] };
    return res.json() as Promise<{
      activity: Array<{
        query: string;
        location: string;
        total_found: number;
        created_at: string;
      }>;
    }>;
  } catch {
    return { activity: [] };
  }
}

export async function getTotalDiscovered(): Promise<{ total: number }> {
  try {
    const res = await fetch(`${getApiUrl()}/search/stats/total`, { cache: "no-store" });
    if (!res.ok) return { total: 0 };
    return res.json() as Promise<{ total: number }>;
  } catch {
    return { total: 0 };
  }
}

export async function getSearchHistory(): Promise<{
  history: Array<{
    id: string;
    query: string;
    location: string;
    total_found: number;
    created_at: string;
    search_id: string | null;
  }>;
}> {
  const res = await fetch(`${getApiUrl()}/search/history`, {
    headers: getLicenseHeaders(),
    cache: "no-store",
  });
  if (!res.ok) return { history: [] };
  return res.json() as Promise<{
    history: Array<{
      id: string;
      query: string;
      location: string;
      total_found: number;
      created_at: string;
      search_id: string | null;
    }>;
  }>;
}

export type RecentSearchHistoryItem = {
  id: string;
  business_type: string;
  city: string;
  country: string | null;
  results_count: number;
  created_at: string;
};

export async function fetchRecentSearchHistory(): Promise<{
  history: RecentSearchHistoryItem[];
}> {
  try {
    const res = await fetch(`${getApiUrl()}/search-history`, {
      headers: getLicenseHeaders(),
      cache: "no-store",
    });
    if (!res.ok) return { history: [] };
    return res.json() as Promise<{ history: RecentSearchHistoryItem[] }>;
  } catch {
    return { history: [] };
  }
}

export async function saveSearchHistory(input: {
  email: string;
  business_type: string;
  city: string;
  country?: string;
  results_count: number;
}): Promise<boolean> {
  try {
    const res = await fetch(`${getApiUrl()}/search-history`, {
      method: "POST",
      headers: getLicenseHeaders(),
      body: JSON.stringify({
        ...input,
        email: input.email.toLowerCase().trim(),
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export type LeadStatusRecord = {
  id: string;
  email: string;
  business_name: string;
  business_phone: string | null;
  business_address: string | null;
  search_id: string | null;
  status: "new" | "contacted" | "interested" | "closed" | "not_interested";
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export async function fetchLeadStatuses(status?: string): Promise<{
  statuses: LeadStatusRecord[];
}> {
  try {
    const params = status ? `?status=${encodeURIComponent(status)}` : "";
    const res = await fetch(`${getApiUrl()}/lead-status${params}`, {
      headers: getLicenseHeaders(),
      cache: "no-store",
    });
    if (!res.ok) return { statuses: [] };
    return res.json() as Promise<{ statuses: LeadStatusRecord[] }>;
  } catch {
    return { statuses: [] };
  }
}

export async function saveLeadStatus(input: {
  email: string;
  business_name: string;
  business_phone?: string | null;
  business_address?: string | null;
  search_id?: string | null;
  status: LeadStatusRecord["status"];
  notes?: string | null;
}): Promise<LeadStatusRecord | null> {
  try {
    const res = await fetch(`${getApiUrl()}/lead-status`, {
      method: "POST",
      headers: getLicenseHeaders(),
      body: JSON.stringify(input),
    });
    if (!res.ok) return null;
    return res.json() as Promise<LeadStatusRecord>;
  } catch {
    return null;
  }
}

export type WhatsappTemplate = {
  id: string;
  niche: string;
  title: string;
  message: string;
  created_at: string;
};

export async function fetchWhatsappTemplates(): Promise<{
  templates: Record<string, WhatsappTemplate[]>;
  ok: boolean;
}> {
  try {
    const apiUrl = getApiUrl();
    if (!apiUrl) return { templates: {}, ok: false };

    const res = await fetch(`${apiUrl}/whatsapp-templates`, {
      cache: "no-store",
    });
    if (!res.ok) return { templates: {}, ok: false };
    const data = (await res.json()) as { templates?: Record<string, WhatsappTemplate[]> };
    return { templates: data.templates ?? {}, ok: true };
  } catch {
    return { templates: {}, ok: false };
  }
}

export type GenerateAiMessageInput = {
  email: string;
  business_name: string;
  city: string;
  niche: string;
  rating: number | null;
  has_website: boolean;
  has_email: boolean;
};

export type GenerateAiMessageResult =
  | { ok: true; message: string; balance: number }
  | { ok: false; status: number; message: string; balance?: number; code?: string };

export async function claimAiBonus(): Promise<{
  applied: boolean;
  search_credits: number;
} | null> {
  try {
    const res = await fetch(`${getApiUrl()}/ai-message/claim-bonus`, {
      method: "POST",
      headers: getLicenseHeaders(),
    });
    if (!res.ok) return null;
    return res.json() as Promise<{ applied: boolean; search_credits: number }>;
  } catch {
    return null;
  }
}

export async function generateAiMessage(
  input: GenerateAiMessageInput
): Promise<GenerateAiMessageResult> {
  try {
    const apiUrl = getApiUrl();
    if (!apiUrl) {
      return {
        ok: false,
        status: 0,
        message: "Generation failed, credits refunded",
      };
    }

    const res = await fetch(`${apiUrl}/ai-message/generate`, {
      method: "POST",
      headers: getLicenseHeaders(),
      body: JSON.stringify(input),
      signal: AbortSignal.timeout(45_000),
    });

    let data: {
      message?: string;
      balance?: number;
      error?: string;
      code?: string;
    } = {};

    try {
      data = (await res.json()) as typeof data;
    } catch {
      return {
        ok: false,
        status: res.status,
        message: "Generation failed, credits refunded",
      };
    }

    if (res.status === 402) {
      return {
        ok: false,
        status: 402,
        message: data.message ?? data.error ?? "Insufficient credits",
        balance: data.balance,
      };
    }

    if (!res.ok) {
      return {
        ok: false,
        status: res.status,
        message: data.message ?? data.error ?? "Generation failed, credits refunded",
        balance: data.balance,
        code: data.code,
      };
    }

    return {
      ok: true,
      message: data.message ?? "",
      balance: data.balance ?? 0,
    };
  } catch (err) {
    const isTimeout =
      err instanceof Error &&
      (err.name === "TimeoutError" || err.name === "AbortError");
    return {
      ok: false,
      status: 0,
      message: isTimeout
        ? "Generation timed out. Please try again."
        : "Could not reach the server. Check your connection and try again.",
    };
  }
}

export async function pollSearchResults(
  id: string,
  page = 1,
  limit = 1000
): Promise<SearchResultsResponse> {
  const res = await fetch(
    `${getApiUrl()}/search/results/${id}?page=${page}&limit=${limit}`,
    { headers: getLicenseHeaders(), cache: "no-store" }
  );
  if (!res.ok) {
    throw new Error(`Failed to poll results (${res.status})`);
  }
  return (await res.json()) as SearchResultsResponse;
}

export async function getResults(
  id: string,
  page = 1,
  limit = 200
): Promise<{ leads: Lead[]; total: number }> {
  const res = await fetch(
    `${getApiUrl()}/search/${id}/results?page=${page}&limit=${limit}`,
    { headers: getLicenseHeaders(), cache: "no-store" }
  );
  const data = await parseJson<{
    leads: BusinessLead[];
    total: number;
  }>(res);
  return {
    leads: data.leads.map(businessLeadToLead),
    total: data.total,
  };
}

export interface StreamCallbacks {
  onLead: (lead: Lead) => void;
  onProgress: (count: number, max?: number) => void;
  onComplete: (total: number) => void;
  onError: (message: string) => void;
  onPhase?: (phase: string) => void;
  onStarted?: () => void;
  onReconnecting?: (attempt: number) => void;
}

const MAX_RECONNECT_ATTEMPTS = 3;
const RECONNECT_DELAY_MS = 3000;

export function streamResults(
  searchId: string,
  callbacks: StreamCallbacks
): () => void {
  let completed = false;
  let reconnectAttempts = 0;
  let es: EventSource | null = null;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  const cleanup = () => {
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
    if (es) {
      es.close();
      es = null;
    }
  };

  const handleMessage = (event: MessageEvent) => {
    try {
      const payload = JSON.parse(event.data) as {
        type: string;
        lead?: BusinessLead;
        data?: BusinessLead;
        count?: number;
        max?: number;
        processed?: number;
        total?: number;
        message?: string;
        phase?: string;
        searchId?: string;
      };

      if (payload.type === "started") {
        callbacks.onStarted?.();
        callbacks.onPhase?.("Search started — finding businesses…");
      }
      if (payload.type === "phase" && payload.phase) {
        callbacks.onPhase?.(payload.phase);
      }
      if (payload.type === "progress") {
        const count = payload.processed ?? payload.count ?? 0;
        const max = payload.max ?? count;
        callbacks.onProgress(count, max);
      }
      if (payload.type === "lead") {
        const raw = payload.lead ?? payload.data;
        if (raw) callbacks.onLead(businessLeadToLead(raw));
      }
      if (payload.type === "complete" && payload.total != null) {
        completed = true;
        callbacks.onComplete(payload.total);
        cleanup();
      }
      if (payload.type === "error") {
        completed = true;
        callbacks.onError(payload.message ?? "Search failed");
        cleanup();
      }
    } catch {
      if (!completed) {
        completed = true;
        callbacks.onError("Invalid stream data");
        cleanup();
      }
    }
  };

  const connect = () => {
    cleanup();
    es = new EventSource(`${getApiUrl()}/search/${searchId}/stream${getLicenseQueryString()}`);
    es.onmessage = handleMessage;
    es.onerror = () => {
      if (completed) {
        cleanup();
        return;
      }
      cleanup();
      reconnectAttempts++;
      if (reconnectAttempts <= MAX_RECONNECT_ATTEMPTS) {
        callbacks.onReconnecting?.(reconnectAttempts);
        reconnectTimer = setTimeout(connect, RECONNECT_DELAY_MS);
      } else {
        completed = true;
        callbacks.onError("Connection lost. Please try your search again.");
      }
    };
  };

  connect();

  return () => {
    completed = true;
    cleanup();
  };
}

export { exportCSV, exportToCSV } from "@/features/export/csv-export";
