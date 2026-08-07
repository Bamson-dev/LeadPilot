"use client";

interface SearchQueueCardProps {
  queuePosition: number;
}

export function SearchQueueCard({ queuePosition }: SearchQueueCardProps) {
  if (queuePosition <= 0) return null;

  return (
    <div className="mx-auto max-w-lg rounded-xl border border-[var(--lt-border)] bg-[var(--lt-surface)] px-6 py-8 text-center shadow-lg">
      <p className="text-lg font-semibold text-[var(--lt-text)]">Your search is queued</p>
      <p className="mt-3 text-3xl font-bold text-[var(--lt-accent-soft)]">
        #{queuePosition}
        <span className="ml-2 text-base font-medium text-[var(--lt-text-muted)]">in line</span>
      </p>
      <p className="mt-4 text-sm leading-relaxed text-[var(--lt-text-muted)]">
        This usually takes less than 2 minutes. We are limiting concurrent searches so
        everyone gets reliable results.
      </p>
      <p className="mt-4 text-sm text-[var(--lt-text-subtle)]">
        You will also receive an email when your results are ready — feel free to close
        this tab.
      </p>
    </div>
  );
}
