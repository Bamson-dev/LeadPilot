"use client";

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 p-8 text-center">
      <p className="m-0 text-sm font-semibold text-[var(--lt-text)]">
        This admin page failed to load.
      </p>
      <p className="m-0 max-w-md text-xs text-[var(--lt-text-subtle)]">
        {error.message || "A client-side exception occurred."}
      </p>
      <button
        type="button"
        className="rounded-md bg-[var(--lt-accent)] px-3 py-1.5 text-sm font-semibold text-white"
        onClick={() => reset()}
      >
        Try again
      </button>
    </div>
  );
}
