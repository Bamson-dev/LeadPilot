import { logger } from "../../utils/logger";
import { shuffleArray } from "./scraper-randomization";

const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";
const NOMINATIM_TIMEOUT_MS = 3000;
const MAX_AREAS = 15;

const AREA_ADDRESS_KEYS = [
  "suburb",
  "quarter",
  "district",
  "neighbourhood",
  "neighborhood",
  "city_district",
  "borough",
  "county",
  "municipality",
  "town",
  "village",
  "hamlet",
] as const;

export function parseCityCountry(location: string): {
  city: string;
  country?: string;
} {
  const trimmed = location.trim();
  if (!trimmed) return { city: "" };

  const parts = trimmed.split(",").map((p) => p.trim()).filter(Boolean);
  if (parts.length >= 2) {
    return {
      city: parts.slice(0, -1).join(", "),
      country: parts[parts.length - 1],
    };
  }
  return { city: trimmed };
}

function extractAreaNames(
  hits: Array<{ address?: Record<string, string | undefined> }>
): string[] {
  const names = new Set<string>();

  for (const hit of hits) {
    const address = hit.address;
    if (!address) continue;

    for (const key of AREA_ADDRESS_KEYS) {
      const value = address[key]?.trim();
      if (value && value.length >= 2 && value.length <= 80) {
        names.add(value);
      }
    }
  }

  return [...names];
}

async function nominatimSearch(
  q: string,
  withAddressDetails: boolean
): Promise<Array<{ address?: Record<string, string | undefined> }>> {
  const query = q.trim();
  if (!query) return [];

  try {
    const params = new URLSearchParams({
      q: query,
      format: "json",
      limit: "50",
    });
    if (withAddressDetails) {
      params.set("addressdetails", "1");
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), NOMINATIM_TIMEOUT_MS);

    const res = await fetch(`${NOMINATIM_URL}?${params}`, {
      signal: controller.signal,
      headers: { "User-Agent": "LeadThur/1.0 (staging search)" },
    });
    clearTimeout(timeout);

    if (!res.ok) {
      logger.warn("[search-diag] Nominatim area lookup HTTP error", {
        query,
        status: res.status,
      });
      return [];
    }

    return (await res.json()) as Array<{
      address?: Record<string, string | undefined>;
    }>;
  } catch (err) {
    const timedOut =
      err instanceof Error &&
      (err.name === "AbortError" || err.message.includes("abort"));
    logger.warn("[search-diag] Nominatim area lookup failed", {
      query,
      timedOut,
      error: err instanceof Error ? err.message : "unknown",
    });
    return [];
  }
}

/**
 * Discover sub-areas for any city worldwide via OpenStreetMap (3s timeout per call).
 */
export async function discoverNeighbourhoodAreas(
  location: string,
  query: string
): Promise<string[]> {
  const { city, country } = parseCityCountry(location);
  if (!city) return [];

  const cityQuery = country ? `${city} ${country}` : city;
  const businessQuery = `${query.trim()} in ${cityQuery}`;

  const [cityHits, businessHits] = await Promise.all([
    nominatimSearch(cityQuery, true),
    nominatimSearch(businessQuery, true),
  ]);

  const combined = new Set<string>([
    ...extractAreaNames(cityHits),
    ...extractAreaNames(businessHits),
  ]);

  const areas = shuffleArray([...combined]).slice(0, MAX_AREAS);

  logger.info("[search-diag] Neighbourhood areas discovered", {
    location,
    query,
    cityQuery,
    areasFound: areas.length,
    sampleAreas: areas.slice(0, 5),
  });

  return areas;
}

export function buildNeighbourhoodSearchUrls(
  query: string,
  location: string,
  areas: string[]
): string[] {
  const { city, country } = parseCityCountry(location);
  const cityLabel = country ? `${city}, ${country}` : city;

  return areas.map((area) => {
    const phrase = `${query.trim()} in ${area} ${cityLabel}`;
    return `https://www.google.com/maps/search/${encodeURIComponent(phrase)}`;
  });
}
