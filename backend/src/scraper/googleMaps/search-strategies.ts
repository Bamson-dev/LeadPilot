/**
 * Dynamic Google Maps search URL generation — no hardcoded cities or business types.
 */

import {
  buildGridPoints,
  buildGridSearchUrl,
  type GeoCenter,
  type GridPoint,
} from "./grid-search";
import {
  randomZoomLevel,
  shuffleArray,
} from "./scraper-randomization";
import { KEYWORD_VARIATION_LIMIT } from "../utils/constants";

const QUALIFIERS = ["best", "top rated"] as const;

/** Universal synonym patterns — works for any business type worldwide. */
export function getKeywordVariations(query: string): string[] {
  const base = query.trim();
  if (!base) return [];

  const lower = base.toLowerCase();
  const stem =
    lower.endsWith("s") && lower.length > 3 ? lower.slice(0, -1) : lower;

  const variants = new Set<string>([base, stem]);
  variants.add(`${stem} shop`);
  variants.add(`${stem} studio`);
  variants.add(`${stem} center`);
  variants.add(`${stem} services`);
  variants.add(`${base} near me`);
  variants.add(`best ${base}`);
  variants.add(`top ${base}`);
  variants.add(`local ${base}`);

  return [...variants].slice(0, KEYWORD_VARIATION_LIMIT);
}

function encodeMapsSearch(phrase: string): string {
  return `https://www.google.com/maps/search/${encodeURIComponent(phrase)}`;
}

/** Format 2 — text relevance search for the full location string. */
export function buildTextSearchUrl(keyword: string, location: string): string {
  return encodeMapsSearch(`${keyword} in ${location.trim()}`);
}

/** Format 3 — qualifier searches (best / top rated). */
export function buildQualifierSearchUrls(
  keyword: string,
  location: string
): string[] {
  const loc = location.trim();
  return QUALIFIERS.map((q) =>
    encodeMapsSearch(`${q} ${keyword} ${loc}`)
  );
}

/** All three URL formats for a single grid point. */
export function buildGridPointUrlFormats(
  keyword: string,
  location: string,
  point: GridPoint
): string[] {
  const zoom = randomZoomLevel();
  const urls = new Set<string>([
    buildGridSearchUrl(keyword, point, location, zoom),
    buildTextSearchUrl(keyword, location),
    ...buildQualifierSearchUrls(keyword, location),
  ]);
  return [...urls];
}

function phrasesForQueryLocation(query: string, loc: string): string[] {
  const q = query.trim();
  const location = loc.trim();
  return [
    `${q} in ${location}`,
    `${location} ${q}`,
    `best ${q} ${location}`,
    `top ${q} ${location}`,
  ];
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
      encodeMapsSearch(`${q} in ${locTrimmed}`),
      encodeMapsSearch(`${locTrimmed} ${q}`),
    ];
  }

  const urls = new Set<string>();

  for (const keyword of keywords) {
    for (const phrase of phrasesForQueryLocation(keyword, locTrimmed)) {
      urls.add(encodeMapsSearch(phrase));
    }
    urls.add(buildTextSearchUrl(keyword, locTrimmed));
    for (const qualifierUrl of buildQualifierSearchUrls(keyword, locTrimmed)) {
      urls.add(qualifierUrl);
    }
  }

  return shuffleArray([...urls]);
}

/** Grid-based URLs with shuffled points and multiple formats per point. */
export function buildGridStrategyUrls(
  keywords: string[],
  location: string,
  geo: GeoCenter,
  expanded = false
): string[] {
  const points = shuffleArray(buildGridPoints(geo, expanded));
  const urls = new Set<string>();

  for (const keyword of keywords) {
    for (const point of points) {
      for (const url of buildGridPointUrlFormats(keyword, location, point)) {
        urls.add(url);
      }
    }
  }

  return shuffleArray([...urls]);
}

/** Classic text strategies + grid (caller runs batched collection). */
export async function buildAllSearchStrategyUrls(
  query: string,
  location: string,
  isTrial = false,
  expanded = false,
  geo?: GeoCenter | null
): Promise<string[]> {
  const classic = buildSearchStrategyUrls(query, location, isTrial);
  if (isTrial || !geo) return classic;

  const keywords = getKeywordVariations(query);
  const grid = buildGridStrategyUrls(keywords, location, geo, expanded);
  return shuffleArray([...new Set([...classic, ...grid])]);
}
