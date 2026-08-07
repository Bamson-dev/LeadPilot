"use client";

import type { RatingFilterValue } from "@/lib/rating-filter";
import { RATING_FILTER_OPTIONS } from "@/lib/rating-filter";
import { cn } from "@/utils/utils";

interface RatingFilterProps {
  value: RatingFilterValue;
  onChange: (value: RatingFilterValue) => void;
  filteredCount: number;
  totalCount: number;
  isMobile?: boolean;
}

export function RatingFilter({
  value,
  onChange,
  filteredCount,
  totalCount,
  isMobile = false,
}: RatingFilterProps) {
  const isActive = value !== "all";

  return (
    <div
      className={cn(
        isMobile ? "flex w-full flex-col gap-2" : "flex flex-wrap items-center gap-2"
      )}
    >
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as RatingFilterValue)}
        className={cn(
          "cursor-pointer appearance-none rounded-md border px-2.5 py-1.5 text-xs outline-none",
          isActive
            ? "border-[var(--lt-cyan)]/40 bg-[var(--lt-cyan-soft)] font-semibold text-[var(--lt-cyan)]"
            : "border-[var(--lt-border)] bg-[var(--lt-surface-2)] text-[var(--lt-text)]"
        )}
      >
        {RATING_FILTER_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>

      {isActive && (
        <span className="text-[11px] text-[var(--lt-text-subtle)]">
          Showing {filteredCount.toLocaleString()} of {totalCount.toLocaleString()} results
        </span>
      )}
    </div>
  );
}
