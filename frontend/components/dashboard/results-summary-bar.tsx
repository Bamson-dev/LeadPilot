"use client";

import type { Lead } from "@/types/lead";
import { computeLeadStats } from "@/utils/lead-stats";

interface ResultsSummaryBarProps {
  leads: Lead[];
}

export function ResultsSummaryBar({ leads }: ResultsSummaryBarProps) {
  const stats = computeLeadStats(leads);

  if (stats.total === 0) return null;

  return (
    <div className="rounded-xl border border-violet-500/20 bg-violet-500/5 px-4 py-3 text-sm text-zinc-300">
      <span className="font-semibold text-white">{stats.total.toLocaleString()}</span> potential
      clients found,{" "}
      <span className="text-emerald-400">{stats.withPhone.toLocaleString()}</span> have phone
      numbers,{" "}
      <span className="text-emerald-400">{stats.withEmail.toLocaleString()}</span> have emails,{" "}
      <span className="text-emerald-400">{stats.withWebsite.toLocaleString()}</span> have websites
    </div>
  );
}
