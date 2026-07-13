"use client";

import type { NearbyCitySuggestion } from "@leadthur/shared";

interface NearbyCityChipsProps {
  cities: NearbyCitySuggestion[];
  show: boolean;
  onSelectCity: (city: string) => void;
}

export function NearbyCityChips({
  cities,
  show,
  onSelectCity,
}: NearbyCityChipsProps) {
  if (!show || cities.length === 0) return null;

  return (
    <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-4 space-y-3">
      <p className="text-sm text-amber-100/90 leading-relaxed">
        Want more results? Search a specific area of the city — each search adds
        new potential clients without clearing your current list.
      </p>
      <div className="flex flex-wrap gap-2.5">
        {cities.map((item) => (
          <button
            key={item.city}
            type="button"
            onClick={() => onSelectCity(item.city)}
            className="min-h-[44px] rounded-full border border-amber-400/35 bg-amber-400/10 px-4 py-2.5 text-sm font-medium text-amber-50 transition hover:bg-amber-400/20 active:scale-[0.98]"
          >
            {item.city}
            <span className="ml-1.5 text-amber-200/70">~{item.distanceKm}km</span>
          </button>
        ))}
      </div>
    </div>
  );
}
