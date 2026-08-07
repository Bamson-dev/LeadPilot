"use client";

import { useCallback, useEffect, useState } from "react";
import { TrialActivitySection } from "@/components/admin/trial-activity-section";
import { TrialSignupsPanel } from "@/components/admin/trial-signups-panel";
import { TrialEmailPerformancePanel } from "@/components/admin/trial-email-performance-panel";
import { TrialBroadcastPanel } from "@/components/admin/trial-broadcast-panel";
import { AdminWorkspaceHeader } from "@/components/admin/admin-workspace-header";
import { AdminChipButton } from "@/components/admin/admin-ui";
import { useAdminSession } from "@/components/admin/admin-session-context";
import {
  adminLabelClass,
  adminTableClass,
  adminTableHeadRowClass,
  adminTableRowClass,
} from "@/components/admin/admin-ui";
import { StatusBadge, type StatusBadgeStatus } from "@/components/ui/status-badge";
import { getTrialActivity, getTrialStats, type TrialActivity, type TrialStats } from "@/services/admin-api";
import { cn } from "@/utils/utils";

type TrialTab = "overview" | "searches" | "signups" | "email-performance" | "broadcast";

export function TrialWorkspace() {
  const { handleSessionExpired, handleSessionError } = useAdminSession();
  const [activeTab, setActiveTab] = useState<TrialTab>("overview");
  const [trialStats, setTrialStats] = useState<TrialStats | null>(null);
  const [trialActivity, setTrialActivity] = useState<TrialActivity | null>(null);

  const load = useCallback(async () => {
    try {
      const [statsData, activityData] = await Promise.all([
        getTrialStats(),
        getTrialActivity(),
      ]);
      setTrialStats(statsData);
      setTrialActivity(activityData);
    } catch (err) {
      handleSessionError(err);
    }
  }, [handleSessionError]);

  useEffect(() => {
    void load();
    const interval = setInterval(() => void load(), 120_000);
    return () => clearInterval(interval);
  }, [load]);

  const tabs: { id: TrialTab; label: string }[] = [
    { id: "overview", label: "Overview" },
    { id: "searches", label: "Searches" },
    { id: "signups", label: "Signups" },
    { id: "email-performance", label: "Email Performance" },
    { id: "broadcast", label: "Broadcast" },
  ];

  return (
    <>
      <AdminWorkspaceHeader
        title="Trial"
        description="Monitor free trial usage, signups, email performance, and broadcasts."
        badges={
          trialStats ? (
            <span className="rounded-full border border-[var(--lt-accent)]/30 bg-[var(--lt-accent)]/10 px-2 py-0.5 text-xs font-semibold text-[var(--lt-accent-soft)]">
              {trialStats.trialsToday} today
            </span>
          ) : null
        }
      />

      <div className="mb-5 inline-flex flex-wrap gap-1 rounded-lg border border-[var(--lt-border)] bg-[var(--lt-surface-2)] p-1">
        {tabs.map((tab) => (
          <AdminChipButton
            key={tab.id}
            active={activeTab === tab.id}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </AdminChipButton>
        ))}
      </div>

      {activeTab === "overview" && trialStats ? (
        <TrialActivitySection
          trialStats={trialStats}
          trialActivity={trialActivity}
          trialSectionOpen
          setTrialSectionOpen={() => {}}
        />
      ) : null}

      {activeTab === "searches" && trialActivity && trialActivity.recentTrials.length > 0 ? (
        <div className="overflow-hidden rounded-xl border border-[var(--lt-border)] bg-[var(--lt-surface)]">
          <div className="border-b border-[var(--lt-border)] px-4 py-3">
            <p className={cn(adminLabelClass, "m-0 uppercase tracking-wider")}>
              Recent Trial Searches
            </p>
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
      ) : null}

      {activeTab === "signups" ? (
        <TrialSignupsPanel onSessionExpired={handleSessionExpired} />
      ) : null}

      {activeTab === "email-performance" ? (
        <TrialEmailPerformancePanel onSessionExpired={handleSessionExpired} />
      ) : null}

      {activeTab === "broadcast" ? (
        <TrialBroadcastPanel onSessionExpired={handleSessionExpired} />
      ) : null}
    </>
  );
}
