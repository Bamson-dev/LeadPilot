/** Map search location text to Maps geolocation for accurate regional results. */
export function getGeoForLocation(location: string): {
  latitude: number;
  longitude: number;
  zoom: number;
} {
  const lower = location.toLowerCase();

  if (
    lower.includes("nigeria") ||
    lower.includes("lagos") ||
    lower.includes("abuja") ||
    lower.includes("port harcourt") ||
    lower.includes("kano") ||
    lower.includes("ibadan") ||
    lower.includes("enugu") ||
    lower.includes("kaduna") ||
    lower.includes("delta state") ||
    lower.includes("delta, nigeria") ||
    lower.includes("delta nigeria") ||
    (lower.includes("delta") && lower.includes("nigeria"))
  ) {
    return { latitude: 6.5244, longitude: 3.3792, zoom: 12 };
  }

  if (
    lower.includes("california") ||
    lower.includes("los angeles") ||
    lower.includes("san francisco") ||
    lower.includes("san diego") ||
    lower.includes("sacramento") ||
    lower.includes("oakland") ||
    lower.includes("fresno") ||
    lower.includes("oakhurst")
  ) {
    return { latitude: 36.7783, longitude: -119.4179, zoom: 10 };
  }

  if (
    lower.includes("new york") ||
    lower.includes("manhattan") ||
    lower.includes("brooklyn") ||
    lower.includes("queens")
  ) {
    return { latitude: 40.7128, longitude: -74.006, zoom: 11 };
  }

  if (
    lower.includes("texas") ||
    lower.includes("houston") ||
    lower.includes("dallas") ||
    lower.includes("austin")
  ) {
    return { latitude: 31.9686, longitude: -99.9018, zoom: 10 };
  }

  if (
    lower.includes("florida") ||
    lower.includes("miami") ||
    lower.includes("orlando") ||
    lower.includes("tampa")
  ) {
    return { latitude: 27.6648, longitude: -81.5158, zoom: 10 };
  }

  if (
    lower.includes("usa") ||
    lower.includes("united states") ||
    lower.includes("u.s.") ||
    /\b(us|usa)\b/.test(lower)
  ) {
    return { latitude: 39.8283, longitude: -98.5795, zoom: 5 };
  }

  if (
    lower.includes("london") ||
    lower.includes("manchester") ||
    lower.includes("birmingham") ||
    lower.includes("uk") ||
    lower.includes("united kingdom") ||
    lower.includes("england")
  ) {
    return { latitude: 51.5074, longitude: -0.1278, zoom: 11 };
  }

  if (lower.includes("ghana") || lower.includes("accra")) {
    return { latitude: 5.6037, longitude: -0.187, zoom: 12 };
  }

  if (lower.includes("kenya") || lower.includes("nairobi")) {
    return { latitude: -1.2921, longitude: 36.8219, zoom: 12 };
  }

  if (
    lower.includes("south africa") ||
    lower.includes("johannesburg") ||
    lower.includes("cape town")
  ) {
    return { latitude: -26.2041, longitude: 28.0473, zoom: 11 };
  }

  if (lower.includes("dubai") || lower.includes("uae")) {
    return { latitude: 25.2048, longitude: 55.2708, zoom: 12 };
  }

  if (
    lower.includes("canada") ||
    lower.includes("toronto") ||
    lower.includes("vancouver")
  ) {
    return { latitude: 43.6532, longitude: -79.3832, zoom: 11 };
  }

  if (lower.includes("australia") || lower.includes("sydney")) {
    return { latitude: -33.8688, longitude: 151.2093, zoom: 11 };
  }

  return { latitude: 20, longitude: 0, zoom: 3 };
}
