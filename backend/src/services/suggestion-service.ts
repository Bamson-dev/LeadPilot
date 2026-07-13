import { logger } from "../utils/logger";
import { getDeepseekApiKey } from "../utils/deepseek-config";
import {
  geocodeNominatimDetailed,
  searchCitiesInNominatimRegion,
} from "../scraper/googleMaps/grid-search";
import {
  discoverNeighbourhoodAreas,
  parseCityCountry,
} from "../scraper/googleMaps/neighbourhood-expansion";
import { AREA_SUGGESTION_THRESHOLD } from "../scraper/utils/constants";

const DEEPSEEK_API_URL = "https://api.deepseek.com/chat/completions";
const MAX_SUGGESTIONS = 6;

export interface AreaSuggestion {
  query: string;
  location: string;
  label: string;
}

export interface AreaSuggestionResult {
  suggestions: AreaSuggestion[];
  message: string;
  source: "deepseek" | "nominatim_areas" | "nominatim_cities" | "none";
}

export function normalizeExpansionLocation(location: string): string {
  return location.toLowerCase().replace(/\s+/g, " ").trim();
}

function buildExcludeSet(
  baseLocation: string,
  excludeLocations?: string[]
): Set<string> {
  const set = new Set<string>();
  const base = normalizeExpansionLocation(baseLocation);
  if (base) set.add(base);
  for (const loc of excludeLocations ?? []) {
    const key = normalizeExpansionLocation(loc);
    if (key) set.add(key);
  }
  return set;
}

function isExcludedLocation(location: string, exclude: Set<string>): boolean {
  const key = normalizeExpansionLocation(location);
  if (exclude.has(key)) return true;
  for (const ex of exclude) {
    if (key.includes(ex) || ex.includes(key)) return true;
  }
  return false;
}

function dedupeSuggestions(items: AreaSuggestion[]): AreaSuggestion[] {
  const seen = new Set<string>();
  const out: AreaSuggestion[] = [];
  for (const item of items) {
    const key = normalizeExpansionLocation(item.location);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

async function fetchDeepseekAreaStrings(
  query: string,
  location: string,
  totalFound: number,
  alreadySearched: string[]
): Promise<string[]> {
  const apiKey = getDeepseekApiKey();
  if (!apiKey) return [];

  const searchedNote =
    alreadySearched.length > 0
      ? `\n- Do NOT suggest any of these locations the user already searched: ${alreadySearched.join("; ")}`
      : "";

  const prompt = `The user searched for "${query}" in "${location}" using a business lead finder tool and got ${totalFound} results from Google Maps.

Google Maps limits results per search to around 60 to 120 businesses. Suggest up to 6 specific sub-areas, neighborhoods, or districts within "${location}" where the user can run separate searches to find more "${query}" businesses.

Rules:
- Return only areas that actually exist within or very close to "${location}"
- Use the most well-known and commercially active neighborhoods or districts
- Format each area so it works as a Google Maps search location
- Never suggest the exact same location the user already searched${searchedNote}
- If the location is already a very small area with no meaningful sub-areas return an empty array

Respond with ONLY a valid JSON array of strings. No explanation. No markdown.`;

  const response = await fetch(DEEPSEEK_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "deepseek-chat",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 200,
      temperature: 0.3,
    }),
  });

  if (!response.ok) {
    logger.error("DeepSeek API error", { status: response.status });
    return [];
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = data.choices?.[0]?.message?.content?.trim();
  if (!content) return [];

  try {
    const areas = JSON.parse(content) as string[];
    return Array.isArray(areas) ? areas : [];
  } catch {
    const match = content.match(/\[[\s\S]*\]/);
    if (!match) return [];
    const areas = JSON.parse(match[0]) as string[];
    return Array.isArray(areas) ? areas : [];
  }
}

