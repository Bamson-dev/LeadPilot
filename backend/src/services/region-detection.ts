import { logger } from "../utils/logger";
import {
  cleanLocationInput,
  geocodeNominatimDetailed,
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

export function isCityLevelNominatimHit(
  type?: string,
  className?: string,
  address?: Record<string, string>
): boolean {
  if (hasCityLevelAddress(address)) return true;
  return className === "place" && Boolean(type && CITY_PLACE_TYPES.has(type));
}

export function isBroadRegionNominatimHit(
  type?: string,
  className?: string,
  address?: Record<string, string>
): boolean {
  if (isCityLevelNominatimHit(type, className, address)) return false;

  if (hasCityLevelAddress(address)) return false;

  if (type === "country") return true;

  const hasState = Boolean(
    address?.state || address?.region || address?.province || address?.state_district
  );
  const hasCountry = Boolean(address?.country);

  if (hasState && !hasCityLevelAddress(address)) return true;
  if (hasCountry && !hasState && !hasCityLevelAddress(address)) return true;

  if (type === "state" || type === "province" || type === "region") return true;
  if (className === "boundary" && type === "administrative" && !hasCityLevelAddress(address)) {
    return true;
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

  const { type, class: className, displayName, address, boundingBox } = geocoded.hit;
  const broad = isBroadRegionNominatimHit(type, className, address);

  logger.info("[search-diag] Region classification", {
    location: cleaned,
    type,
    class: className,
    displayName,
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
      "LeadThur works best for specific cities. Pick a city below to search with the same business type.",
    citySuggestions,
  };
}
