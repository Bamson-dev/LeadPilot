import type { NearbyCitySuggestion } from "@leadthur/shared";

interface CityEntry {
  name: string;
  country: string;
  lat: number;
  lng: number;
}

/** Major cities for nearby suggestions (subset — expandable). */
const MAJOR_CITIES: CityEntry[] = [
  { name: "Lagos", country: "Nigeria", lat: 6.5244, lng: 3.3792 },
  { name: "Abuja", country: "Nigeria", lat: 9.0765, lng: 7.3986 },
  { name: "Ibadan", country: "Nigeria", lat: 7.3775, lng: 3.947 },
  { name: "Port Harcourt", country: "Nigeria", lat: 4.8156, lng: 7.0498 },
  { name: "Kano", country: "Nigeria", lat: 12.0022, lng: 8.592 },
  { name: "Benin City", country: "Nigeria", lat: 6.335, lng: 5.6037 },
  { name: "Enugu", country: "Nigeria", lat: 6.5244, lng: 7.5086 },
  { name: "London", country: "United Kingdom", lat: 51.5074, lng: -0.1278 },
  { name: "Manchester", country: "United Kingdom", lat: 53.4808, lng: -2.2426 },
  { name: "Birmingham", country: "United Kingdom", lat: 52.4862, lng: -1.8904 },
  { name: "Leeds", country: "United Kingdom", lat: 53.8008, lng: -1.5491 },
  { name: "Bristol", country: "United Kingdom", lat: 51.4545, lng: -2.5879 },
  { name: "Liverpool", country: "United Kingdom", lat: 53.4084, lng: -2.9916 },
  { name: "New York", country: "United States", lat: 40.7128, lng: -74.006 },
  { name: "Los Angeles", country: "United States", lat: 34.0522, lng: -118.2437 },
  { name: "Chicago", country: "United States", lat: 41.8781, lng: -87.6298 },
  { name: "Houston", country: "United States", lat: 29.7604, lng: -95.3698 },
  { name: "Accra", country: "Ghana", lat: 5.6037, lng: -0.187 },
  { name: "Nairobi", country: "Kenya", lat: -1.2921, lng: 36.8219 },
  { name: "Johannesburg", country: "South Africa", lat: -26.2041, lng: 28.0473 },
];

function haversineKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function inferCountry(location: string): string | null {
  const lower = location.toLowerCase();
  if (lower.includes("nigeria")) return "Nigeria";
  if (lower.includes("uk") || lower.includes("united kingdom") || lower.includes("england"))
    return "United Kingdom";
  if (lower.includes("usa") || lower.includes("united states")) return "United States";
  if (lower.includes("ghana")) return "Ghana";
  if (lower.includes("kenya")) return "Kenya";
  if (lower.includes("south africa")) return "South Africa";
  return null;
}

export function findNearbyCities(
  location: string,
  centerLat: number,
  centerLng: number,
  maxResults = 5,
  maxDistanceKm = 100
): NearbyCitySuggestion[] {
  const country = inferCountry(location);
  const locationLower = location.toLowerCase();

  const candidates = MAJOR_CITIES.filter((city) => {
    if (country && city.country !== country) return false;
    if (locationLower.includes(city.name.toLowerCase())) return false;
    return true;
  });

  return candidates
    .map((city) => ({
      city: city.country ? `${city.name}, ${city.country}` : city.name,
      distanceKm: Math.round(
        haversineKm(centerLat, centerLng, city.lat, city.lng)
      ),
    }))
    .filter((c) => c.distanceKm > 0 && c.distanceKm <= maxDistanceKm)
    .sort((a, b) => a.distanceKm - b.distanceKm)
    .slice(0, maxResults);
}
