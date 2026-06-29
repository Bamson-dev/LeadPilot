"use client";

import type { SearchStatsSummary } from "@leadthur/shared";

interface ResultsSummaryBarProps {
  summary: SearchStatsSummary | null;
  totalFound: number;
}

export function ResultsSummaryBar({ summary, totalFound }: ResultsSummaryBarProps) {
  const total = summary?.total ?? totalFound;
  const withPhone = summary?.withPhone ?? 0;
  const withEmail = summary?.withEmail ?? 0;
  const withWebsite = summary?.withWebsite ?? 0;

  if (total === 0) return null;

  return (
    <div className="rounded-xl border border-violet-500/20 bg-violet-500/5 px-4 py-3 text-sm text-zinc-300">
      <span className="font-semibold text-white">{total.toLocaleString()}</span> businesses
      found,{" "}
      <span className="text-emerald-400">{withPhone.toLocaleString()}</span> have phone
      numbers,{" "}
      <span className="text-emerald-400">{withEmail.toLocaleString()}</span> have emails,{" "}
      <span className="text-emerald-400">{withWebsite.toLocaleString()}</span> have websites
    </div>
  );
}
