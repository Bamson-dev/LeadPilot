/**
 * Build Maps search URL variants for a query/location pair.
 * Grid points, keyword variations, and sub-areas increase unique place URLs.
 */

import {
  buildGridSearchUrls,
  type GeoCenter,
} from "./grid-search";

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

const KEYWORD_SYNONYMS: Record<string, string[]> = {
  restaurant: ["restaurants", "dining", "food", "eatery"],
  restaurants: ["restaurant", "dining", "food", "eatery"],
  cafe: ["cafes", "coffee shop", "coffee"],
  hotel: ["hotels", "lodging", "accommodation"],
  salon: ["salons", "hair salon", "beauty salon"],
  gym: ["gyms", "fitness", "fitness center"],
  dentist: ["dentists", "dental clinic", "dental"],
  lawyer: ["lawyers", "law firm", "attorney"],
  plumber: ["plumbers", "plumbing"],
  electrician: ["electricians", "electrical"],
};

export function isNigeriaLocation(location: string): boolean {
  const lower = location.toLowerCase();
  return (
    lower.includes("nigeria") ||
    NIGERIA_CITIES.some((city) => lower.includes(city))
  );
}

export function getKeywordVariations(query: string): string[] {
  const q = query.trim().toLowerCase();
  const variants = new Set<string>([query.trim()]);

  for (const [key, synonyms] of Object.entries(KEYWORD_SYNONYMS)) {
    if (q === key || q.includes(key)) {
      synonyms.forEach((s) => variants.add(s));
      variants.add(key);
    }
  }

  return [...variants];
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
  return [`${q} in ${loc}`, `${loc} ${q}`, `best ${q} ${loc}`];
}

export function buildSearchStrategyUrls(
  query: string,
  location: string,
  isTrial = false
): string[] {
  const locTrimmed = location.trim();
  const keywords = getKeywordVariations(query);

  if (isTrial) {
    const q = query.trim();
    return [
      `https://www.google.com/maps/search/${encodeURIComponent(`${q} in ${locTrimmed}`)}`,
      `https://www.google.com/maps/search/${encodeURIComponent(`${locTrimmed} ${q}`)}`,
    ];
  }

  const urls = new Set<string>();
  const locations = getLocationVariants(locTrimmed);

  for (const loc of locations) {
    for (const keyword of keywords) {
      for (const phrase of phrasesForQueryLocation(keyword, loc)) {
        urls.add(
          `https://www.google.com/maps/search/${encodeURIComponent(phrase)}`
        );
      }
    }
  }

  if (isNigeriaLocation(locTrimmed)) {
    for (const keyword of keywords) {
      urls.add(
        `https://www.google.com/maps/search/${encodeURIComponent(`${keyword} ${locTrimmed} Nigeria`)}`
      );
    }
  }

  return [...urls];
}

/** Grid-based URLs — uses pre-resolved geo when provided. */
export async function buildGridStrategyUrls(
  query: string,
  location: string,
  expanded = false,
  geo?: GeoCenter | null
): Promise<string[]> {
  const keywords = getKeywordVariations(query);
  try {
    return await buildGridSearchUrls(keywords, location, expanded, geo);
  } catch {
    return [];
  }
}

/** Combined strategy list: classic phrases first, then grid (for deduped collection). */
export async function buildAllSearchStrategyUrls(
  query: string,
  location: string,
  isTrial = false,
  expanded = false
): Promise<string[]> {
  const classic = buildSearchStrategyUrls(query, location, isTrial);
  if (isTrial) return classic;

  const grid = await buildGridStrategyUrls(query, location, expanded);
  return [...new Set([...classic, ...grid])];
}
