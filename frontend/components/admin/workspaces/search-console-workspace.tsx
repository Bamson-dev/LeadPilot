"use client";

import { useCallback, useEffect, useState } from "react";
import { AdminWorkspaceHeader } from "@/components/admin/admin-workspace-header";
import { getAdminToken } from "@/services/admin-api";

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ||
  "https://backend.leadthur.com";

type StatusPayload = {
  config: {
    configured: boolean;
    clientIdPresent: boolean;
    clientSecretPresent: boolean;
    redirectUriPresent: boolean;
    siteUrl: string;
    scope: string;
  };
  connection: {
    status: string;
    siteUrl: string;
    googleAccountEmail?: string | null;
    connectedAt?: string | null;
    lastSyncAt?: string | null;
    lastSuccessfulSyncAt?: string | null;
    nextSyncAt?: string | null;
    lastErrorAt?: string | null;
    lastErrorCode?: string | null;
    lastErrorMessage?: string | null;
    rowsCollected?: number;
  };
  syncHealth: string;
  indexing: { available: boolean; note: string };
};

type MetricRow = {
  page?: string;
  query?: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
};

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getAdminToken();
  const res = await fetch(
    `${API_BASE}/admin/integrations/google-search-console${path}`,
    {
      ...init,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        ...(init?.headers || {}),
      },
    }
  );
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || `Request failed (${res.status})`);
  return json as T;
}

function fmtPct(n: number): string {
  return `${(n * 100).toFixed(2)}%`;
}

function fmtPos(n: number): string {
  return n.toFixed(1);
}

export function SearchConsoleWorkspace() {
  const [status, setStatus] = useState<StatusPayload | null>(null);
  const [days, setDays] = useState(28);
  const [overview, setOverview] = useState<{
    clicks: number;
    impressions: number;
    ctr: number;
    position: number;
  } | null>(null);
  const [pages, setPages] = useState<MetricRow[]>([]);
  const [queries, setQueries] = useState<MetricRow[]>([]);
  const [trends, setTrends] = useState<
    Array<{ report_date: string; clicks: number; impressions: number; ctr: number; position: number }>
  >([]);
  const [pageSort, setPageSort] = useState<"clicks" | "impressions" | "ctr" | "position">(
    "clicks"
  );
  const [querySort, setQuerySort] = useState<"clicks" | "impressions" | "ctr" | "position">(
    "clicks"
  );
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setError(null);
    const [st, ov, pg, q, tr] = await Promise.all([
      api<StatusPayload>("/status"),
      api<{ overview: typeof overview }>(`/overview?days=${days}`),
      api<{ pages: MetricRow[] }>(`/pages?days=${days}&sortBy=${pageSort}`),
      api<{ queries: MetricRow[] }>(`/queries?days=${days}&sortBy=${querySort}`),
      api<{ trends: typeof trends }>(`/trends?days=${days}`),
    ]);
    setStatus(st);
    setOverview(ov.overview);
    setPages(pg.pages || []);
    setQueries(q.queries || []);
    setTrends(tr.trends || []);
  }, [days, pageSort, querySort]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("connected") === "1") {
      setMessage("Google Search Console connected. Initial sync started.");
    }
    if (params.get("error")) {
      setError(params.get("error"));
    }
    void refresh().catch((err) =>
      setError(err instanceof Error ? err.message : "Failed to load")
    );
  }, [refresh]);

  async function run(label: string, fn: () => Promise<unknown>) {
    setBusy(label);
    setMessage(null);
    setError(null);
    try {
      await fn();
      setMessage(`${label} completed`);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed");
    } finally {
      setBusy(null);
    }
  }

  const connected = status?.connection?.status === "connected";

  return (
    <div className="space-y-6">
      <AdminWorkspaceHeader
        title="Google Search Console"
        description="Read-only Search Console performance for leadthur.com. Sync runs automatically on the production backend."
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

      <section className="rounded border border-neutral-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-500">
          Connection
        </h2>
        <div className="grid gap-2 text-sm text-neutral-800 sm:grid-cols-2">
          <div>
            Status: <strong>{status?.connection?.status || "—"}</strong>
          </div>
          <div>
            Sync health: <strong>{status?.syncHealth || "—"}</strong>
          </div>
          <div>Property: {status?.connection?.siteUrl || status?.config?.siteUrl}</div>
          <div>Account: {status?.connection?.googleAccountEmail || "—"}</div>
          <div>Last sync: {status?.connection?.lastSyncAt || "—"}</div>
          <div>Last successful sync: {status?.connection?.lastSuccessfulSyncAt || "—"}</div>
          <div>Next scheduled sync: {status?.connection?.nextSyncAt || "—"}</div>
          <div>Rows collected: {status?.connection?.rowsCollected ?? 0}</div>
        </div>
        {status?.connection?.lastErrorMessage && (
          <p className="mt-3 text-sm text-amber-700">{status.connection.lastErrorMessage}</p>
        )}
        <p className="mt-3 text-xs text-neutral-500">{status?.indexing?.note}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          {!connected && (
            <button
              type="button"
              disabled={!!busy}
              className="rounded bg-neutral-900 px-3 py-2 text-sm text-white disabled:opacity-50"
              onClick={() =>
                run("Connect", async () => {
                  const data = await api<{ authorizeUrl: string }>("/connect");
                  window.location.href = data.authorizeUrl;
                })
              }
            >
              Connect Google Search Console
            </button>
          )}
          {connected && (
            <>
              <button
                type="button"
                disabled={!!busy}
                className="rounded bg-neutral-900 px-3 py-2 text-sm text-white disabled:opacity-50"
                onClick={() =>
                  run("Sync now", () => api("/sync", { method: "POST", body: "{}" }))
                }
              >
                {busy === "Sync now" ? "Syncing…" : "Sync now"}
              </button>
              <button
                type="button"
                disabled={!!busy}
                className="rounded border border-neutral-300 px-3 py-2 text-sm disabled:opacity-50"
                onClick={() =>
                  run("Disconnect", () =>
                    api("/disconnect", { method: "POST", body: "{}" })
                  )
                }
              >
                Disconnect
              </button>
            </>
          )}
        </div>
      </section>

      <section className="rounded border border-neutral-200 bg-white p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
            Performance
          </h2>
          <select
            className="rounded border border-neutral-300 px-2 py-1 text-sm"
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
          >
            <option value={7}>7 days</option>
            <option value={28}>28 days</option>
            <option value={90}>90 days</option>
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat label="Clicks" value={overview?.clicks ?? 0} />
          <Stat label="Impressions" value={overview?.impressions ?? 0} />
          <Stat label="Avg CTR" value={fmtPct(overview?.ctr ?? 0)} />
          <Stat label="Avg position" value={fmtPos(overview?.position ?? 0)} />
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="text-xs uppercase text-neutral-500">
              <tr>
                <th className="py-2 pr-3">Date</th>
                <th className="py-2 pr-3">Clicks</th>
                <th className="py-2 pr-3">Impressions</th>
                <th className="py-2 pr-3">CTR</th>
                <th className="py-2">Position</th>
              </tr>
            </thead>
            <tbody>
              {trends.map((row) => (
                <tr key={row.report_date} className="border-t border-neutral-100">
                  <td className="py-2 pr-3">{row.report_date}</td>
                  <td className="py-2 pr-3">{row.clicks}</td>
                  <td className="py-2 pr-3">{row.impressions}</td>
                  <td className="py-2 pr-3">{fmtPct(Number(row.ctr || 0))}</td>
                  <td className="py-2">{fmtPos(Number(row.position || 0))}</td>
                </tr>
              ))}
              {trends.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-4 text-neutral-500">
                    No trend data yet. Connect and sync to populate.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <MetricTable
        title="Top pages"
        sort={pageSort}
        onSortChange={setPageSort}
        rows={pages}
        labelKey="page"
        linkify
      />
      <MetricTable
        title="Top queries"
        sort={querySort}
        onSortChange={setQuerySort}
        rows={queries}
        labelKey="query"
      />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded border border-neutral-100 bg-neutral-50 px-3 py-3">
      <div className="text-xs uppercase tracking-wide text-neutral-500">{label}</div>
      <div className="mt-1 text-xl font-semibold text-neutral-900">{value}</div>
    </div>
  );
}

