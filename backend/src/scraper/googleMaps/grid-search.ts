/**
 * Universal geocoding for grid-based Google Maps URL generation.
 * No hardcoded city lists — Nominatim → shortened Nominatim → Google Geocoding → null.
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

export type GeocodeSource = "nominatim-full" | "nominatim-short" | "google" | "none";

export interface GeocodeResult {
  geo: GeoCenter | null;
  source: GeocodeSource;
  queryUsed: string;
}

export interface NominatimGeocodeHit {
  lat: number;
  lng: number;
  type?: string;
  class?: string;
  displayName?: string;
  address?: Record<string, string>;
}

export interface RegionCitySuggestion {
  city: string;
  label: string;
}

const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";
const NOMINATIM_TIMEOUT_MS = 3000;
const GOOGLE_GEOCODE_TIMEOUT_MS = 5000;

/** Strip business type if it leaked into the location field. */
export function cleanLocationInput(
  location: string,
  businessType?: string
): string {
  let cleaned = location.trim().replace(/\s+/g, " ");
  if (!cleaned) return cleaned;

  const bt = businessType?.trim();
  if (!bt) return cleaned;

  const btLower = bt.toLowerCase();
  const lower = cleaned.toLowerCase();

  if (lower.startsWith(`${btLower} in `)) {
    return cleaned.slice(bt.length + 4).trim();
  }
  if (lower.endsWith(` ${btLower}`)) {
    return cleaned.slice(0, cleaned.length - bt.length - 1).trim();
  }
  if (lower === btLower) return "";

  return cleaned;
}

/** Shortened queries to retry when the full free-form string fails. */
export function shortenLocationQueries(fullLocation: string): string[] {
  const trimmed = fullLocation.trim();
  const seen = new Set<string>();
  const queries: string[] = [];

  const add = (q: string) => {
    const t = q.trim();
    if (!t || t === trimmed || seen.has(t.toLowerCase())) return;
    seen.add(t.toLowerCase());
    queries.push(t);
  };

  if (trimmed.includes(",")) {
    const parts = trimmed.split(",").map((p) => p.trim()).filter(Boolean);
    if (parts.length >= 2) {
      add(parts.slice(0, -1).join(", "));
      add(parts[0]);
    }
  }

  const words = trimmed.split(/\s+/).filter(Boolean);
  // Prefer shorter city names first (e.g. "Seoul" before "Seoul South" from "Seoul South Korea").
  for (let keep = 1; keep < words.length; keep++) {
    add(words.slice(0, keep).join(" "));
  }

  return queries;
}

/** City label for emails — first meaningful segment of the location string. */
export function displayCityFromLocation(location: string): string {
  const cleaned = cleanLocationInput(location);
  if (!cleaned) return location.trim();

  if (cleaned.includes(",")) {
    return cleaned.split(",")[0]?.trim() || cleaned;
  }

  const words = cleaned.split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    return words.slice(0, 2).join(" ");
  }
  return words[0] ?? cleaned;
}

/** @deprecated Use displayCityFromLocation — kept for email import compatibility. */
export function extractCityForGeocoding(location: string): string {
  return displayCityFromLocation(location);
}

export function getGoogleMapsApiKey(): string | undefined {
  const key =
    process.env.GOOGLE_MAPS_API_KEY?.trim() ||
    process.env.GOOGLE_API_KEY?.trim() ||
    undefined;
  return key || undefined;
}

export function hasGoogleGeocodingApiKey(): boolean {
  return Boolean(getGoogleMapsApiKey());
}

function parseNominatimHit(hit: {
  lat: string;
  lon: string;
  boundingbox?: string[];
  type?: string;
  class?: string;
  display_name?: string;
}): GeoCenter | null {
  const lat = parseFloat(hit.lat);
  const lng = parseFloat(hit.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat === 0 && lng === 0) return null;

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

  return { lat, lng, radiusKm, isLargeCity };
}

