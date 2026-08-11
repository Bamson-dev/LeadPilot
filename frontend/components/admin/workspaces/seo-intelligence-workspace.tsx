"use client";

import { useCallback, useEffect, useState } from "react";
import { AdminWorkspaceHeader } from "@/components/admin/admin-workspace-header";
import { getAdminToken } from "@/services/admin-api";

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ||
  "https://backend.leadthur.com";

type StatusPayload = {
  settings: {
    seoOptimizationEnabled: boolean;
    maxOptimizationsPerDay: number;
    cooldownDays: number;
    firstRunCompleted: boolean;
    lastAnalysisAt?: string | null;
    lastOptimizationAt?: string | null;
    lastSchedulerRunAt?: string | null;
    lastSchedulerResult?: string | null;
    lastSchedulerError?: string | null;
  };
  overview: {
    totalOpportunities: number;
    highPriorityOpportunities: number;
    monitoring: number;
    improved: number;
  };
};

type Opportunity = {
  id: string;
  page_url: string;
  opportunity_type: string;
  status: string;
  opportunity_score: number;
  score_reasons: string[];
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
  recommended_action?: string | null;
};

type Job = {
  id: string;
  page_url: string;
  status: string;
  quality_score_before?: number | null;
  quality_score_after?: number | null;
  published_at?: string | null;
  error_message?: string | null;
};

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getAdminToken();
  const res = await fetch(`${API_BASE}/admin/seo-intelligence${path}`, {
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

export function SeoIntelligenceWorkspace() {
  const [status, setStatus] = useState<StatusPayload | null>(null);
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setError(null);
    const [st, opps, opts] = await Promise.all([
      api<StatusPayload>("/status"),
      api<{ opportunities: Opportunity[] }>("/opportunities"),
      api<{ optimizations: Job[] }>("/optimizations"),
    ]);
    setStatus(st);
    setOpportunities(opps.opportunities || []);
    setJobs(opts.optimizations || []);
  }, []);

  useEffect(() => {
    void refresh().catch((err) =>
      setError(err instanceof Error ? err.message : "Failed to load")
    );
  }, [refresh]);

  async function run(label: string, fn: () => Promise<void>) {
    setBusy(label);
    setError(null);
    setMessage(null);
    try {
      await fn();
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-6">
      <AdminWorkspaceHeader
        title="SEO Intelligence"
        description="Search Console evidence → opportunities → safe content optimization. Not a ranking guarantee."
      />

      {error && (
        <p className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {error}
        </p>
      )}
      {message && (
        <p className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">
          {message}
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ["Opportunities", status?.overview.totalOpportunities ?? "—"],
          ["High priority", status?.overview.highPriorityOpportunities ?? "—"],
          ["Monitoring", status?.overview.monitoring ?? "—"],
          ["Improved", status?.overview.improved ?? "—"],
        ].map(([label, value]) => (
          <div
            key={label}
            className="rounded-lg border border-[var(--lt-border)] bg-[var(--lt-surface)] p-4"
          >
            <p className="text-xs text-[var(--lt-text-muted)]">{label}</p>
            <p className="mt-1 text-2xl font-semibold text-[var(--lt-text)]">{value}</p>
          </div>
        ))}
      </div>

      <div className="rounded-lg border border-[var(--lt-border)] bg-[var(--lt-surface)] p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-sm text-[var(--lt-text)]">
            Optimization:{" "}
            <span className="font-medium">
              {status?.settings.seoOptimizationEnabled ? "Enabled" : "Paused"}
            </span>
            {" · "}max {status?.settings.maxOptimizationsPerDay ?? 2}/day
            {" · "}cooldown {status?.settings.cooldownDays ?? 28}d
          </p>
          <button
            className="rounded-md bg-[var(--lt-accent)] px-3 py-1.5 text-sm text-white disabled:opacity-50"
            disabled={!!busy}
            onClick={() =>
              void run("analyze", async () => {
                const r = await api<{ created: number }>("/analyze", { method: "POST" });
                setMessage(`Analysis complete. Opportunities upserted: ${r.created}`);
              })
            }
          >
            {busy === "analyze" ? "Analyzing…" : "Analyze now"}
          </button>
          <button
            className="rounded-md border border-[var(--lt-border)] px-3 py-1.5 text-sm text-[var(--lt-text)] disabled:opacity-50"
            disabled={!!busy}
            onClick={() =>
              void run("pause", async () => {
                await api("/pause", { method: "POST" });
                setMessage("SEO optimization paused. GSC + Content Automation unchanged.");
              })
            }
          >
            Pause
          </button>
          <button
            className="rounded-md border border-[var(--lt-border)] px-3 py-1.5 text-sm text-[var(--lt-text)] disabled:opacity-50"
            disabled={!!busy}
            onClick={() =>
              void run("resume", async () => {
                await api("/resume", { method: "POST" });
                setMessage("SEO optimization resumed.");
              })
            }
          >
            Resume
          </button>
        </div>
        <p className="text-xs text-[var(--lt-text-muted)]">
          Last analysis: {status?.settings.lastAnalysisAt || "—"} · Last scheduler:{" "}
          {status?.settings.lastSchedulerResult || "—"}
          {status?.settings.lastSchedulerError
            ? ` · Error: ${status.settings.lastSchedulerError}`
            : ""}
        </p>
      </div>

      <div className="rounded-lg border border-[var(--lt-border)] bg-[var(--lt-surface)] overflow-hidden">
        <div className="border-b border-[var(--lt-border)] px-4 py-3">
          <h2 className="text-sm font-semibold text-[var(--lt-text)]">Opportunities</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="text-left text-[var(--lt-text-muted)]">
              <tr>
                <th className="px-4 py-2">Article / URL</th>
                <th className="px-4 py-2">Type</th>
                <th className="px-4 py-2">Score</th>
                <th className="px-4 py-2">Clicks</th>
                <th className="px-4 py-2">Impr.</th>
                <th className="px-4 py-2">CTR</th>
                <th className="px-4 py-2">Pos.</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2">Action</th>
              </tr>
            </thead>
            <tbody>
              {opportunities.slice(0, 40).map((o) => (
                <tr key={o.id} className="border-t border-[var(--lt-border)]">
                  <td className="px-4 py-2 max-w-[240px] truncate">
                    <a
                      href={o.page_url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[var(--lt-cyan)] hover:underline"
                    >
                      {o.page_url.replace("https://www.leadthur.com", "")}
                    </a>
                    <div className="text-xs text-[var(--lt-text-muted)] truncate">
                      {(o.score_reasons || []).slice(0, 2).join(" · ")}
                    </div>
                  </td>
                  <td className="px-4 py-2">{o.opportunity_type}</td>
                  <td className="px-4 py-2">{Number(o.opportunity_score).toFixed(0)}</td>
                  <td className="px-4 py-2">{o.clicks}</td>
                  <td className="px-4 py-2">{o.impressions}</td>
                  <td className="px-4 py-2">{(Number(o.ctr) * 100).toFixed(2)}%</td>
                  <td className="px-4 py-2">{Number(o.position).toFixed(1)}</td>
                  <td className="px-4 py-2">{o.status}</td>
                  <td className="px-4 py-2">
                    {o.opportunity_type !== "rising_content" && o.status === "RECOMMENDED" ? (
                      <button
                        className="text-[var(--lt-cyan)] hover:underline disabled:opacity-50"
                        disabled={!!busy}
                        onClick={() =>
                          void run(`opt-${o.id}`, async () => {
                            const r = await api<{ ok: boolean; articleUrl?: string; error?: string }>(
                              `/optimize/${o.id}`,
                              { method: "POST" }
                            );
                            if (r.ok) setMessage(`Optimized: ${r.articleUrl}`);
                            else throw new Error(r.error || "optimize_failed");
                          })
                        }
                      >
                        Optimize
                      </button>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              ))}
              {!opportunities.length && (
                <tr>
                  <td className="px-4 py-6 text-[var(--lt-text-muted)]" colSpan={9}>
                    No opportunities yet. Click Analyze now.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-lg border border-[var(--lt-border)] bg-[var(--lt-surface)] overflow-hidden">
        <div className="border-b border-[var(--lt-border)] px-4 py-3">
          <h2 className="text-sm font-semibold text-[var(--lt-text)]">Optimizations</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="text-left text-[var(--lt-text-muted)]">
              <tr>
                <th className="px-4 py-2">URL</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2">Quality</th>
                <th className="px-4 py-2">Published</th>
                <th className="px-4 py-2">Error</th>
              </tr>
            </thead>
            <tbody>
              {jobs.slice(0, 30).map((j) => (
                <tr key={j.id} className="border-t border-[var(--lt-border)]">
                  <td className="px-4 py-2 max-w-[280px] truncate">{j.page_url}</td>
                  <td className="px-4 py-2">{j.status}</td>
                  <td className="px-4 py-2">
                    {j.quality_score_before ?? "—"} → {j.quality_score_after ?? "—"}
                  </td>
                  <td className="px-4 py-2">{j.published_at || "—"}</td>
                  <td className="px-4 py-2 text-[var(--lt-text-muted)]">{j.error_message || "—"}</td>
                </tr>
              ))}
              {!jobs.length && (
                <tr>
                  <td className="px-4 py-6 text-[var(--lt-text-muted)]" colSpan={5}>
                    No optimization jobs yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
