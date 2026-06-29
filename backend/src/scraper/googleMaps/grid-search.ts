/**
 * Geocoded grid search for Google Maps URL generation.
 * Divides a city into a 3×3 or 5×5 grid to collect more unique place URLs.
 */

import { logger } from "../../utils/logger";

export interface GeoCenter {
  lat: number;
  lng: number;
  radiusKm: number;
  isLargeCity: boolean;
}

export interface GridPoint {
  lat: number;
  lng: number;
}

const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";

const COUNTRY_SUFFIXES = [
  "united kingdom",
  "united states",
  "united arab emirates",
  "south africa",
  "new zealand",
  "saudi arabia",
  "south korea",
  "north korea",
  "united states of america",
  "uk",
  "usa",
  "uae",
  "kenya",
  "nigeria",
  "ghana",
  "canada",
  "australia",
  "india",
  "france",
  "germany",
  "spain",
  "italy",
  "brazil",
  "mexico",
  "japan",
  "china",
  "egypt",
  "morocco",
  "ethiopia",
  "tanzania",
  "uganda",
  "rwanda",
  "zimbabwe",
  "zambia",
  "namibia",
  "botswana",
  "mozambique",
  "angola",
  "cameroon",
  "senegal",
  "ivory coast",
  "côte d'ivoire",
  "dubai",
];

/** Approximate centers for common search locations (fallback when geocoding fails). */
const CITY_FALLBACKS: Record<string, GeoCenter> = {
  lagos: { lat: 6.5244, lng: 3.3792, radiusKm: 25, isLargeCity: true },
  london: { lat: 51.5074, lng: -0.1278, radiusKm: 20, isLargeCity: true },
  "new york": { lat: 40.7128, lng: -74.006, radiusKm: 18, isLargeCity: true },
  abuja: { lat: 9.0765, lng: 7.3986, radiusKm: 15, isLargeCity: false },
  ibadan: { lat: 7.3775, lng: 3.947, radiusKm: 12, isLargeCity: false },
  manchester: { lat: 53.4808, lng: -2.2426, radiusKm: 12, isLargeCity: false },
  birmingham: { lat: 52.4862, lng: -1.8904, radiusKm: 12, isLargeCity: false },
  nairobi: { lat: -1.2921, lng: 36.8219, radiusKm: 18, isLargeCity: true },
  dubai: { lat: 25.2048, lng: 55.2708, radiusKm: 20, isLargeCity: true },
  kenya: { lat: -1.2921, lng: 36.8219, radiusKm: 18, isLargeCity: true },
};

function normalizeLocationKey(location: string): string {
  return location.toLowerCase().trim();
}

function fallbackGeo(location: string): GeoCenter {
  const lower = normalizeLocationKey(location);
  for (const [key, geo] of Object.entries(CITY_FALLBACKS)) {
    if (lower.includes(key)) return geo;
  }
  return { lat: 0, lng: 0, radiusKm: 12, isLargeCity: false };
}

/**
 * Nominatim works best with city names only — strip trailing country from
 * inputs like "Nairobi Kenya" or "Abuja, Nigeria".
 */
export function extractCityForGeocoding(location: string): string {
  const trimmed = location.trim();
  if (!trimmed) return trimmed;

  if (trimmed.includes(",")) {
    return trimmed.split(",")[0]?.trim() || trimmed;
  }

  const lower = trimmed.toLowerCase();
  for (const country of COUNTRY_SUFFIXES) {
    const suffix = ` ${country}`;
    if (lower.endsWith(suffix)) {
      return trimmed.slice(0, -suffix.length).trim();
    }
  }

  const words = trimmed.split(/\s+/);
  if (words.length >= 2) {
    const lastWord = words[words.length - 1]?.toLowerCase() ?? "";
    if (COUNTRY_SUFFIXES.includes(lastWord)) {
      return words.slice(0, -1).join(" ").trim();
    }
  }

  return trimmed;
}

