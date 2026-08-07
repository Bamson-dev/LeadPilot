"use client";

import {
  AdminChipButton,
  AdminLoading,
  AdminSection,
  AdminSectionHeader,
  adminLabelClass,
  adminMutedClass,
  adminSectionBodyClass,
} from "@/components/admin/admin-ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/utils/utils";

export type DailyActivation = {
  date: string;
  count: number;
  label: string;
};

export type ActivationData = {
  total: number;
  daily: DailyActivation[];
  peak: number;
  average: number;
  from: string;
  to: string;
  days: number;
};

const PRESETS = [
  { label: "Today", value: "today" },
  { label: "Yesterday", value: "yesterday" },
  { label: "7 Days", value: "7days" },
  { label: "14 Days", value: "14days" },
  { label: "30 Days", value: "30days" },
  { label: "This Month", value: "thismonth" },
] as const;

const STAT_CARDS = [
  { key: "total", label: "Total Activations", colorClass: "text-[var(--lt-accent-soft)]", highlight: true },
  { key: "average", label: "Daily Average", colorClass: "text-[var(--lt-success)]", highlight: false },
  { key: "peak", label: "Peak Day", colorClass: "text-[var(--lt-warning)]", highlight: false },
  { key: "days", label: "Days Tracked", colorClass: "text-[var(--lt-text-muted)]", highlight: false },
] as const;

