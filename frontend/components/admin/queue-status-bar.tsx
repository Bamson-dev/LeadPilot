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
      className="mb-6 flex flex-wrap items-center gap-4 rounded-xl border border-white/10 bg-[#111118] px-4 py-3 text-sm"
      style={{ fontFamily: "Inter, sans-serif" }}
    >
      <span className="text-[#A1A1B5] font-medium">Search queue</span>
      <span className="text-[#F0EEFF]">
        Active: <strong className="text-emerald-400">{metrics.active}</strong>
      </span>
      <span className="text-[#F0EEFF]">
        Waiting: <strong className="text-amber-300">{metrics.waiting}</strong>
      </span>
      <span className="text-[#F0EEFF]">
        Failed (24h): <strong className="text-red-400">{metrics.failedLast24h}</strong>
      </span>
      <span className="text-xs text-[#6B6B80]">({metrics.mode})</span>
    </div>
  );
}