export async function geocodeCity(location: string): Promise<GeoCenter> {
  const trimmed = location.trim();
  const geocodeQuery = extractCityForGeocoding(trimmed);

  logger.info("[search-diag] Geocoding city", {
    fullLocation: trimmed,
    geocodeQuery,
  });

  if (!trimmed) {
    const fb = fallbackGeo(location);
    logger.info("[search-diag] Nominatim skipped — empty location, using fallback", {
      geo: fb,
    });
    return fb;
  }

  try {
    const params = new URLSearchParams({
      q: geocodeQuery,
      format: "json",
      limit: "1",
    });
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);
    const res = await fetch(`${NOMINATIM_URL}?${params}`, {
      signal: controller.signal,
      headers: { "User-Agent": "LeadThur/1.0 (staging search)" },
    });
    clearTimeout(timeout);

    if (!res.ok) {
      const fb = fallbackGeo(location);
      logger.warn("[search-diag] Nominatim HTTP error — using fallback", {
        status: res.status,
        geocodeQuery,
        fallback: fb,
      });
      return fb;
    }

    const data = (await res.json()) as Array<{
      lat: string;
      lon: string;
      boundingbox?: string[];
      type?: string;
      class?: string;
      display_name?: string;
    }>;

    if (!data.length) {
      const fb = fallbackGeo(location);
      logger.warn("[search-diag] Nominatim returned zero results — using fallback", {
        geocodeQuery,
        fullLocation: trimmed,
        fallback: fb,
      });
      return fb;
    }

    const hit = data[0];
    const lat = parseFloat(hit.lat);
    const lng = parseFloat(hit.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      const fb = fallbackGeo(location);
      logger.warn("[search-diag] Nominatim invalid coordinates — using fallback", {
        geocodeQuery,
        hit,
        fallback: fb,
      });
      return fb;
    }

    let radiusKm = 12;
    if (hit.boundingbox?.length === 4) {
      const south = parseFloat(hit.boundingbox[0]);
      const north = parseFloat(hit.boundingbox[1]);
      const west = parseFloat(hit.boundingbox[2]);
      const east = parseFloat(hit.boundingbox[3]);
      if ([south, north, west, east].every(Number.isFinite)) {
        const latSpan = Math.abs(north - south);
        const lngSpan = Math.abs(east - west);
        radiusKm = Math.max(8, Math.min(35, ((latSpan + lngSpan) / 2) * 111 * 0.5));
      }
    }

    const isLargeCity =
      radiusKm >= 15 ||
      hit.type === "city" ||
      hit.type === "administrative" ||
      hit.class === "place";

    const geo = { lat, lng, radiusKm, isLargeCity };
    logger.info("[search-diag] Nominatim geocode success", {
      geocodeQuery,
      displayName: hit.display_name,
      geo,
    });
    return geo;
  } catch (err) {
    const fb = fallbackGeo(location);
    logger.warn("[search-diag] Nominatim geocode failed — using fallback", {
      geocodeQuery,
      error: err instanceof Error ? err.message : "unknown",
      fallback: fb,
    });
    return fb;
  }
}

export function buildGridPoints(geo: GeoCenter, expanded = false): GridPoint[] {
  const gridSize = geo.isLargeCity ? 5 : 3;
  const radius = expanded ? geo.radiusKm * 1.5 : geo.radiusKm;
  const cellRadiusKm = radius / gridSize;
  const latStep = cellRadiusKm / 111;
  const lngStep = cellRadiusKm / (111 * Math.cos((geo.lat * Math.PI) / 180));

  const points: GridPoint[] = [];
  const half = (gridSize - 1) / 2;

  for (let row = 0; row < gridSize; row++) {
    for (let col = 0; col < gridSize; col++) {
      points.push({
        lat: geo.lat + (row - half) * latStep,
        lng: geo.lng + (col - half) * lngStep,
      });
    }
  }

  return points;
}

/** Google Maps search URL centered on a grid point with full location context. */
export function buildGridSearchUrl(
  keyword: string,
  point: GridPoint,
  location: string,
  zoom = 14
): string {
  const phrase = `${keyword} in ${location.trim()}`;
  const q = encodeURIComponent(phrase);
  return `https://www.google.com/maps/search/${q}/@${point.lat},${point.lng},${zoom}z`;
}

export async function buildGridSearchUrls(
  keywords: string[],
  location: string,
  expanded = false
): Promise<string[]> {
  const geo = await geocodeCity(location);
  const points = buildGridPoints(geo, expanded);
  const urls = new Set<string>();

  for (const keyword of keywords) {
    for (const point of points) {
      urls.add(buildGridSearchUrl(keyword, point, location));
    }
  }

  const urlList = [...urls];
  logger.info("[search-diag] Grid URLs generated", {
    location,
    keywordCount: keywords.length,
    gridPoints: points.length,
    totalUrls: urlList.length,
    geo,
    sampleUrls: urlList.slice(0, 3),
  });

  return urlList;
}

export function expandGeoRadius(geo: GeoCenter): GeoCenter {
  return { ...geo, radiusKm: geo.radiusKm * 1.5 };
}
