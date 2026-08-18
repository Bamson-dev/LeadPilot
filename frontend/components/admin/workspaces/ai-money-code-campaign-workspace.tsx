"use client";

import { useCallback, useEffect, useState } from "react";
import { AdminWorkspaceHeader } from "@/components/admin/admin-workspace-header";
import { getAdminToken } from "@/services/admin-api";

const API_BASE = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") || "https://backend.leadthur.com";

type StatusPayload = {
  campaignKey: string;
  campaignName: string;
  enabled: boolean;
  evergreenMode: boolean;
  activatedAt: string | null;
  currentDateLagos: string;
  audience: {
    paidLicenseRecordsFound: number;
    eligibleUniqueEmails: number;
    invalidOrBlankExcluded: number;
    duplicatesRemoved: number;
    internalOrTestExcluded: number;
    finalRecipientCount: number;
  };
  operational: {
    enrolled: number;
    dayAttempted: number;
    daySuccess: number;
    dayFailed: number;
    dayPending: number;
    totalSuccess: number;
    duplicatesPrevented: number;
    currentDateLagos: string;
    nextSendWindow: string;
    nextRunAt: string;
    scheduler: {
      running: boolean;
      tickRunning: boolean;
      lastRunAt: string | null;
      frequency: string;
      browserRequired: boolean;
      adminSessionRequired: boolean;
    };
    recentRuns: Array<{
      id: string;
      trigger: string;
      started_at: string;
      completed_at: string | null;
      recipients_evaluated: number;
      emails_sent: number;
      failures: number;
      skipped: number;
    }>;
  };
  progress: {
    enrolled: number;
    active: number;
    completed: number;
    paused: number;
    enrolledToday: number;
    dayDistribution: Record<string, number>;
    activeDeadlines: number;
    expiredDeadlines: number;
    nextUpcomingDeadline: string | null;
  };
  deadlines: {
    exampleJoinToday: {
      startDate: string;
      personalDeadlineUtc: string;
      personalDeadlineLagos: string;
    };
    exampleJoinDecember: {
      startDate: string;
      personalDeadlineUtc: string;
      personalDeadlineLagos: string;
    };
    nextUpcomingRecipientDeadline: string | null;
    activeSpecialPriceDeadlines: number;
    expiredSpecialPriceDeadlines: number;
  };
  settings: {
    campaign_start_date: string;
    timezone: string;
    webinar_url: string;
    offer_url: string;
    evergreen_mode: boolean;
  };
  selftest: { ok: boolean; errors: string[] };
};

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getAdminToken();
  const res = await fetch(`${API_BASE}/admin/email-campaigns/ai-money-code${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(init?.headers || {}),
    },
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((json as { error?: string }).error || `Request failed (${res.status})`);
  return json as T;
}

export function AiMoneyCodeCampaignWorkspace() {
  const [status, setStatus] = useState<StatusPayload | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const data = await api<StatusPayload>("/status");
    setStatus(data);
  }, []);

  useEffect(() => {
    void refresh().catch((err) => setError(err instanceof Error ? err.message : "Failed to load"));
    const id = setInterval(() => {
      void refresh().catch(() => undefined);
    }, 30_000);
    return () => clearInterval(id);
  }, [refresh]);

  async function run(label: string, fn: () => Promise<unknown>) {
    setBusy(label);
    setError(null);
    setMessage(null);
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

  const dayDistribution = status?.progress.dayDistribution || {};

  return (
    <div className="space-y-6">
      <AdminWorkspaceHeader
        title="AI Money Code Campaign"
        description="Evergreen 30-day per-recipient sequence for eligible paid LeadThur users. Each recipient gets their own calendar and personal special-price deadline in Africa/Lagos."
      />

      {error ? (
        <div className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      ) : null}
      {message ? (
        <div className="rounded border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{message}</div>
      ) : null}

      <section className="rounded border border-neutral-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-500">Global Campaign Status</h2>
        <div className="grid gap-4 md:grid-cols-4">
          <Metric label="Campaign status" value={status?.enabled ? "ACTIVE" : "INACTIVE"} />
          <Metric label="Evergreen mode" value={status?.evergreenMode ? "ENABLED" : "DISABLED"} />
          <Metric label="Lagos date" value={status?.currentDateLagos ?? "—"} />
          <Metric label="Scheduler" value={status?.operational.scheduler.running ? "RUNNING" : "STOPPED"} />
        </div>
      </section>

      <section className="rounded border border-neutral-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-500">Audience</h2>
        <div className="grid gap-4 md:grid-cols-3">
          <Metric label="Eligible paid users" value={String(status?.audience.finalRecipientCount ?? 0)} />
          <Metric label="Recipients enrolled" value={String(status?.progress.enrolled ?? 0)} />
          <Metric label="Active recipients" value={String(status?.progress.active ?? 0)} />
          <Metric label="Completed recipients" value={String(status?.progress.completed ?? 0)} />
          <Metric label="New enrolled today" value={String(status?.progress.enrolledToday ?? 0)} />
          <Metric label="Duplicates prevented" value={String(status?.operational.duplicatesPrevented ?? 0)} />
        </div>
      </section>

      <section className="rounded border border-neutral-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-500">Send Performance (Today)</h2>
        <div className="grid gap-4 md:grid-cols-4">
          <Metric label="Attempted" value={String(status?.operational.dayAttempted ?? 0)} />
          <Metric label="Successful" value={String(status?.operational.daySuccess ?? 0)} />
          <Metric label="Failed" value={String(status?.operational.dayFailed ?? 0)} />
          <Metric label="Pending retry" value={String(status?.operational.dayPending ?? 0)} />
        </div>
      </section>

      <section className="rounded border border-neutral-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-500">Recipient Progress</h2>
        <div className="grid gap-4 md:grid-cols-4">
          <Metric label="Completed" value={String(status?.progress.completed ?? 0)} />
          <Metric label="Active special-price deadlines" value={String(status?.progress.activeDeadlines ?? 0)} />
          <Metric label="Expired special-price deadlines" value={String(status?.progress.expiredDeadlines ?? 0)} />
          <Metric label="Next upcoming deadline" value={status?.deadlines.nextUpcomingRecipientDeadline || "—"} />
        </div>
        <div className="mt-4 grid gap-2 sm:grid-cols-5 md:grid-cols-10">
          {Array.from({ length: 30 }, (_, i) => {
            const day = String(i + 1);
            return (
              <div key={day} className="rounded border border-neutral-200 px-2 py-1 text-center text-xs">
                <div className="text-neutral-500">Day {day}</div>
                <div className="font-semibold">{dayDistribution[day] ?? 0}</div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="rounded border border-neutral-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-500">Personal Deadlines</h2>
        <div className="grid gap-2 text-sm sm:grid-cols-2">
          <div>
            Join today example: <strong>{status?.deadlines.exampleJoinToday.personalDeadlineLagos || "—"}</strong>
          </div>
          <div>
            Join Dec 10 example: <strong>{status?.deadlines.exampleJoinDecember.personalDeadlineLagos || "—"}</strong>
          </div>
          <div>Webinar URL: <strong>{status?.settings.webinar_url || "—"}</strong></div>
          <div>Offer URL: <strong>{status?.settings.offer_url || "—"}</strong></div>
        </div>
      </section>

      <section className="rounded border border-neutral-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-500">Scheduler</h2>
        <div className="grid gap-2 sm:grid-cols-3 text-sm">
          <Metric label="Tick active" value={status?.operational.scheduler.tickRunning ? "YES" : "NO"} />
          <Metric label="Last run" value={status?.operational.scheduler.lastRunAt || "—"} />
          <Metric label="Next run" value={status?.operational.nextRunAt || "—"} />
          <Metric label="Window" value={status?.operational.nextSendWindow || "—"} />
        </div>
      </section>

      <section className="flex flex-wrap gap-2">
        <Action label="Refresh" disabled={!!busy} onClick={() => run("Refresh", refresh)} />
        <Action
          label="Run Tick"
          disabled={!!busy}
          onClick={() => run("Run Tick", () => api("/tick", { method: "POST", body: "{}" }))}
        />
        <Action
          label="Activate Campaign"
          disabled={!!busy}
          onClick={() => run("Activate Campaign", () => api("/activate", { method: "POST", body: "{}" }))}
        />
      </section>

      <section className="rounded border border-neutral-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-500">Recent Runs</h2>
        {!status?.operational.recentRuns?.length ? (
          <p className="text-sm text-neutral-500">No runs yet.</p>
        ) : (
          <div className="space-y-2">
            {status.operational.recentRuns.map((run) => (
              <div key={run.id} className="rounded border border-neutral-200 px-3 py-2 text-sm">
                <div className="font-medium">{run.trigger}</div>
                <div className="text-neutral-500">
                  {run.started_at} · sent {run.emails_sent} · failed {run.failures} · skipped {run.skipped}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-neutral-200 bg-white px-4 py-3">
      <div className="text-xs uppercase tracking-wide text-neutral-500">{label}</div>
      <div className="mt-1 text-lg font-semibold text-neutral-900">{value}</div>
    </div>
  );
}

function Action({
  label,
  onClick,
  disabled,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="rounded bg-neutral-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
    >
      {label}
    </button>
  );
}
