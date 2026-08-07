"use client";

import { useEffect, useState } from "react";
import { getAdminQueueStatus, type AdminQueueStatus } from "@/services/admin-api";

export function AdminQueueStatusBar({ enabled }: { enabled: boolean }) {
  const [metrics, setMetrics] = useState<AdminQueueStatus | null>(null);

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;

    const load = async () => {
      try {
        const data = await getAdminQueueStatus();
        if (!cancelled) setMetrics(data);
      } catch {
        if (!cancelled) setMetrics(null);
      }
    };

    void load();
    const interval = setInterval(() => {
      void load();
    }, 30_000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [enabled]);

  if (!enabled || !metrics) return null;

  return (
    <div
      id="admin-queue-metrics"
      className="mb-6 flex flex-wrap items-center gap-4 rounded-xl border border-[var(--lt-border)] bg-[var(--lt-surface)] px-4 py-3 text-sm"
    >
      <span className="font-medium text-[var(--lt-text-muted)]">Search queue</span>
      <span className="text-[var(--lt-text)]">
        Active: <strong className="text-[var(--lt-success)]">{metrics.active}</strong>
      </span>
      <span className="text-[var(--lt-text)]">
        Waiting: <strong className="text-[var(--lt-warning)]">{metrics.waiting}</strong>
      </span>
      <span className="text-[var(--lt-text)]">
        Failed (24h): <strong className="text-[var(--lt-danger)]">{metrics.failedLast24h}</strong>
      </span>
      <span className="text-xs text-[var(--lt-text-subtle)]">({metrics.mode})</span>
    </div>
  );
}