export function ActivationTrackerSection({
  activations,
  activationsLoading,
  activePreset,
  showCustom,
  customFrom,
  customTo,
  setActivePreset,
  setShowCustom,
  setCustomFrom,
  setCustomTo,
  loadActivations,
}: {
  activations: ActivationData | null;
  activationsLoading: boolean;
  activePreset: string;
  showCustom: boolean;
  customFrom: string;
  customTo: string;
  setActivePreset: (value: string) => void;
  setShowCustom: (value: boolean) => void;
  setCustomFrom: (value: string) => void;
  setCustomTo: (value: string) => void;
  loadActivations: (preset?: string, from?: string, to?: string) => void | Promise<void>;
}) {
  const statValues: Record<(typeof STAT_CARDS)[number]["key"], number> = {
    total: activations?.total ?? 0,
    average: activations?.average ?? 0,
    peak: activations?.peak ?? 0,
    days: activations?.days ?? 0,
  };

  return (
    <AdminSection id="admin-activations" className="mb-6">
      <AdminSectionHeader
        title="Activation Tracker"
        description="Daily signups and activations over time"
        action={
          activations ? (
            <div className="flex items-center gap-1.5 text-xs text-[var(--lt-text-subtle)]">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--lt-success)]" />
              Live data from Supabase
            </div>
          ) : undefined
        }
      />

      <div className={adminSectionBodyClass}>
        <div className="mb-4 flex flex-wrap gap-1.5">
          {PRESETS.map((preset) => (
            <AdminChipButton
              key={preset.value}
              active={activePreset === preset.value && !showCustom}
              onClick={() => {
                setActivePreset(preset.value);
                setShowCustom(false);
                void loadActivations(preset.value);
              }}
            >
              {preset.label}
            </AdminChipButton>
          ))}
          <AdminChipButton active={showCustom} onClick={() => setShowCustom(!showCustom)}>
            Custom Range
          </AdminChipButton>
        </div>

        {showCustom && (
          <div className="mb-4 flex flex-wrap items-end gap-2">
            <div>
              <label className={cn(adminLabelClass, "mb-1.5 block uppercase tracking-wider")}>
                From
              </label>
              <Input
                type="date"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="h-9 w-auto text-xs"
              />
            </div>
            <div>
              <label className={cn(adminLabelClass, "mb-1.5 block uppercase tracking-wider")}>
                To
              </label>
              <Input
                type="date"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
                className="h-9 w-auto text-xs"
              />
            </div>
            <Button
              type="button"
              size="sm"
              disabled={!customFrom || !customTo}
              onClick={() => {
                if (customFrom && customTo) {
                  void loadActivations(undefined, customFrom, customTo);
                }
              }}
            >
              Apply
            </Button>
          </div>
        )}

        {activationsLoading && <AdminLoading label="Loading activations..." />}

        {!activationsLoading && activations && (
          <>
            <div className="mb-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {STAT_CARDS.map((stat) => (
                <div
                  key={stat.key}
                  className={cn(
                    "rounded-lg border px-3.5 py-3 text-center",
                    stat.highlight
                      ? "border-[var(--lt-accent)]/20 bg-[var(--lt-accent)]/10"
                      : "border-[var(--lt-border)] bg-[var(--lt-surface-2)]"
                  )}
                >
                  <div
                    className={cn(
                      "mb-1 text-[28px] font-black leading-none tracking-tight",
                      stat.colorClass
                    )}
                  >
                    {statValues[stat.key]}
                  </div>
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--lt-text-subtle)]">
                    {stat.label}
                  </div>
                </div>
              ))}
            </div>

            {activations.daily.length > 0 ? (
              <div>
                <div className="mb-3 text-[11px] font-bold uppercase tracking-wider text-[var(--lt-text-subtle)]">
                  Daily Breakdown
                </div>

                <div className="relative flex h-[120px] items-end gap-1 border-b border-[var(--lt-border)] pb-6">
                  {activations.daily.map((day) => {
                    const heightPercent =
                      activations.peak > 0 ? (day.count / activations.peak) * 100 : 0;
                    const barHeight = Math.max(heightPercent * 0.96, day.count > 0 ? 4 : 0);
                    const isPeak = day.count === activations.peak && day.count > 0;

                    return (
                      <div
                        key={day.date}
                        className="relative flex h-full flex-1 flex-col items-center justify-end gap-1"
                        title={`${day.label}: ${day.count} activation${day.count !== 1 ? "s" : ""}`}
                      >
                        {day.count > 0 && (
                          <div
                            className="absolute left-1/2 -translate-x-1/2 text-[10px] font-bold text-[var(--lt-accent-soft)]"
                            style={{ bottom: `${barHeight + 26}px` }}
                          >
                            {day.count}
                          </div>
                        )}
                        <div
                          className={cn(
                            "absolute bottom-5 w-full rounded-t transition-all duration-300",
                            isPeak
                              ? "bg-[var(--lt-accent)]"
                              : day.count > 0
                                ? "bg-[var(--lt-accent)]/45"
                                : "bg-[var(--lt-surface-3)]"
                          )}
                          style={{
                            height: `${barHeight}%`,
                            minHeight: day.count > 0 ? 4 : 0,
                          }}
                        />
                        <div className="absolute bottom-0.5 left-1/2 -translate-x-1/2 whitespace-nowrap text-[9px] font-semibold text-[var(--lt-text-subtle)]">
                          {day.label.split(" ")[0]}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="mt-4">
                  {[...activations.daily].reverse().map((day) => (
                    <div
                      key={day.date}
                      className="flex items-center justify-between border-b border-[var(--lt-border)] py-2 text-xs"
                    >
                      <span className="font-medium text-[var(--lt-text-muted)]">{day.label}</span>
                      <div className="flex items-center gap-2">
                        <div className="h-1 w-20 overflow-hidden rounded bg-[var(--lt-surface-3)]">
                          <div
                            className={cn(
                              "h-full rounded",
                              day.count === activations.peak
                                ? "bg-[var(--lt-accent)]"
                                : "bg-[var(--lt-accent)]/50"
                            )}
                            style={{
                              width:
                                activations.peak > 0
                                  ? `${(day.count / activations.peak) * 100}%`
                                  : "0%",
                            }}
                          />
                        </div>
                        <span
                          className={cn(
                            "min-w-5 text-right font-bold",
                            day.count > 0
                              ? "text-[var(--lt-text)]"
                              : "text-[var(--lt-text-subtle)]"
                          )}
                        >
                          {day.count}
                        </span>
                        <span className="text-[10px] text-[var(--lt-text-subtle)]">
                          {day.count === 1 ? "activation" : "activations"}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className={cn(adminMutedClass, "py-8 text-center")}>
                No activations found for this period. Try a wider date range.
              </p>
            )}
          </>
        )}
      </div>
    </AdminSection>
  );
}
