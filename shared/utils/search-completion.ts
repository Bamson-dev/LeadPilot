/**
 * Single source of truth for "this search is actually finished."
 * Backend `status: completed` alone means Phase 1 ended — Maps/email may still run.
 */
export type SearchCompletionFields = {
  status?: string | null;
  scrapingInProgress?: boolean | null;
  emailScrapingComplete?: boolean | null;
  /** Prefer this when present (additive API field). */
  fullyComplete?: boolean | null;
};

/** Compute from raw job flags. Used by the backend when building responses. */
export function computeFullyComplete(input: {
  status?: string | null;
  scrapingInProgress?: boolean | null;
  emailScrapingComplete?: boolean | null;
}): boolean {
  return (
    input.status === "completed" &&
    !Boolean(input.scrapingInProgress) &&
    Boolean(input.emailScrapingComplete)
  );
}

/**
 * Frontend / consumer predicate. Prefer the backend `fullyComplete` field;
 * fall back to the same formula for older payloads during rollout.
 */
export function isSearchFullyComplete(input: SearchCompletionFields): boolean {
  if (typeof input.fullyComplete === "boolean") {
    return input.fullyComplete;
  }
  return computeFullyComplete(input);
}
