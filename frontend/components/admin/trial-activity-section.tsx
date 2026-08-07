"use client";

import type { TrialActivity, TrialStats } from "@/services/admin-api";
import {
  AdminSection,
  adminLabelClass,
  adminTableClass,
  adminTableHeadRowClass,
  adminTableRowClass,
  adminSectionBodyClass,
} from "@/components/admin/admin-ui";
import { Chip } from "@/components/ui/chip";
import { StatusBadge, type StatusBadgeStatus } from "@/components/ui/status-badge";
import { cn } from "@/utils/utils";

const STAT_CARDS: Array<{
  key: keyof Pick<
    TrialStats,
    | "totalTrials"
    | "trialsToday"
    | "trialsThisWeek"
    | "trialsThisMonth"
    | "licensesToday"
    | "conversionRate"
  >;
  label: string;
  colorClass: string;
}> = [
  { key: "totalTrials", label: "Total Trial Searches", colorClass: "text-[var(--lt-accent)]" },
  { key: "trialsToday", label: "Searches Today", colorClass: "text-[var(--lt-cyan)]" },
  { key: "trialsThisWeek", label: "This Week", colorClass: "text-[var(--lt-success)]" },
  { key: "trialsThisMonth", label: "This Month", colorClass: "text-[var(--lt-warning)]" },
  { key: "licensesToday", label: "New Licenses Today", colorClass: "text-[var(--lt-success)]" },
  { key: "conversionRate", label: "Est. Conversion Rate", colorClass: "text-[var(--lt-accent)]" },
];

