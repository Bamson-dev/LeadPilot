/**
 * Build Maps search URL variants for a query/location pair.
 * Multiple phrasings and sub-areas increase unique place URLs past the ~120 Maps viewport cap.
 */
export function getLocationVariants(location: string): string[] {
  const trimmed = location.trim();
  const lower = trimmed.toLowerCase();
  const variants = new Set<string>([trimmed]);

  if (
    lower.includes("new york") ||
    lower === "nyc" ||
    lower.includes("new york city")
  ) {
    [
      "New York City",
      "NYC",
      "Manhattan",
      "Brooklyn",
      "Queens",
      "Bronx",
      "Staten Island",
    ].forEach((v) => variants.add(v));
  }

  if (lower.includes("los angeles") || lower === "la" || lower.includes("l.a.")) {
    [
      "Los Angeles",
      "LA",
      "Hollywood",
      "Santa Monica",
      "Venice",
      "Downtown Los Angeles",
    ].forEach((v) => variants.add(v));
  }

  if (lower.includes("london")) {
    [
      "London",
      "Central London",
      "West London",
      "East London",
      "North London",
      "South London",
    ].forEach((v) => variants.add(v));
  }

  if (lower.includes("chicago")) {
    ["Chicago", "Downtown Chicago", "North Side Chicago", "South Side Chicago"].forEach(
      (v) => variants.add(v)
    );
  }

  return [...variants];
}

export function buildSearchStrategyUrls(query: string, location: string): string[] {
  const q = query.trim();
  const locations = getLocationVariants(location);
  const urls = new Set<string>();

  for (const loc of locations) {
    const phrases = [
      `${q} in ${loc}`,
      `${loc} ${q}`,
      `${q} near ${loc}`,
    ];
    for (const phrase of phrases) {
      urls.add(
        `https://www.google.com/maps/search/${encodeURIComponent(phrase)}`
      );
    }
  }

  return [...urls];
}
