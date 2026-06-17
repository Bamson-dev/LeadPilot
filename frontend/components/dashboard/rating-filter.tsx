"use client";

import type { RatingFilterValue } from "@/lib/rating-filter";
import { RATING_FILTER_OPTIONS } from "@/lib/rating-filter";

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
      className={isMobile ? "flex flex-col gap-2 w-full" : "flex flex-wrap items-center gap-2"}
    >
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as RatingFilterValue)}
        style={{
          background: value !== "all" ? "rgba(124,58,237,0.15)" : "#111118",
          border: `1px solid ${value !== "all" ? "rgba(124,58,237,0.4)" : "rgba(255,255,255,0.08)"}`,
          color: value !== "all" ? "#A855F7" : "#F0EFFF",
          borderRadius: 8,
          padding: "7px 12px",
          fontSize: 12,
          cursor: "pointer",
          fontFamily: "Inter, sans-serif",
          outline: "none",
          appearance: "none",
          WebkitAppearance: "none",
          fontWeight: value !== "all" ? 600 : 400,
        }}
      >
        {RATING_FILTER_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>

      {isActive && (
        <span style={{ color: "#6B6B80", fontSize: 11 }}>
          Showing {filteredCount.toLocaleString()} of {totalCount.toLocaleString()} results
        </span>
      )}
    </div>
  );
}
