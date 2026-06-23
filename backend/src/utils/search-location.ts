export function parseSearchLocation(location: string): {
  city: string;
  country?: string;
} {
  const trimmed = location.trim();
  if (!trimmed) return { city: "" };

  const parts = trimmed.split(",").map((part) => part.trim()).filter(Boolean);
  if (parts.length >= 2) {
    return {
      city: parts.slice(0, -1).join(", "),
      country: parts[parts.length - 1],
    };
  }

  return { city: trimmed };
}
