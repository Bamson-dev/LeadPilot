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
    launch_batch_remaining?: number;
  };
  today: {
    target: number;
    generated: number;
    published: number;
    failed: number;
    remaining?: number;
  };
  publishing?: {
    intervalHours: number;
    lastPublication: string | null;
    nextPublication: string | null;
    nextScheduledJob?: { id: string; scheduledFor: string | null; title: string | null };
  };
  imageStorage?: {
    provider: string;
    path: string;
    imageCount: number;
    bytesUsed: number;
    healthy: boolean;
    supabaseFallbackAvailable: boolean;
  };
  automationHealth?: Record<string, unknown>;
  scheduler?: {
    status: string;
    process: string;
    frequency: string;
    publishingIntervalHours?: number;
    lastRun: string | null;
    lastResult: string | null;
    nextRun: string | null;
    dailyTarget: number;
    launchBatchRemaining: number;
    serverSide: boolean;
    requiresAdminOpen: boolean;
    requiresBrowser: boolean;
  };
  queue: {
    topicsWaiting: number;
    drafts: number;
    scheduled: number;
    published: number;
    failed: number;
  };
  seo?: { searchConsole: string; note: string };
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
    const id = setInterval(() => {
      void refresh().catch(() => undefined);
    }, 30_000);
    return () => clearInterval(id);
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
        description="Server-side scheduler publishes ~4 SEO-ready articles/day. Admin is for monitor/pause/resume only — work continues with Admin closed."
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
          label="Today published"
          value={`${status?.today.published ?? 0}/${status?.today.target ?? 4}`}
        />
        <Metric label="Remaining today" value={String(status?.today.remaining ?? "—")} />
        <Metric
          label="Publish interval"
          value={`${status?.publishing?.intervalHours ?? status?.scheduler?.publishingIntervalHours ?? 3}h`}
        />
      </div>

      <section className="rounded border border-neutral-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-500">
          Publishing schedule
        </h2>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 text-sm">
          <Metric
            label="Next publication"
            value={
              status?.publishing?.nextPublication
                ? new Date(status.publishing.nextPublication).toLocaleString()
                : "—"
            }
          />
          <Metric
            label="Last publication"
            value={
              status?.publishing?.lastPublication
                ? new Date(status.publishing.lastPublication).toLocaleString()
                : "—"
            }
          />
          <Metric
            label="Scheduled article"
            value={status?.publishing?.nextScheduledJob?.title?.slice(0, 40) || "—"}
          />
          <Metric label="Launch batch left" value={String(status?.scheduler?.launchBatchRemaining ?? status?.settings.launch_batch_remaining ?? 0)} />
        </div>
      </section>

      <section className="rounded border border-neutral-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-500">
          Scheduler (server-side)
        </h2>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 text-sm">
          <Metric label="Status" value={status?.scheduler?.status || "—"} />
          <Metric label="Last result" value={status?.scheduler?.lastResult || "—"} />
          <Metric label="Last run" value={status?.scheduler?.lastRun ? new Date(status.scheduler.lastRun).toLocaleString() : "—"} />
          <Metric label="Next run" value={status?.scheduler?.nextRun ? new Date(status.scheduler.nextRun).toLocaleString() : "—"} />
        </div>
        <p className="mt-3 text-xs text-neutral-500">
          Process: {status?.scheduler?.process || "production backend"} · Frequency:{" "}
          {status?.scheduler?.frequency || "hourly"} · Requires Admin open:{" "}
          {status?.scheduler?.requiresAdminOpen ? "YES" : "NO"} · Requires browser:{" "}
          {status?.scheduler?.requiresBrowser ? "YES" : "NO"}
        </p>
      </section>

      <div className="grid gap-4 md:grid-cols-4">
        <Metric label="Topics waiting" value={String(status?.queue.topicsWaiting ?? 0)} />
        <Metric label="Drafts" value={String(status?.queue.drafts ?? 0)} />
        <Metric label="Scheduled" value={String(status?.queue.scheduled ?? 0)} />
        <Metric label="Failed" value={String(status?.queue.failed ?? 0)} />
      </div>

      <section className="rounded border border-neutral-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-500">
          Image storage
        </h2>
        <div className="grid gap-2 sm:grid-cols-4 text-sm">
          <Metric label="Provider" value={status?.imageStorage?.provider || "—"} />
          <Metric label="Local images" value={String(status?.imageStorage?.imageCount ?? 0)} />
          <Metric
            label="Storage health"
            value={status?.imageStorage?.healthy ? "HEALTHY" : "DEGRADED"}
          />
          <Metric
            label="Supabase fallback"
            value={status?.imageStorage?.supabaseFallbackAvailable ? "Available" : "—"}
          />
        </div>
      </section>

      <section className="rounded border border-neutral-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-500">
          Automation health
        </h2>
        <pre className="max-h-48 overflow-auto rounded bg-neutral-50 p-3 text-xs text-neutral-700">
          {JSON.stringify(status?.automationHealth ?? {}, null, 2)}
        </pre>
      </section>

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

      <section className="rounded border border-neutral-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-500">
          SEO monitoring
        </h2>
        <p className="text-sm text-neutral-700">
          Search Console: <strong>{status?.seo?.searchConsole || "NOT CONNECTED"}</strong>
        </p>
        <p className="mt-1 text-xs text-neutral-500">{status?.seo?.note}</p>
        <p className="mt-2 text-xs text-neutral-500">
          Per-article editorial quality + SEO readiness scores are stored on each content job after generation.
        </p>
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
          {(status?.recent.jobs || []).map((job) => {
            const meta = (job.meta || {}) as Record<string, unknown>;
            const notes = (job.quality_notes || {}) as Record<string, unknown>;
            return (
              <div
                key={String(job.id)}
                className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-100 py-2 text-sm last:border-0"
              >
                <div>
                  <div className="font-medium">{String(job.status)}</div>
                  <div className="text-neutral-500">
                    quality {String(job.quality_score ?? "—")} · SEO{" "}
                    {String(meta.seoScore ?? notes.seoScore ?? "—")} ·{" "}
                    {String(job.id).slice(0, 8)}
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
            );
          })}
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
