"use client";

import { useCallback, useEffect, useState } from "react";
import { AdminWorkspaceHeader } from "@/components/admin/admin-workspace-header";
import { getAdminToken } from "@/services/admin-api";

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ||
  "https://backend.leadthur.com";

type StatusPayload = {
  automation: string;
  settings: {
    daily_article_target: number;
    quality_threshold: number;
    automation_enabled: boolean;
    auto_publishing: boolean;
  };
  today: { target: number; generated: number; published: number; failed: number };
  queue: {
    topicsWaiting: number;
    drafts: number;
    scheduled: number;
    published: number;
    failed: number;
  };
  providers: Record<string, string>;
  recent: { jobs: Array<Record<string, unknown>>; failures: Array<Record<string, unknown>> };
};

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getAdminToken();
  const res = await fetch(`${API_BASE}/admin/content-automation${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(init?.headers || {}),
    },
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || `Request failed (${res.status})`);
  return json as T;
}

export function ContentAutomationWorkspace() {
  const [status, setStatus] = useState<StatusPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setError(null);
    const data = await api<StatusPayload>("/status");
    setStatus(data);
  }, []);

  useEffect(() => {
    void refresh().catch((err) =>
      setError(err instanceof Error ? err.message : "Failed to load")
    );
  }, [refresh]);

  async function run(label: string, fn: () => Promise<unknown>) {
    setBusy(label);
    setMessage(null);
    setError(null);
    try {
      const result = await fn();
      setMessage(`${label} completed`);
      await refresh();
      return result;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-6">
      <AdminWorkspaceHeader
        title="Content Automation"
        description="Discover topics, generate editorial articles, and publish through the existing LeadThur blog."
      />

      {error && (
        <div className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}
      {message && (
        <div className="rounded border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {message}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-4">
        <Metric label="Automation" value={status?.automation || "—"} />
        <Metric
          label="Today"
          value={`${status?.today.published ?? 0}/${status?.today.target ?? 4} published`}
        />
        <Metric label="Generated today" value={String(status?.today.generated ?? 0)} />
        <Metric label="Failed" value={String(status?.today.failed ?? 0)} />
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Metric label="Topics waiting" value={String(status?.queue.topicsWaiting ?? 0)} />
        <Metric label="Drafts" value={String(status?.queue.drafts ?? 0)} />
        <Metric label="Scheduled" value={String(status?.queue.scheduled ?? 0)} />
        <Metric label="Published jobs" value={String(status?.queue.published ?? 0)} />
      </div>

      <section className="rounded border border-neutral-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-500">
          Providers
        </h2>
        <div className="grid gap-2 sm:grid-cols-4">
          {Object.entries(status?.providers || {}).map(([name, state]) => (
            <div key={name} className="rounded bg-neutral-50 px-3 py-2 text-sm">
              <div className="font-medium capitalize">{name}</div>
              <div className="text-neutral-600">{state}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="flex flex-wrap gap-2">
        <Action
          label="Pause"
          disabled={!!busy}
          onClick={() => run("Pause", () => api("/pause", { method: "POST", body: "{}" }))}
        />
        <Action
          label="Resume"
          disabled={!!busy}
          onClick={() => run("Resume", () => api("/resume", { method: "POST", body: "{}" }))}
        />
        <Action
          label="Generate Topics"
          disabled={!!busy}
          onClick={() =>
            run("Generate Topics", () =>
              api("/discover-topics", { method: "POST", body: JSON.stringify({ limit: 6 }) })
            )
          }
        />
        <Action
          label="Generate Article Draft"
          disabled={!!busy}
          onClick={() =>
            run("Generate Article", () =>
              api("/generate-article", { method: "POST", body: "{}" })
            )
          }
        />
        <Action
          label="Run Scheduler Tick"
          disabled={!!busy}
          onClick={() => run("Tick", () => api("/tick", { method: "POST", body: "{}" }))}
        />
        <Action label="Refresh" disabled={!!busy} onClick={() => run("Refresh", refresh)} />
      </section>

      <section className="rounded border border-neutral-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-500">
          Recent jobs
        </h2>
        <div className="space-y-2">
          {(status?.recent.jobs || []).map((job) => (
            <div
              key={String(job.id)}
              className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-100 py-2 text-sm last:border-0"
            >
              <div>
                <div className="font-medium">{String(job.status)}</div>
                <div className="text-neutral-500">
                  score {String(job.quality_score ?? "—")} · {String(job.id).slice(0, 8)}
                </div>
              </div>
              <div className="flex gap-2">
                {(job.status === "READY" || job.status === "SCHEDULED") && (
                  <Action
                    label="Publish Now"
                    disabled={!!busy}
                    onClick={() =>
                      run("Publish", () =>
                        api(`/jobs/${job.id}/publish`, { method: "POST", body: "{}" })
                      )
                    }
                  />
                )}
                {(job.status === "FAILED" || job.status === "RETRYING") && (
                  <Action
                    label="Retry"
                    disabled={!!busy}
                    onClick={() =>
                      run("Retry", () =>
                        api(`/jobs/${job.id}/retry`, { method: "POST", body: "{}" })
                      )
                    }
                  />
                )}
              </div>
            </div>
          ))}
          {!status?.recent.jobs?.length && (
            <p className="text-sm text-neutral-500">No jobs yet.</p>
          )}
        </div>
      </section>

      {busy && <p className="text-sm text-neutral-500">Working: {busy}…</p>}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-neutral-200 bg-white px-4 py-3">
      <div className="text-xs uppercase tracking-wide text-neutral-500">{label}</div>
      <div className="mt-1 text-lg font-semibold text-neutral-900">{value}</div>
    </div>
  );
}

function Action({
  label,
  onClick,
  disabled,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="rounded bg-neutral-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
    >
      {label}
    </button>
  );
}
