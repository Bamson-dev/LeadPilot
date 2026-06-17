export function parseSearchLocation(location: string): { city: string; country?: string } {
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

export function formatSearchLocation(city: string, country?: string | null): string {
  const trimmedCity = city.trim();
  const trimmedCountry = country?.trim();
  if (trimmedCity && trimmedCountry) return `${trimmedCity}, ${trimmedCountry}`;
  return trimmedCity;
}

export function formatRelativeSearchTime(iso: string): string {
  const then = new Date(iso).getTime();
  const diffMs = Date.now() - then;
  const minutes = Math.floor(diffMs / 60_000);

  if (minutes < 1) return "Just now";
  if (minutes < 60) {
    return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  }

  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  }

  const days = Math.floor(hours / 24);
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;

  return new Date(iso).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
