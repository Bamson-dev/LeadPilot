const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

import type { BusinessLead, SearchJob, SearchResponse } from "@leadpilot/shared";
import type { Lead } from "@/types/lead";
import { businessLeadToLead } from "@/types/lead";

export async function checkHealth(): Promise<{
  ok: boolean;
  playwright?: string;
  network?: string;
  message?: string;
}> {
  try {
    const res = await fetch(`${API_URL}/health`);
    return res.json();
  } catch {
    return { ok: false, message: "Backend unreachable" };
  }
}

export async function startSearch(
  query: string,
  location: string
): Promise<SearchResponse> {
  const res = await fetch(`${API_URL}/search`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, location }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Search failed");
  return data as SearchResponse;
}

export async function getSearch(id: string): Promise<SearchJob> {
  const res = await fetch(`${API_URL}/search/${id}`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Failed to fetch search");
  return data as SearchJob;
}

export async function getResults(
  id: string,
  page = 1,
  limit = 50
): Promise<{ leads: Lead[]; total: number }> {
  const res = await fetch(
    `${API_URL}/search/${id}/results?page=${page}&limit=${limit}`
  );
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Failed to fetch results");
  return {
    leads: (data.leads as BusinessLead[]).map(businessLeadToLead),
    total: data.total as number,
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
  const es = new EventSource(`${API_URL}/search/${searchId}/stream`);

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
        callbacks.onComplete(payload.total);
        es.close();
      }
      if (payload.type === "error") {
        callbacks.onError(payload.message ?? "Search failed");
        es.close();
      }
    } catch {
      callbacks.onError("Invalid stream data");
      es.close();
    }
  };

  es.onerror = () => {
    callbacks.onError("Connection lost during search");
    es.close();
  };

  return () => es.close();
}

export { exportCSV } from "@/features/export/csv-export";
