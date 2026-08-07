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
    <div className="rounded-xl border border-[var(--lt-border)] bg-[var(--lt-surface)] px-4 py-3 text-sm text-[var(--lt-text-muted)]">
      <span className="font-semibold text-[var(--lt-text)]">
        {stats.total.toLocaleString()}
      </span>{" "}
      potential clients found,{" "}
      <span className="text-[var(--lt-success)]">{stats.withPhone.toLocaleString()}</span> have
      phone numbers,{" "}
      <span className="text-[var(--lt-success)]">{stats.withEmail.toLocaleString()}</span> have
      emails,{" "}
      <span className="text-[var(--lt-success)]">{stats.withWebsite.toLocaleString()}</span> have
      websites
    </div>
  );
}