function parseNominatimAddress(
  hit: {
    lat: string;
    lon: string;
    boundingbox?: string[];
    type?: string;
    class?: string;
    display_name?: string;
    address?: Record<string, string>;
  }
): NominatimGeocodeHit | null {
  const lat = parseFloat(hit.lat);
  const lng = parseFloat(hit.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return {
    lat,
    lng,
    type: hit.type,
    class: hit.class,
    displayName: hit.display_name,
    address: hit.address,
  };
}

async function geocodeNominatimQuery(
  query: string,
  source: GeocodeSource,
  options?: { addressDetails?: boolean }
): Promise<GeocodeResult | null> {
  const q = query.trim();
  if (!q) return null;

  try {
    const params = new URLSearchParams({
      q,
      format: "json",
      limit: "1",
    });
    if (options?.addressDetails) {
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
      logger.warn("[search-diag] Nominatim HTTP error", {
        query: q,
        status: res.status,
        source,
      });
      return null;
    }

    const data = (await res.json()) as Array<{
      lat: string;
      lon: string;
      boundingbox?: string[];
      type?: string;
      class?: string;
      display_name?: string;
      address?: Record<string, string>;
    }>;

    if (!data.length) {
      logger.info("[search-diag] Nominatim zero results", { query: q, source });
      return null;
    }

    const geo = parseNominatimHit(data[0]);
    if (!geo) {
      logger.warn("[search-diag] Nominatim invalid hit", { query: q, source });
      return null;
    }

    logger.info("[search-diag] Nominatim geocode success", {
      query: q,
      source,
      displayName: data[0].display_name,
      geo,
    });

    return { geo, source, queryUsed: q };
  } catch (err) {
    const isTimeout =
      err instanceof Error &&
      (err.name === "AbortError" || err.message.includes("abort"));
    logger.warn("[search-diag] Nominatim request failed", {
      query: q,
      source,
      timedOut: isTimeout,
      error: err instanceof Error ? err.message : "unknown",
    });
    return null;
  }
}

export async function geocodeNominatimFull(
  location: string
): Promise<GeocodeResult | null> {
  return geocodeNominatimQuery(location, "nominatim-full");
}

export async function geocodeNominatimDetailed(
  location: string
): Promise<{
  geo: GeoCenter | null;
  hit: NominatimGeocodeHit | null;
  queryUsed: string;
} | null> {
  const q = location.trim();
  if (!q) return null;

  try {
    const params = new URLSearchParams({
      q,
      format: "json",
      limit: "1",
      addressdetails: "1",
    });
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), NOMINATIM_TIMEOUT_MS);

    const res = await fetch(`${NOMINATIM_URL}?${params}`, {
      signal: controller.signal,
      headers: { "User-Agent": "LeadThur/1.0 (staging search)" },
    });
    clearTimeout(timeout);

    if (!res.ok) return null;

    const data = (await res.json()) as Array<{
      lat: string;
      lon: string;
      boundingbox?: string[];
      type?: string;
      class?: string;
      display_name?: string;
      address?: Record<string, string>;
    }>;

    if (!data.length) return null;

    const geo = parseNominatimHit(data[0]);
    const hit = parseNominatimAddress(data[0]);
    if (!geo || !hit) return null;

    return { geo, hit, queryUsed: q };
  } catch {
    return null;
  }
}

export async function searchCitiesInNominatimRegion(
  address: Record<string, string>,
  limit = 10
): Promise<RegionCitySuggestion[]> {
  const country = address.country?.trim();
  const state =
    address.state?.trim() ||
    address.region?.trim() ||
    address.province?.trim() ||
    address.state_district?.trim();

  if (!country && !state) return [];

  const params = new URLSearchParams({
    format: "json",
    addressdetails: "1",
    featuretype: "city",
    limit: String(Math.min(10, Math.max(1, limit))),
  });

  if (state) params.set("state", state);
  if (country) params.set("country", country);

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), NOMINATIM_TIMEOUT_MS);
    const res = await fetch(`${NOMINATIM_URL}?${params}`, {
      signal: controller.signal,
      headers: { "User-Agent": "LeadThur/1.0 (staging search)" },
    });
    clearTimeout(timeout);

    if (!res.ok) return [];

    const data = (await res.json()) as Array<{
      display_name?: string;
      name?: string;
      address?: Record<string, string>;
    }>;

    const seen = new Set<string>();
    const out: RegionCitySuggestion[] = [];

    for (const row of data) {
      const label =
        row.address?.city ||
        row.address?.town ||
        row.address?.village ||
        row.name ||
        row.display_name?.split(",")[0]?.trim() ||
        "";
      const city = row.display_name?.trim() || label;
      if (!label || !city) continue;
      const key = label.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ city, label });
    }

    return out;
  } catch (err) {
    logger.warn("[search-diag] Nominatim city list failed", {
      state,
      country,
      error: err instanceof Error ? err.message : "unknown",
    });
    return [];
  }
}

export async function geocodeNominatimShortened(
  location: string
): Promise<GeocodeResult | null> {
  const trimmed = location.trim();
  for (const query of shortenLocationQueries(trimmed)) {
    const result = await geocodeNominatimQuery(query, "nominatim-short");
    if (result) return result;
  }
  return null;
}

