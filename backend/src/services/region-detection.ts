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

export function isCityLevelNominatimHit(
  type?: string,
  className?: string
): boolean {
  return className === "place" && Boolean(type && CITY_PLACE_TYPES.has(type));
}

export function isBroadRegionNominatimHit(
  type?: string,
  className?: string
): boolean {
  if (isCityLevelNominatimHit(type, className)) return false;
  if (type === "country") return true;
  if (type === "state" || type === "province" || type === "region") return true;
  if (className === "boundary") return true;
  if (className === "place" && type === "state") return true;
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

  const { type, class: className, displayName, address } = geocoded.hit;
  const broad = isBroadRegionNominatimHit(type, className);

  logger.info("[search-diag] Region classification", {
    location: cleaned,
    type,
    class: className,
    displayName,
    isBroadRegion: broad,
  });

  if (!broad) {
    return { isBroadRegion: false };
  }

  const citySuggestions = await searchCitiesInNominatimRegion(address ?? {}, 10);
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
