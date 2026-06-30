import { logger } from "../utils/logger";
import { getDeepseekApiKey } from "../utils/deepseek-config";
import {
  discoverNeighbourhoodAreas,
  parseCityCountry,
} from "../scraper/googleMaps/neighbourhood-expansion";
import { geocodeCity } from "../scraper/googleMaps/grid-search";
import { findNearbyCities } from "./nearby-cities";

const DEEPSEEK_API_URL = "https://api.deepseek.com/chat/completions";
const MAX_SUGGESTIONS = 6;

export interface AreaSuggestion {
  query: string;
  location: string;
  label: string;
}

export interface GenerateAreaSuggestionsOptions {
  excludeLocations?: string[];
}

function normalizeLocationKey(value: string): string {
  return value.toLowerCase().trim().replace(/\s+/g, " ");
}

function isLocationExcluded(location: string, exclude: string[]): boolean {
  const key = normalizeLocationKey(location);
  return exclude.some((raw) => {
    const excluded = normalizeLocationKey(raw);
    if (!excluded) return false;
    return (
      key === excluded ||
      key.includes(excluded) ||
      excluded.includes(key)
    );
  });
}

function areasToSuggestions(
  query: string,
  parentLocation: string,
  areas: string[],
  exclude: string[]
): AreaSuggestion[] {
  const { city, country } = parseCityCountry(parentLocation);
  const cityLabel = country ? `${city}, ${country}` : city;

  const out: AreaSuggestion[] = [];
  const seen = new Set<string>();

  for (const area of areas) {
    const trimmedArea = area.trim();
    if (!trimmedArea) continue;

    const location = country
      ? `${trimmedArea}, ${cityLabel}`
      : `${trimmedArea} ${cityLabel}`.trim();

    if (isLocationExcluded(location, exclude)) continue;
    if (isLocationExcluded(trimmedArea, exclude)) continue;

    const key = normalizeLocationKey(location);
    if (seen.has(key)) continue;
    seen.add(key);

    out.push({
      query,
      location,
      label: `${query} in ${location}`,
    });

    if (out.length >= MAX_SUGGESTIONS) break;
  }

  return out;
}

async function fetchDeepseekAreaSuggestions(
  query: string,
  location: string,
  totalFound: number
): Promise<string[]> {
  const apiKey = getDeepseekApiKey();
  if (!apiKey) return [];
  if (totalFound >= 200) return [];

  const prompt = `The user searched for "${query}" in "${location}" using a business lead finder tool and got ${totalFound} results from Google Maps.

Google Maps limits results per search to around 60 to 120 businesses. Suggest 6 specific sub-areas, neighborhoods, or districts within "${location}" where the user can run separate searches to find more "${query}" businesses.

Rules:
- Return only areas that actually exist within or very close to "${location}"
- Use the most well-known and commercially active neighborhoods or districts
- Format each area so it works as a Google Maps search location. Example: Westlands Nairobi or Sandton Johannesburg
- If the location is already a very small area with no meaningful sub-areas return an empty array
- Never suggest the exact same location the user already searched

Respond with ONLY a valid JSON array of strings. No explanation. No markdown. No code blocks. Just the raw JSON array.`;

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

async function nearbyCitySuggestions(
  query: string,
  location: string,
  exclude: string[]
): Promise<AreaSuggestion[]> {
  const geo = await geocodeCity(location);
  if (!geo) return [];

  const nearby = findNearbyCities(location, geo.lat, geo.lng, MAX_SUGGESTIONS, 150);
  const out: AreaSuggestion[] = [];

  for (const item of nearby) {
    if (isLocationExcluded(item.city, exclude)) continue;
    out.push({
      query,
      location: item.city,
      label: `${query} in ${item.city}`,
    });
    if (out.length >= MAX_SUGGESTIONS) break;
  }

  return out;
}

/**
 * Area expansion suggestions: Nominatim neighbourhoods first, DeepSeek sub-areas second,
 * nearby cities as fallback when no sub-areas exist.
 */
export async function generateAreaSuggestions(
  query: string,
  location: string,
  totalFound: number,
  options?: GenerateAreaSuggestionsOptions
): Promise<AreaSuggestion[]> {
  const exclude = [
    location,
    ...(options?.excludeLocations ?? []),
  ].filter(Boolean);

  try {
    const nominatimAreas = await discoverNeighbourhoodAreas(location, query);
    let suggestions = areasToSuggestions(query, location, nominatimAreas, exclude);

    if (suggestions.length < 3) {
      const deepseekAreas = await fetchDeepseekAreaSuggestions(
        query,
        location,
        totalFound
      );
      const fromDeepseek = areasToSuggestions(
        query,
        location,
        deepseekAreas,
        exclude
      );

      const seen = new Set(suggestions.map((s) => normalizeLocationKey(s.location)));
      for (const item of fromDeepseek) {
        const key = normalizeLocationKey(item.location);
        if (seen.has(key)) continue;
        seen.add(key);
        suggestions.push(item);
        if (suggestions.length >= MAX_SUGGESTIONS) break;
      }
    }

    if (suggestions.length === 0) {
      suggestions = await nearbyCitySuggestions(query, location, exclude);
      if (suggestions.length > 0) {
        logger.info("[suggestions] Using nearby city fallback", {
          location,
          query,
          count: suggestions.length,
        });
      }
    }

    logger.info("[suggestions] Area suggestions generated", {
      location,
      query,
      totalFound,
      nominatimCount: nominatimAreas.length,
      returned: suggestions.length,
      excluded: exclude.length,
    });

    return suggestions.slice(0, MAX_SUGGESTIONS);
  } catch (err) {
    logger.error("Failed to generate area suggestions", {
      error: err instanceof Error ? err.message : "unknown",
    });

    try {
      return await nearbyCitySuggestions(query, location, exclude);
    } catch {
      return [];
    }
  }
}
