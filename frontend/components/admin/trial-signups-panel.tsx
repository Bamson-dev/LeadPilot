"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { getTrialSignups, type TrialSignupRow } from "@/services/admin-api";
import {
  AdminConvertedBadge,
  AdminLoading,
  AdminPanel,
  adminErrorClass,
  adminMutedClass,
  adminTableClass,
  adminTableHeadRowClass,
  adminTableRowClass,
} from "@/components/admin/admin-ui";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";

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
    <AdminPanel
      title="Free Trial Signups"
      description={`${total} total signups`}
      action={
        <Button type="button" variant="outline" size="sm" onClick={() => void load()}>
          Refresh
        </Button>
      }
      className="mt-0"
    >
      <div className="mb-4 flex flex-wrap gap-3">
        <Input
          type="search"
          placeholder="Search by email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="min-w-[220px] flex-1"
        />
        <Button type="button" variant="outline" size="sm" onClick={() => setSortDesc((v) => !v)}>
          Sort by date {sortDesc ? "↓" : "↑"}
        </Button>
      </div>

      {loading ? (
        <AdminLoading label="Loading signups..." />
      ) : error ? (
        <p className={adminErrorClass}>{error}</p>
      ) : filtered.length === 0 ? (
        <EmptyState title="No signups found" />
      ) : (
        <div className="overflow-x-auto">
          <table className={adminTableClass}>
            <thead>
              <tr className={adminTableHeadRowClass}>
                <th className="px-3 py-2">Email</th>
                <th className="px-3 py-2">Signed Up</th>
                <th className="px-3 py-2">Searches Used</th>
                <th className="px-3 py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => (
                <tr key={row.email} className={adminTableRowClass}>
                  <td className="px-3 py-3 font-medium text-[var(--lt-text)]">{row.email}</td>
                  <td className="px-3 py-3 text-[var(--lt-text-muted)]">
                    {formatDate(row.signed_up_at)}
                  </td>
                  <td className="px-3 py-3 text-[var(--lt-text-muted)]">{row.searches_used}</td>
                  <td className="px-3 py-3">
                    <AdminConvertedBadge converted={row.converted} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AdminPanel>
  );
}
