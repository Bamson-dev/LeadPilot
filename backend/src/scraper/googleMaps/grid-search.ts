/**
 * Geocoded grid search for Google Maps URL generation.
 * Divides a city into a 3×3 or 5×5 grid to collect more unique place URLs.
 */

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

/** Approximate centers for common search locations (fallback when geocoding fails). */
const CITY_FALLBACKS: Record<string, GeoCenter> = {
  lagos: { lat: 6.5244, lng: 3.3792, radiusKm: 25, isLargeCity: true },
  london: { lat: 51.5074, lng: -0.1278, radiusKm: 20, isLargeCity: true },
  "new york": { lat: 40.7128, lng: -74.006, radiusKm: 18, isLargeCity: true },
  abuja: { lat: 9.0765, lng: 7.3986, radiusKm: 15, isLargeCity: false },
  ibadan: { lat: 7.3775, lng: 3.947, radiusKm: 12, isLargeCity: false },
  manchester: { lat: 53.4808, lng: -2.2426, radiusKm: 12, isLargeCity: false },
  birmingham: { lat: 52.4862, lng: -1.8904, radiusKm: 12, isLargeCity: false },
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

export async function geocodeCity(location: string): Promise<GeoCenter> {
  const trimmed = location.trim();
  if (!trimmed) return fallbackGeo(location);

  try {
    const params = new URLSearchParams({
      q: trimmed,
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

    if (!res.ok) return fallbackGeo(location);

    const data = (await res.json()) as Array<{
      lat: string;
      lon: string;
      boundingbox?: string[];
      type?: string;
      class?: string;
    }>;

    if (!data.length) return fallbackGeo(location);

    const hit = data[0];
    const lat = parseFloat(hit.lat);
    const lng = parseFloat(hit.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return fallbackGeo(location);
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

    return { lat, lng, radiusKm, isLargeCity };
  } catch {
    return fallbackGeo(location);
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

/** Google Maps search URL centered on a grid point. */
export function buildGridSearchUrl(
  keyword: string,
  point: GridPoint,
  zoom = 14
): string {
  const q = encodeURIComponent(keyword);
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
      urls.add(buildGridSearchUrl(keyword, point));
    }
  }

  return [...urls];
}

export function expandGeoRadius(geo: GeoCenter): GeoCenter {
  return { ...geo, radiusKm: geo.radiusKm * 1.5 };
}
