export function formatSearchMessage(query: string, location: string): string {
  return `Searching for ${query.trim()} in ${location.trim()}...`;
}