async function nominatimSubAreaSuggestions(
  query: string,
  location: string,
  exclude: Set<string>
): Promise<AreaSuggestion[]> {
  const areas = await discoverNeighbourhoodAreas(location, query);
  const { city, country } = parseCityCountry(location);
  const cityLabel = country ? `${city}, ${country}` : city;

  const out: AreaSuggestion[] = [];
  for (const area of areas) {
    const loc = `${area} ${cityLabel}`.trim();
    if (isExcludedLocation(loc, exclude)) continue;
    out.push({
      query,
      location: loc,
      label: `${query} in ${area} ${cityLabel}`,
    });
    if (out.length >= MAX_SUGGESTIONS) break;
  }

  if (out.length > 0) {
    logger.info("[suggestions] Nominatim sub-area fallback", {
      location,
      query,
      count: out.length,
    });
  }

  return out;
}

async function nominatimNearbyCitySuggestions(
  query: string,
  location: string,
  exclude: Set<string>
): Promise<AreaSuggestion[]> {
  const geocoded = await geocodeNominatimDetailed(location);
  if (!geocoded?.hit?.address) return [];

  const cities = await searchCitiesInNominatimRegion(
    geocoded.hit.address,
    MAX_SUGGESTIONS + exclude.size,
    geocoded.hit.boundingBox
  );

  const out: AreaSuggestion[] = [];
  for (const city of cities) {
    if (isExcludedLocation(city.city, exclude)) continue;
    out.push({
      query,
      location: city.city,
      label: `${query} in ${city.label}`,
    });
    if (out.length >= MAX_SUGGESTIONS) break;
  }

  if (out.length > 0) {
    logger.info("[suggestions] Nominatim nearby-city fallback", {
      location,
      query,
      count: out.length,
    });
  }

  return out;
}

export async function generateAreaSuggestions(
  query: string,
  location: string,
  totalFound: number,
  options?: { excludeLocations?: string[] }
): Promise<AreaSuggestionResult> {
  try {
    if (totalFound >= AREA_SUGGESTION_THRESHOLD) {
      return {
        suggestions: [],
        message: "Great coverage. You already have a large result set for this area.",
        source: "none",
      };
    }

    const exclude = buildExcludeSet(location, options?.excludeLocations);
    const alreadySearched = [...exclude];

    let suggestions: AreaSuggestion[] = [];
    let source: AreaSuggestionResult["source"] = "none";
    let message = "";

    const deepseekAreas = await fetchDeepseekAreaStrings(
      query,
      location,
      totalFound,
      alreadySearched
    );

    if (deepseekAreas.length > 0) {
      suggestions = deepseekAreas
        .map((area) => ({
          query,
          location: area,
          label: `${query} in ${area}`,
        }))
        .filter((s) => !isExcludedLocation(s.location, exclude));
      if (suggestions.length > 0) {
        source = "deepseek";
        message = `Split your search across these areas to find more ${query} businesses`;
      }
    }

    if (suggestions.length < MAX_SUGGESTIONS) {
      const nominatimAreas = await nominatimSubAreaSuggestions(query, location, exclude);
      const merged = dedupeSuggestions([...suggestions, ...nominatimAreas]);
      if (merged.length > suggestions.length && source === "none") {
        source = "nominatim_areas";
        message = `Search these neighbourhoods within your area to find more ${query} businesses`;
      }
      suggestions = merged.slice(0, MAX_SUGGESTIONS);
    }

    if (suggestions.length === 0) {
      const nearbyCities = await nominatimNearbyCitySuggestions(query, location, exclude);
      if (nearbyCities.length > 0) {
        suggestions = nearbyCities;
        source = "nominatim_cities";
        message = `Try these nearby cities to find more ${query} businesses`;
      }
    }

    suggestions = dedupeSuggestions(suggestions)
      .filter((s) => !isExcludedLocation(s.location, exclude))
      .slice(0, MAX_SUGGESTIONS);

    return { suggestions, message, source };
  } catch (err) {
    logger.error("Failed to generate area suggestions", {
      error: err instanceof Error ? err.message : "unknown",
    });
    return { suggestions: [], message: "", source: "none" };
  }
}

/** @deprecated Use generateAreaSuggestions return value */
export async function generateAreaSuggestionsLegacy(
  query: string,
  location: string,
  totalFound: number
): Promise<AreaSuggestion[]> {
  const result = await generateAreaSuggestions(query, location, totalFound);
  return result.suggestions;
}
