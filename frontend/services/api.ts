import type { BusinessLead, SearchJob, SearchResponse } from "@leadpilot/shared";
import type { Lead } from "@/types/lead";
import { businessLeadToLead } from "@/types/lead";
import { getApiUrl } from "@/utils/env";

export interface HealthStatus {
  ok: boolean;
  message?: string;
}

function getLicenseHeaders(): HeadersInit {
  const email =
    typeof window !== "undefined" ? localStorage.getItem("leadpilot_email") || "" : "";
  const key =
    typeof window !== "undefined" ? localStorage.getItem("leadpilot_key") || "" : "";
  return {
    "Content-Type": "application/json",
    "x-license-key": key,
    "x-license-email": email,
  };
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
  const apiUrl = process.env.NEXT_PUBLIC_API_URL?.trim()?.replace(/\/$/, "") ?? "";
  const email =
    typeof window !== "undefined" ? localStorage.getItem("leadpilot_email") || "" : "";
  const key =
    typeof window !== "undefined" ? localStorage.getItem("leadpilot_key") || "" : "";

  if (!apiUrl) {
    throw new Error(
      "API URL not configured. Check NEXT_PUBLIC_API_URL environment variable."
    );
  }

  const url = `${apiUrl}/search`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-license-key": key,
      "x-license-email": email,
    },
    body: JSON.stringify({ query, location }),
  });

  if (res.status === 401) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    if (typeof window !== "undefined") {
      localStorage.removeItem("leadpilot_email");
      localStorage.removeItem("leadpilot_key");
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
      localStorage.removeItem("leadpilot_email");
      localStorage.removeItem("leadpilot_key");
      window.location.href = "/suspended";
      return data as never;
    }
    throw new Error(data.error || "Request forbidden");
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
  const res = await fetch(`${getApiUrl()}/search/${id}`, { cache: "no-store" });
  return parseJson<SearchJob>(res);
}

export async function getSearchSuggestions(
  query: string,
  location: string,
  totalFound: number
): Promise<{
  suggestions: Array<{ query: string; location: string; label: string }>;
  message: string;
  totalAreas?: number;
}> {
  try {
    const params = new URLSearchParams({
      query,
      location,
      totalFound: totalFound.toString(),
    });

    const res = await fetch(`${getApiUrl()}/search/suggestions?${params}`, {
      headers: getLicenseHeaders(),
      cache: "no-store",
    });

    if (!res.ok) return { suggestions: [], message: "" };
    return res.json() as Promise<{
      suggestions: Array<{ query: string; location: string; label: string }>;
      message: string;
      totalAreas?: number;
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
    es = new EventSource(`${getApiUrl()}/search/${searchId}/stream`);
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
