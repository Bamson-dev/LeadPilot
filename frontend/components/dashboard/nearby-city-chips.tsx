"use client";

import type { NearbyCitySuggestion } from "@leadthur/shared";

interface NearbyCityChipsProps {
  cities: NearbyCitySuggestion[];
  totalFound: number;
  onSelectCity: (city: string) => void;
}

export function NearbyCityChips({
  cities,
  totalFound,
  onSelectCity,
}: NearbyCityChipsProps) {
  if (cities.length === 0) return null;

  return (
    <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 space-y-3">
      <p className="text-sm text-amber-100/90">
        Only {totalFound} results found in this city. Try these nearby cities for
        more potential clients.
      </p>
      <div className="flex flex-wrap gap-2">
        {cities.map((item) => (
          <button
            key={item.city}
            type="button"
            onClick={() => onSelectCity(item.city)}
            className="rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-1 text-xs font-medium text-amber-100 transition hover:bg-amber-400/20"
          >
            {item.city}
            <span className="ml-1 text-amber-200/60">~{item.distanceKm}km</span>
          </button>
        ))}
      </div>
    </div>
  );
}
