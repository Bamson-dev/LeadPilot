/**
 * Build Maps search URL variants for a query/location pair.
 * Multiple phrasings and sub-areas increase unique place URLs past the ~120 Maps viewport cap.
 */

const NIGERIA_CITIES = [
  "abuja",
  "lagos",
  "port harcourt",
  "kano",
  "ibadan",
  "enugu",
  "benin",
  "kaduna",
  "owerri",
  "uyo",
  "calabar",
  "warri",
];

export function isNigeriaLocation(location: string): boolean {
  const lower = location.toLowerCase();
  return (
    lower.includes("nigeria") ||
    NIGERIA_CITIES.some((city) => lower.includes(city))
  );
}

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

function phrasesForQueryLocation(query: string, loc: string): string[] {
  const q = query.trim();
  const phrases = [
    `${q} in ${loc}`,
    `${loc} ${q}`,
    `best ${q} ${loc}`,
  ];
  return phrases;
}

export function buildSearchStrategyUrls(
  query: string,
  location: string,
  isTrial = false
): string[] {
  const q = query.trim();
  const locTrimmed = location.trim();

  if (isTrial) {
    return [
      `https://www.google.com/maps/search/${encodeURIComponent(`${q} in ${locTrimmed}`)}`,
      `https://www.google.com/maps/search/${encodeURIComponent(`${locTrimmed} ${q}`)}`,
    ];
  }

  const locations = getLocationVariants(locTrimmed);
  const urls = new Set<string>();

  for (const loc of locations) {
    for (const phrase of phrasesForQueryLocation(q, loc)) {
      urls.add(
        `https://www.google.com/maps/search/${encodeURIComponent(phrase)}`
      );
    }
  }

  if (isNigeriaLocation(locTrimmed)) {
    urls.add(
      `https://www.google.com/maps/search/${encodeURIComponent(`${q} ${locTrimmed} Nigeria`)}`
    );
  }

  return [...urls];
}
