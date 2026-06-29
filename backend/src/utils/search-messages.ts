export function formatSearchMessage(query: string, location: string): string {
  return `Searching for ${query.trim()} in ${location.trim()}...`;
}

export const PHASE1_LOADING_MESSAGE =
  "Searching for potential clients across the city. This takes about a minute to get the best results.";
