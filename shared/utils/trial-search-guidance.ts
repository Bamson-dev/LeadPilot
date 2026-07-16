export type TrialSearchSuggestion = {
  query: string;
  location: string;
};

export type TrialSearchValidation =
  | { ok: true }
  | { ok: false; message: string; suggestion: TrialSearchSuggestion };

/** Curated examples that work well on Google Maps (international). */
export const TRIAL_SEARCH_EXAMPLES: TrialSearchSuggestion[] = [
  { query: "restaurants", location: "London UK" },
  { query: "gyms", location: "Dubai UAE" },
  { query: "dentists", location: "Manchester UK" },
];

const URL_PATTERN = /(https?:\/\/|www\.|\w+\.(com|org|net|io)\/)/i;

const JOB_OR_ROLE_PATTERN =
  /\b(executives?|students?|researchers?|professors?|influencers?|creators?|youtubers?|youtube\s+content|freelancers?|consultants?)\b/i;

const COUNTRY_TOKEN =
  /\b(uk|u\.?s\.?a\.?|us|usa|uae|canada|australia|india|germany|france|spain|italy|greece|russia|china|thailand|mexico|brazil|japan|korea|netherlands|belgium|sweden|norway|denmark|poland|turkey|egypt|south africa)\b/gi;

const VAGUE_LOCATION_ONLY =
  /^(usa|us|u\.s\.a\.?|united states|uk|united kingdom|great britain|canada|australia|world|global|everywhere)$/i;

function commaParts(value: string): string[] {
  return value
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}

function distinctCountryTokens(location: string): number {
  const matches = location.match(COUNTRY_TOKEN) ?? [];
  const normalized = new Set(
    matches.map((token) => token.toLowerCase().replace(/\./g, ""))
  );
  return normalized.size;
}

/**
 * Lightweight guardrails for free-trial searches.
 * Maps needs one business category in one city/area — not lists of roles or countries.
 */
export function validateTrialSearchInput(
  query: string,
  location: string
): TrialSearchValidation {
  const q = query.trim();
  const l = location.trim();
  const fallback = TRIAL_SEARCH_EXAMPLES[0];

  if (!q || !l) {
    return {
      ok: false,
      message: "Enter a business type and a city.",
      suggestion: fallback,
    };
  }

  if (URL_PATTERN.test(q) || URL_PATTERN.test(l)) {
    return {
      ok: false,
      message: "Enter a business type and city — not a website link.",
      suggestion: fallback,
    };
  }

  if (q.includes(",")) {
    return {
      ok: false,
      message: "Search one business type at a time, not a comma-separated list.",
      suggestion: { query: "restaurants", location: l.includes(",") ? "London UK" : l },
    };
  }

  const locationParts = commaParts(l);
  if (locationParts.length >= 3) {
    return {
      ok: false,
      message: "Pick one city or area — not a list of places.",
      suggestion: { query: q, location: "London UK" },
    };
  }

  if (locationParts.length === 2 && distinctCountryTokens(l) >= 2) {
    return {
      ok: false,
      message: "Pick one city or country, not several places at once.",
      suggestion: { query: q, location: "Dubai UAE" },
    };
  }

  if (distinctCountryTokens(l) >= 2) {
    return {
      ok: false,
      message: "Pick one city or country, not several places at once.",
      suggestion: { query: q, location: "Manchester UK" },
    };
  }

  if (JOB_OR_ROLE_PATTERN.test(q)) {
    return {
      ok: false,
      message:
        "Search for a business type (e.g. restaurants, dentists), not a job title or role.",
      suggestion: fallback,
    };
  }

  const normalizedLocation = l.replace(/\s+/g, " ").trim();
  if (VAGUE_LOCATION_ONLY.test(normalizedLocation)) {
    return {
      ok: false,
      message: "Add a specific city, not just a country — e.g. London UK or Dubai UAE.",
      suggestion: { query: q, location: "London UK" },
    };
  }

  return { ok: true };
}
