import { logger } from "../utils/logger";
import {
  cleanLocationInput,
  geocodeNominatimDetailed,
  type NominatimGeocodeHit,
  searchCitiesInNominatimRegion,
} from "../scraper/googleMaps/grid-search";

export interface RegionCitySuggestion {
  city: string;
  label: string;
}

export interface BroadRegionCheckResult {
  isBroadRegion: boolean;
  message?: string;
  citySuggestions?: RegionCitySuggestion[];
  regionLabel?: string;
}

/** Below this result count, broad-region city chips are shown alongside results. */
export const LOW_RESULT_REGION_THRESHOLD = 50;

/**
 * Administrative areas larger than this (km²) are treated as broad regions
 * (states, provinces, large countries). Compact areas stay searchable as cities.
 */
const BROAD_REGION_AREA_KM2 = 30_000;

const CITY_PLACE_TYPES = new Set([
  "city",
  "town",
  "village",
  "hamlet",
  "suburb",
  "borough",
  "municipality",
  "quarter",
  "neighbourhood",
  "locality",
]);

export function boundingBoxAreaKm2(
  box?: [number, number, number, number]
): number | null {
  if (!box || box.length !== 4) return null;
  const [south, north, west, east] = box;
  if (![south, north, west, east].every(Number.isFinite)) return null;
  const latMid = (south + north) / 2;
  const latKm = Math.abs(north - south) * 111;
  const lngKm =
    Math.abs(east - west) * 111 * Math.cos((latMid * Math.PI) / 180);
  return latKm * lngKm;
}

function hasCityLevelAddress(address?: Record<string, string>): boolean {
  if (!address) return false;
  return Boolean(
    address.city ||
      address.town ||
      address.village ||
      address.municipality ||
      address.borough
  );
}

type NominatimHitFields = Pick<
  NominatimGeocodeHit,
  "type" | "class" | "address" | "placeRank" | "osmType" | "boundingBox"
>;

export function isCityLevelNominatimHit(hit: NominatimHitFields): boolean {
  const { type, class: className, address, placeRank, osmType, boundingBox } =
    hit;

  if (hasCityLevelAddress(address)) return true;

  if (className === "place" && type && CITY_PLACE_TYPES.has(type)) return true;

  if (
    osmType === "node" &&
    className === "place" &&
    type &&
    CITY_PLACE_TYPES.has(type)
  ) {
    return true;
  }

  // place_rank 12+ covers cities, towns, and local admin units like Dubai (rank 25).
  if (placeRank != null && placeRank >= 12) return true;

  const area = boundingBoxAreaKm2(boundingBox);
  if (area != null && area <= BROAD_REGION_AREA_KM2) return true;

  return false;
}

export function isBroadRegionNominatimHit(hit: NominatimHitFields): boolean {
  if (isCityLevelNominatimHit(hit)) return false;

  const { type, class: className, address, placeRank, boundingBox } = hit;
  const area = boundingBoxAreaKm2(boundingBox);
  const isLargeArea = area == null || area > BROAD_REGION_AREA_KM2;

  if (type === "country" || placeRank === 4) {
    return isLargeArea;
  }

  if (placeRank != null && placeRank <= 10) {
    return isLargeArea;
  }

  if (type === "state" || type === "province" || type === "region") {
    return isLargeArea;
  }

  const hasState = Boolean(
    address?.state ||
      address?.region ||
      address?.province ||
      address?.state_district
  );
  const hasCountry = Boolean(address?.country);

  if (hasState && !hasCityLevelAddress(address)) {
    return isLargeArea;
  }
  if (hasCountry && !hasState && !hasCityLevelAddress(address)) {
    return isLargeArea;
  }

  if (className === "boundary" && type === "administrative") {
    return isLargeArea;
  }

  return false;
}

export async function checkBroadRegionLocation(
  location: string,
  businessType?: string
): Promise<BroadRegionCheckResult> {
  const cleaned = cleanLocationInput(location, businessType) || location.trim();
  if (!cleaned) {
    return { isBroadRegion: false };
  }

  const geocoded = await geocodeNominatimDetailed(cleaned);
  if (!geocoded?.hit) {
    return { isBroadRegion: false };
  }

  const hit = geocoded.hit;
  const { type, class: className, displayName, address, boundingBox } = hit;
  const broad = isBroadRegionNominatimHit(hit);
  const areaKm2 = boundingBoxAreaKm2(boundingBox);

  logger.info("[search-diag] Region classification", {
    location: cleaned,
    type,
    class: className,
    displayName,
    placeRank: hit.placeRank,
    importance: hit.importance,
    osmType: hit.osmType,
    areaKm2: areaKm2 != null ? Math.round(areaKm2) : null,
    hasCityAddress: hasCityLevelAddress(address),
    isBroadRegion: broad,
  });

  if (!broad) {
    return { isBroadRegion: false };
  }

  const citySuggestions = await searchCitiesInNominatimRegion(
    address ?? {},
    10,
    boundingBox
  );
  if (citySuggestions.length === 0) {
    logger.warn("[search-diag] Broad region detected but no cities returned", {
      location: cleaned,
      displayName,
    });
    return { isBroadRegion: false };
  }

  return {
    isBroadRegion: true,
    regionLabel: displayName ?? cleaned,
    message:
      "This search covers a large area. Pick a specific city below for more focused results.",
    citySuggestions,
  };
}

export async function getSoftRegionCitySuggestions(
  location: string,
  totalFound: number,
  businessType?: string
): Promise<BroadRegionCheckResult> {
  if (totalFound >= LOW_RESULT_REGION_THRESHOLD) {
    return { isBroadRegion: false };
  }

  const check = await checkBroadRegionLocation(location, businessType);
  if (!check.isBroadRegion || !check.citySuggestions?.length) {
    return { isBroadRegion: false };
  }

  return {
    ...check,
    message:
      check.message ??
      "Your search returned limited results for this large area. Try a specific city below for more focused leads.",
  };
}
