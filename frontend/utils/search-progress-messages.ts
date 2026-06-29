export function getSearchProgressMessage(
  count: number,
  _query: string,
  location: string,
  status: "running" | "completed" | "failed" | "queued",
  queuePosition?: number
): string {
  const loc = location.trim();

  if (status === "failed") {
    return "Search did not complete. Please try a broader location or business type.";
  }

  if (status === "completed") {
    if (count === 0) {
      return "No potential clients found in this area. Try a nearby city.";
    }
    return `We found ${count.toLocaleString()} potential clients for you.`;
  }

  if (status === "queued" && queuePosition != null && queuePosition > 0) {
    return `Your search is queued. Position ${queuePosition} in line. Results will start appearing shortly.`;
  }

  if (status === "running") {
    if (count === 0) {
      return `Finding potential clients in ${loc}...`;
    }
    return `Finding potential clients in ${loc}... ${count.toLocaleString()} found so far`;
  }

  if (count === 0) {
    return "Starting your search...";
  }

  return `Finding potential clients in ${loc}... ${count.toLocaleString()} found so far`;
}

/** Progress bar: leads found / 250, capped at 99% until complete. */
export function getSearchProgressPercent(count: number, isComplete: boolean): number {
  if (isComplete) return 100;
  if (count <= 0) return 5;
  return Math.min(99, Math.round((count / 250) * 100));
}