async function geocodeGoogleQuery(
  address: string
): Promise<GeocodeResult | null> {
  const key = getGoogleMapsApiKey();
  if (!key) return null;

  const q = address.trim();
  if (!q) return null;

  try {
    const params = new URLSearchParams({ address: q, key });
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), GOOGLE_GEOCODE_TIMEOUT_MS);

    const res = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?${params}`,
      { signal: controller.signal }
    );
    clearTimeout(timeout);

    if (!res.ok) {
      logger.warn("[search-diag] Google Geocoding HTTP error", {
        query: q,
        status: res.status,
      });
      return null;
    }

    const data = (await res.json()) as {
      status: string;
      results?: Array<{
        geometry: {
          location: { lat: number; lng: number };
          bounds?: {
            northeast: { lat: number; lng: number };
            southwest: { lat: number; lng: number };
          };
          viewport?: {
            northeast: { lat: number; lng: number };
            southwest: { lat: number; lng: number };
          };
        };
        types?: string[];
        formatted_address?: string;
      }>;
    };

    if (data.status !== "OK" || !data.results?.length) {
      logger.info("[search-diag] Google Geocoding no results", {
        query: q,
        status: data.status,
      });
      return null;
    }

    const hit = data.results[0];
    const lat = hit.geometry.location.lat;
    const lng = hit.geometry.location.lng;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

    let radiusKm = 12;
    const bounds = hit.geometry.bounds ?? hit.geometry.viewport;
    if (bounds) {
      const latSpan = Math.abs(bounds.northeast.lat - bounds.southwest.lat);
      const lngSpan = Math.abs(bounds.northeast.lng - bounds.southwest.lng);
      radiusKm = Math.max(8, Math.min(35, ((latSpan + lngSpan) / 2) * 111 * 0.5));
    }

    const types = hit.types ?? [];
    const isLargeCity =
      radiusKm >= 15 ||
      types.includes("locality") ||
      types.includes("administrative_area_level_1");

    const geo: GeoCenter = { lat, lng, radiusKm, isLargeCity };
    logger.info("[search-diag] Google Geocoding success", {
      query: q,
      formattedAddress: hit.formatted_address,
      geo,
    });

    return { geo, source: "google", queryUsed: q };
  } catch (err) {
    logger.warn("[search-diag] Google Geocoding failed", {
      query: q,
      error: err instanceof Error ? err.message : "unknown",
    });
    return null;
  }
}

export async function geocodeGoogle(location: string): Promise<GeocodeResult | null> {
  return geocodeGoogleQuery(location);
}

/** Best available coordinates for nearby-city suggestions (null if all providers fail). */
export async function geocodeCity(
  location: string,
  businessType?: string
): Promise<GeoCenter | null> {
  const cleaned = cleanLocationInput(location, businessType) || location.trim();
  if (!cleaned) return null;

  const full = await geocodeNominatimFull(cleaned);
  if (full?.geo) return full.geo;

  const short = await geocodeNominatimShortened(cleaned);
  if (short?.geo) return short.geo;

  const google = await geocodeGoogle(cleaned);
  if (google?.geo) return google.geo;

  return null;
}

export function buildGridPoints(geo: GeoCenter, expanded = false): GridPoint[] {
  const gridSize = geo.isLargeCity ? 5 : 3;
  const radius = expanded ? geo.radiusKm * 1.5 : geo.radiusKm;
  const cellRadiusKm = radius / gridSize;
  const latStep = cellRadiusKm / 111;
  const lngStep =
    cellRadiusKm / (111 * Math.cos((geo.lat * Math.PI) / 180) || 1);

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

export function buildGridSearchUrlsFromGeo(
  keywords: string[],
  location: string,
  geo: GeoCenter,
  expanded = false
): string[] {
  const points = buildGridPoints(geo, expanded);
  const urls = new Set<string>();

  for (const keyword of keywords) {
    for (const point of points) {
      urls.add(buildGridSearchUrl(keyword, point, location));
    }
  }

  return [...urls];
}

export async function buildGridSearchUrls(
  keywords: string[],
  location: string,
  expanded = false,
  geo?: GeoCenter | null
): Promise<string[]> {
  let resolvedGeo = geo ?? null;

  if (!resolvedGeo) {
    resolvedGeo = await geocodeCity(location);
  }

  if (!resolvedGeo) {
    logger.info("[search-diag] Grid URLs skipped — geocoding unavailable", {
      location,
    });
    return [];
  }

  const urlList = buildGridSearchUrlsFromGeo(
    keywords,
    location,
    resolvedGeo,
    expanded
  );

  logger.info("[search-diag] Grid URLs generated", {
    location,
    keywordCount: keywords.length,
    gridPoints: buildGridPoints(resolvedGeo, expanded).length,
    totalUrls: urlList.length,
    geo: resolvedGeo,
    sampleUrls: urlList.slice(0, 3),
  });

  return urlList;
}

export function expandGeoRadius(geo: GeoCenter): GeoCenter {
  return { ...geo, radiusKm: geo.radiusKm * 1.5 };
}
