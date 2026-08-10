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
  return raw.endsWith("/") ? raw : `${raw}/`;
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
