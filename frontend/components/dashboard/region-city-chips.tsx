"use client";

import type { CitySelectionSuggestion } from "@leadthur/shared";

interface RegionCityChipsProps {
  suggestions: CitySelectionSuggestion[];
  message?: string;
  onSelectCity: (city: string) => void;
}

export function RegionCityChips({
  suggestions,
  message,
  onSelectCity,
}: RegionCityChipsProps) {
  if (suggestions.length === 0) return null;

  return (
    <div className="rounded-xl border border-violet-500/25 bg-violet-500/10 px-4 py-4 space-y-3">
      <p className="text-sm text-violet-100 leading-relaxed">
        {message ??
          "LeadThur works best for specific cities. Pick a city below to search with the same business type."}
      </p>
      <div className="flex flex-wrap gap-2.5">
        {suggestions.map((item) => (
          <button
            key={item.city}
            type="button"
            onClick={() => onSelectCity(item.city)}
            className="min-h-[44px] rounded-full border border-violet-400/35 bg-violet-400/10 px-4 py-2.5 text-sm font-medium text-violet-50 transition hover:bg-violet-400/20 active:scale-[0.98]"
          >
            {item.label}
          </button>
        ))}
      </div>
    </div>
  );
}
