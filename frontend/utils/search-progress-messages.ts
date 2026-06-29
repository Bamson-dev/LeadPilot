export function getSearchProgressMessage(
  count: number,
  query: string,
  location: string,
  status: "running" | "completed" | "failed" | "queued",
  queuePosition?: number
): string {
  const q = query.trim();
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

  if (count === 0) {
    return "Starting your search...";
  }
  if (count <= 5) {
    return "Found first potential clients. Extracting contact details...";
  }
  if (count <= 15) {
    return `Found ${count} potential clients for ${q} in ${loc}. Still searching...`;
  }
  if (count <= 30) {
    return `Found ${count} potential clients. Collecting phone numbers and details...`;
  }
  if (count <= 50) {
    return `Found ${count} potential clients. Almost done...`;
  }
  return `Found ${count} potential clients. Wrapping up...`;
}

/** Progress bar: leads found / 250, capped at 99% until complete. */
export function getSearchProgressPercent(count: number, isComplete: boolean): number {
  if (isComplete) return 100;
  if (count <= 0) return 5;
  return Math.min(99, Math.round((count / 250) * 100));
}
