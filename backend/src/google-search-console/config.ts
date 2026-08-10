export const GSC_READONLY_SCOPE = "https://www.googleapis.com/auth/webmasters.readonly";

export function getGscClientId(): string | null {
  return process.env.GOOGLE_SEARCH_CONSOLE_CLIENT_ID?.trim() || null;
}

export function getGscClientSecret(): string | null {
  return process.env.GOOGLE_SEARCH_CONSOLE_CLIENT_SECRET?.trim() || null;
}

export function getGscRedirectUri(): string {
  return (
    process.env.GOOGLE_SEARCH_CONSOLE_REDIRECT_URI?.trim() ||
    "https://backend.leadthur.com/admin/integrations/google-search-console/callback"
  );
}

export function getGscSiteUrl(): string {
  const raw =
    process.env.GOOGLE_SEARCH_CONSOLE_SITE_URL?.trim() || "https://leadthur.com/";
  // Domain properties use sc-domain:host (no trailing slash).
  if (raw.startsWith("sc-domain:")) return raw;
  return raw.endsWith("/") ? raw : `${raw}/`;
}

/**
 * Pick the actual Search Console property URL from sites.list.
 * Env may be https://leadthur.com/ while Google only has sc-domain:leadthur.com.
 */
export function pickSearchConsoleSiteUrl(
  sites: string[],
  preferred: string = getGscSiteUrl()
): string | null {
  if (!sites.length) return null;
  const preferredNorm = preferred.replace(/\/$/, "");
  const candidates = [
    preferred,
    preferredNorm,
    preferredNorm.endsWith("/") ? preferredNorm : `${preferredNorm}/`,
    "sc-domain:leadthur.com",
    "https://leadthur.com/",
    "https://leadthur.com",
    "https://www.leadthur.com/",
    "https://www.leadthur.com",
    "sc-domain:www.leadthur.com",
  ];
  for (const candidate of candidates) {
    if (sites.includes(candidate)) return candidate;
    const found = sites.find((s) => s.replace(/\/$/, "") === candidate.replace(/\/$/, ""));
    if (found) return found;
  }
  const fuzzy = sites.find((s) => s.toLowerCase().includes("leadthur.com"));
  return fuzzy || null;
}

export function isGscConfigured(): boolean {
  return Boolean(getGscClientId() && getGscClientSecret() && getGscRedirectUri() && getGscSiteUrl());
}

/** Safe config fingerprint for Admin — never returns secrets. */
export function getGscConfigStatus(): {
  configured: boolean;
  clientIdPresent: boolean;
  clientSecretPresent: boolean;
  redirectUriPresent: boolean;
  siteUrl: string;
  scope: string;
} {
  return {
    configured: isGscConfigured(),
    clientIdPresent: Boolean(getGscClientId()),
    clientSecretPresent: Boolean(getGscClientSecret()),
    redirectUriPresent: Boolean(process.env.GOOGLE_SEARCH_CONSOLE_REDIRECT_URI?.trim()),
    siteUrl: getGscSiteUrl(),
    scope: GSC_READONLY_SCOPE,
  };
}