export function TrialActivitySection({
  trialStats,
  trialActivity,
  trialSectionOpen,
  setTrialSectionOpen,
}: {
  trialStats: TrialStats;
  trialActivity: TrialActivity | null;
  trialSectionOpen: boolean;
  setTrialSectionOpen: (open: boolean) => void;
}) {
  const toggleOpen = () => setTrialSectionOpen(!trialSectionOpen);

  return (
    <AdminSection id="admin-trials" className="mb-6">
      <div
        role="button"
        tabIndex={0}
        className={cn(
          "flex cursor-pointer items-center justify-between gap-3 border-b border-[var(--lt-border)] px-4 py-3.5 sm:px-6",
          !trialSectionOpen && "border-b-0"
        )}
        onClick={toggleOpen}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            toggleOpen();
          }
        }}
      >
        <div>
          <h3 className="m-0 text-sm font-bold text-[var(--lt-text)]">Free Trial Activity</h3>
          <p className="m-0 mt-0.5 text-xs text-[var(--lt-text-subtle)]">
            Track who is testing LeadThur before buying
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <Chip className="border-[var(--lt-accent)]/30 bg-[var(--lt-accent)]/15 text-[var(--lt-accent-soft)]">
            {trialStats.trialsToday} today
          </Chip>
          <span
            className={cn(
              "text-lg text-[var(--lt-text-subtle)] transition-transform duration-200",
              trialSectionOpen && "rotate-180"
            )}
          >
            ⌄
          </span>
        </div>
      </div>

      {trialSectionOpen && (
        <div className={adminSectionBodyClass}>
          <div className="mb-5 grid grid-cols-2 gap-2.5">
            {STAT_CARDS.map((stat) => {
              const raw = trialStats[stat.key];
              const value =
                stat.key === "conversionRate" ? `${raw}%` : raw;

              return (
                <div
                  key={stat.key}
                  className="rounded-lg border border-[var(--lt-border)] bg-[var(--lt-surface-2)] px-4 py-3.5"
                >
                  <div className={cn("mb-0.5 text-[22px] font-extrabold", stat.colorClass)}>
                    {value}
                  </div>
                  <div className="text-[11px] font-semibold text-[var(--lt-text-muted)]">
                    {stat.label}
                  </div>
                </div>
              );
            })}
          </div>

          {trialActivity && trialActivity.dailyActivity.length > 0 && (
            <div className="mb-4 rounded-lg border border-[var(--lt-border)] bg-[var(--lt-surface-2)] p-4">
              <p className={cn(adminLabelClass, "mb-3 uppercase tracking-wider")}>Last 7 Days</p>
              <div className="flex h-20 items-end gap-2">
                {trialActivity.dailyActivity.map((day) => {
                  const maxCount = Math.max(
                    ...trialActivity.dailyActivity.map((d) => d.count)
                  );
                  const height =
                    maxCount > 0
                      ? Math.max((day.count / maxCount) * 70, day.count > 0 ? 8 : 2)
                      : 2;
                  const label = new Date(day.date).toLocaleDateString("en-GB", {
                    weekday: "short",
                  });

                  return (
                    <div
                      key={day.date}
                      className="flex flex-1 flex-col items-center gap-1"
                    >
                      <div className="text-[10px] font-bold text-[var(--lt-text-muted)]">
                        {day.count || ""}
                      </div>
                      <div
                        className={cn(
                          "w-full rounded transition-all duration-300",
                          day.count > 0
                            ? "bg-[var(--lt-accent)]"
                            : "bg-[var(--lt-surface-3)] opacity-40"
                        )}
                        style={{ height: `${height}px` }}
                      />
                      <div className="text-[9px] text-[var(--lt-text-subtle)]">{label}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {trialActivity && trialActivity.topQueries.length > 0 && (
            <div className="mb-4 rounded-lg border border-[var(--lt-border)] bg-[var(--lt-surface-2)] p-4">
              <p className={cn(adminLabelClass, "mb-3 uppercase tracking-wider")}>
                Top Searches This Month
              </p>
              {trialActivity.topQueries.map((q) => {
                const maxCount = trialActivity.topQueries[0]?.count || 1;
                const width = (q.count / maxCount) * 100;

                return (
                  <div key={q.query} className="mb-2.5 last:mb-0">
                    <div className="mb-1 flex items-center justify-between">
                      <span className="text-xs font-medium capitalize text-[var(--lt-text)]">
                        {q.query}
                      </span>
                      <span className="text-[11px] font-bold text-[var(--lt-accent-soft)]">
                        {q.count}x
                      </span>
                    </div>
                    <div className="h-1 overflow-hidden rounded-full bg-[var(--lt-surface-3)]">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-[var(--lt-accent)] to-[var(--lt-accent-soft)] transition-[width] duration-500"
                        style={{ width: `${width}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {trialActivity && trialActivity.recentTrials.length > 0 && (
            <div className="overflow-hidden rounded-lg border border-[var(--lt-border)] bg-[var(--lt-surface-2)]">
              <div className="flex items-center justify-between border-b border-[var(--lt-border)] px-4 py-3">
                <p className={cn(adminLabelClass, "m-0 uppercase tracking-wider")}>
                  Recent Trial Searches
                </p>
                <span className="text-[11px] text-[var(--lt-text-subtle)]">Last 50</span>
              </div>

              <div className="overflow-x-auto">
                <table className={adminTableClass}>
                  <thead>
                    <tr className={adminTableHeadRowClass}>
                      <th className="px-3.5 py-2.5">Business Type</th>
                      <th className="px-3.5 py-2.5">Location</th>
                      <th className="px-3.5 py-2.5">Results</th>
                      <th className="px-3.5 py-2.5">Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {trialActivity.recentTrials.map((trial) => (
                      <tr key={trial.id} className={adminTableRowClass}>
                        <td className="px-3.5 py-2.5 font-semibold capitalize text-[var(--lt-text)]">
                          {trial.query}
                        </td>
                        <td className="px-3.5 py-2.5 capitalize text-[var(--lt-text-muted)]">
                          {trial.location}
                        </td>
                        <td className="px-3.5 py-2.5">
                          <StatusBadge
                            status={
                              (trial.total_found > 0 ? "active" : "paused") as StatusBadgeStatus
                            }
                            label={String(trial.total_found || 0)}
                          />
                        </td>
                        <td className="whitespace-nowrap px-3.5 py-2.5 text-[var(--lt-text-muted)]">
                          {new Date(trial.created_at).toLocaleString("en-GB", {
                            day: "numeric",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </AdminSection>
  );
}
