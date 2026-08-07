"use client";

import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";

interface WelcomeStateProps {
  onExampleSearch: (query: string, location: string) => void;
}

const EXAMPLES = [
  { query: "restaurants", location: "Abuja Nigeria" },
  { query: "salons", location: "Nairobi Kenya" },
  { query: "dentists", location: "Manchester UK" },
  { query: "gyms", location: "Dubai UAE" },
  { query: "hotels", location: "Accra Ghana" },
  { query: "real estate agencies", location: "Johannesburg South Africa" },
];

export function WelcomeState({ onExampleSearch }: WelcomeStateProps) {
  return (
    <div className="rounded-xl border border-[var(--lt-border)] bg-[var(--lt-surface)] px-6 py-12 text-center sm:px-8">
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--lt-cyan-soft)] text-[var(--lt-cyan)]">
        <Search className="h-5 w-5" />
      </div>
      <h3 className="text-xl font-semibold text-[var(--lt-text)]">
        Find businesses to pitch. Today.
      </h3>
      <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-[var(--lt-text-muted)]">
        Type any business type and any city in the world. Your leads will stream in within
        seconds.
      </p>
      <p className="mt-6 text-[11px] font-semibold uppercase tracking-wider text-[var(--lt-text-subtle)]">
        Try one of these
      </p>
      <div className="mt-3 flex flex-wrap justify-center gap-2">
        {EXAMPLES.map((example) => (
          <Button
            key={`${example.query}-${example.location}`}
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onExampleSearch(example.query, example.location)}
          >
            {example.query} · {example.location}
          </Button>
        ))}
      </div>
      <div className="mt-4 flex flex-wrap justify-center gap-2">
        <Chip>Business type + location</Chip>
        <Chip>Export CSV</Chip>
        <Chip>Outreach</Chip>
      </div>
    </div>
  );
}