function MetricTable({
  title,
  rows,
  sort,
  onSortChange,
  labelKey,
  linkify,
}: {
  title: string;
  rows: MetricRow[];
  sort: "clicks" | "impressions" | "ctr" | "position";
  onSortChange: (s: "clicks" | "impressions" | "ctr" | "position") => void;
  labelKey: "page" | "query";
  linkify?: boolean;
}) {
  return (
    <section className="rounded border border-neutral-200 bg-white p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
          {title}
        </h2>
        <select
          className="rounded border border-neutral-300 px-2 py-1 text-sm"
          value={sort}
          onChange={(e) =>
            onSortChange(e.target.value as "clicks" | "impressions" | "ctr" | "position")
          }
        >
          <option value="clicks">Sort by clicks</option>
          <option value="impressions">Sort by impressions</option>
          <option value="ctr">Sort by CTR</option>
          <option value="position">Sort by position</option>
        </select>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="text-xs uppercase text-neutral-500">
            <tr>
              <th className="py-2 pr-3">{labelKey === "page" ? "Page" : "Query"}</th>
              <th className="py-2 pr-3">Clicks</th>
              <th className="py-2 pr-3">Impressions</th>
              <th className="py-2 pr-3">CTR</th>
              <th className="py-2">Position</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const label = String(row[labelKey] || "");
              return (
                <tr key={label} className="border-t border-neutral-100">
                  <td className="max-w-md truncate py-2 pr-3">
                    {linkify && label.startsWith("http") ? (
                      <a
                        href={label}
                        target="_blank"
                        rel="noreferrer"
                        className="text-blue-700 underline"
                      >
                        {label}
                      </a>
                    ) : (
                      label
                    )}
                  </td>
                  <td className="py-2 pr-3">{row.clicks}</td>
                  <td className="py-2 pr-3">{row.impressions}</td>
                  <td className="py-2 pr-3">{fmtPct(Number(row.ctr || 0))}</td>
                  <td className="py-2">{fmtPos(Number(row.position || 0))}</td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="py-4 text-neutral-500">
                  No data yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
