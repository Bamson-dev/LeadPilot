"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { getTrialSignups, type TrialSignupRow } from "@/services/admin-api";

function formatDate(value: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleString();
}

export function TrialSignupsPanel({
  onSessionExpired,
}: {
  onSessionExpired: () => void;
}) {
  const [signups, setSignups] = useState<TrialSignupRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [sortDesc, setSortDesc] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getTrialSignups();
      setSignups(data.signups);
      setTotal(data.total);
    } catch (err) {
      if (err instanceof Error && err.message === "SESSION_EXPIRED") {
        onSessionExpired();
        return;
      }
      setError(err instanceof Error ? err.message : "Failed to load signups");
    } finally {
      setLoading(false);
    }
  }, [onSessionExpired]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let rows = signups;
    if (q) {
      rows = rows.filter((row) => row.email.toLowerCase().includes(q));
    }
    rows = [...rows].sort((a, b) => {
      const at = new Date(a.signed_up_at).getTime();
      const bt = new Date(b.signed_up_at).getTime();
      return sortDesc ? bt - at : at - bt;
    });
    return rows;
  }, [signups, search, sortDesc]);

  return (
    <section className="glass mt-8 rounded-2xl p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-[#F4F4FF]">Free Trial Signups</h2>
          <p className="text-sm text-[#8888A8]">{total} total signups</p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-[#C0C0D8] hover:bg-white/5"
        >
          Refresh
        </button>
      </div>

      <div className="mb-4 flex flex-wrap gap-3">
        <input
          type="search"
          placeholder="Search by email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="min-w-[220px] flex-1 rounded-lg border border-white/10 bg-[#111118] px-3 py-2 text-sm text-[#F4F4FF] outline-none"
        />
        <button
          type="button"
          onClick={() => setSortDesc((v) => !v)}
          className="rounded-lg border border-white/10 px-3 py-2 text-xs text-[#C0C0D8] hover:bg-white/5"
        >
          Sort by date {sortDesc ? "↓" : "↑"}
        </button>
      </div>

      {loading ? (
        <p className="text-sm text-[#8888A8]">Loading signups...</p>
      ) : error ? (
        <p className="text-sm text-red-400">{error}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-white/10 text-left text-xs uppercase tracking-wide text-[#8888A8]">
                <th className="px-3 py-2">Email</th>
                <th className="px-3 py-2">Signed Up</th>
                <th className="px-3 py-2">Searches Used</th>
                <th className="px-3 py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => (
                <tr key={row.email} className="border-b border-white/5">
                  <td className="px-3 py-3 font-medium text-[#F4F4FF]">{row.email}</td>
                  <td className="px-3 py-3 text-[#C0C0D8]">{formatDate(row.signed_up_at)}</td>
                  <td className="px-3 py-3 text-[#C0C0D8]">{row.searches_used}</td>
                  <td className="px-3 py-3">
                    <span
                      className="inline-block rounded-full px-2.5 py-1 text-xs font-semibold"
                      style={{
                        background: row.converted
                          ? "rgba(16,185,129,0.15)"
                          : "rgba(124,58,237,0.15)",
                        color: row.converted ? "#10B981" : "#A78BFA",
                      }}
                    >
                      {row.converted ? "Converted" : "Active"}
                    </span>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-3 py-8 text-center text-[#8888A8]">
                    No signups found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
