import type { BusinessLead, SearchJob, SearchResponse } from "@leadpilot/shared";
import type { Lead } from "@/types/lead";
import { businessLeadToLead } from "@/types/lead";
import { getApiUrl } from "@/utils/env";

export interface HealthStatus {
  ok: boolean;
  message?: string;
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
  const res = await fetch(`${getApiUrl()}/search`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, location }),
  });
  return parseJson<SearchResponse>(res);
}

export async function getSearch(id: string): Promise<SearchJob> {
  const res = await fetch(`${getApiUrl()}/search/${id}`, { cache: "no-store" });
  return parseJson<SearchJob>(res);
}

export async function getResults(
  id: string,
  page = 1,
  limit = 50
): Promise<{ leads: Lead[]; total: number }> {
  const res = await fetch(
    `${getApiUrl()}/search/${id}/results?page=${page}&limit=${limit}`,
    { cache: "no-store" }
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
  onProgress: (count: number, max: number) => void;
  onComplete: (total: number) => void;
  onError: (message: string) => void;
  onPhase?: (phase: string) => void;
}

export function streamResults(
  searchId: string,
  callbacks: StreamCallbacks
): () => void {
  const es = new EventSource(`${getApiUrl()}/search/${searchId}/stream`);
  let completed = false;

  es.onmessage = (event) => {
    try {
      const payload = JSON.parse(event.data) as {
        type: string;
        lead?: BusinessLead;
        count?: number;
        max?: number;
        total?: number;
        message?: string;
        phase?: string;
      };

      if (payload.type === "phase" && payload.phase) {
        callbacks.onPhase?.(payload.phase);
      }
      if (payload.type === "progress" && payload.count != null && payload.max) {
        callbacks.onProgress(payload.count, payload.max);
      }
      if (payload.type === "lead" && payload.lead) {
        callbacks.onLead(businessLeadToLead(payload.lead));
      }
      if (payload.type === "complete" && payload.total != null) {
        completed = true;
        callbacks.onComplete(payload.total);
        es.close();
      }
      if (payload.type === "error") {
        completed = true;
        callbacks.onError(payload.message ?? "Search failed");
        es.close();
      }
    } catch {
      if (!completed) {
        completed = true;
        callbacks.onError("Invalid stream data");
        es.close();
      }
    }
  };

  es.onerror = () => {
    if (!completed) {
      completed = true;
      callbacks.onError("Connection lost during search. Retry in a moment.");
      es.close();
    }
  };

  return () => {
    completed = true;
    es.close();
  };
}

export { exportCSV } from "@/features/export/csv-export";
