import { randomBytes } from "crypto";
import { logger } from "../utils/logger";
import {
  GSC_READONLY_SCOPE,
  getGscClientId,
  getGscClientSecret,
  getGscRedirectUri,
  getGscSiteUrl,
  isGscConfigured,
} from "./config";
import { encryptGscSecret, hashOAuthState } from "./crypto";
import {
  consumeOAuthState,
  createOAuthState,
  purgeExpiredOAuthStates,
  upsertConnection,
} from "./repository";
import { listSearchConsoleSites } from "./client";

const STATE_TTL_MS = 10 * 60 * 1000;

export function buildGoogleAuthorizeUrl(state: string): string {
  const clientId = getGscClientId();
  if (!clientId) throw new Error("GOOGLE_SEARCH_CONSOLE_CLIENT_ID missing");
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: getGscRedirectUri(),
    response_type: "code",
    scope: GSC_READONLY_SCOPE,
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export async function beginOAuthConnect(adminEmail: string): Promise<{ url: string }> {
  if (!isGscConfigured()) {
    throw new Error("Google Search Console is not configured on this server");
  }
  await purgeExpiredOAuthStates();
  const state = randomBytes(32).toString("hex");
  await createOAuthState({
    stateHash: hashOAuthState(state),
    adminEmail: adminEmail.toLowerCase(),
    expiresAt: new Date(Date.now() + STATE_TTL_MS).toISOString(),
  });
  return { url: buildGoogleAuthorizeUrl(state) };
}

type TokenResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  token_type?: string;
  error?: string;
  error_description?: string;
};

export async function exchangeAuthorizationCode(code: string): Promise<{
  accessToken: string;
  refreshToken: string | null;
  scope: string;
}> {
  const clientId = getGscClientId();
  const clientSecret = getGscClientSecret();
  if (!clientId || !clientSecret) {
    throw new Error("Google Search Console OAuth credentials missing");
  }

  const body = new URLSearchParams({
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: getGscRedirectUri(),
    grant_type: "authorization_code",
  });

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const json = (await response.json()) as TokenResponse;
  if (!response.ok || !json.access_token) {
    logger.error("GSC token exchange failed", {
      status: response.status,
      error: json.error || null,
    });
    throw new Error(json.error_description || json.error || "Token exchange failed");
  }
  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token || null,
    scope: json.scope || GSC_READONLY_SCOPE,
  };
}

export async function refreshAccessToken(refreshToken: string): Promise<{
  accessToken: string;
  expiresIn: number;
}> {
  const clientId = getGscClientId();
  const clientSecret = getGscClientSecret();
  if (!clientId || !clientSecret) {
    throw new Error("Google Search Console OAuth credentials missing");
  }
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  });
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const json = (await response.json()) as TokenResponse;
  if (!response.ok || !json.access_token) {
    logger.error("GSC token refresh failed", {
      status: response.status,
      error: json.error || null,
    });
    const err = new Error(json.error_description || json.error || "Token refresh failed");
    (err as Error & { code?: string }).code = json.error || "refresh_failed";
    throw err;
  }
  return {
    accessToken: json.access_token,
    expiresIn: json.expires_in || 3600,
  };
}

export async function revokeRefreshToken(refreshToken: string): Promise<void> {
  try {
    await fetch("https://oauth2.googleapis.com/revoke", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ token: refreshToken }),
    });
  } catch (err) {
    logger.warn("GSC token revoke request failed", {
      error: err instanceof Error ? err.message : "unknown",
    });
  }
}

export async function completeOAuthCallback(input: {
  code?: string | null;
  state?: string | null;
  error?: string | null;
}): Promise<{ ok: true } | { ok: false; reason: string }> {
  if (input.error) {
    return { ok: false, reason: `oauth_denied:${input.error}` };
  }
  if (!input.code || !input.state) {
    return { ok: false, reason: "missing_code_or_state" };
  }

  const consumed = await consumeOAuthState(hashOAuthState(input.state));
  if (!consumed) {
    return { ok: false, reason: "invalid_or_expired_state" };
  }

  try {
    const tokens = await exchangeAuthorizationCode(input.code);
    if (!tokens.refreshToken) {
      return {
        ok: false,
        reason:
          "missing_refresh_token — reconnect with consent prompt so Google returns a refresh token",
      };
    }

    const sites = await listSearchConsoleSites(tokens.accessToken);
    const expected = getGscSiteUrl();
    const normalizedExpected = expected.replace(/\/$/, "");
    const matched = sites.some((s) => {
      const n = s.replace(/\/$/, "");
      return n === normalizedExpected || n === `sc-domain:leadthur.com`;
    });
    // Also accept property listed exactly as configured (with trailing slash).
    const matchedExact = sites.includes(expected) || matched;
    if (!matchedExact) {
      logger.warn("GSC property verification failed", {
        expected,
        siteCount: sites.length,
      });
      return {
        ok: false,
        reason: "property_unavailable — authorized account cannot access the LeadThur Search Console property",
      };
    }

    await upsertConnection({
      site_url: expected,
      refresh_token_encrypted: encryptGscSecret(tokens.refreshToken),
      scopes: tokens.scope.split(/\s+/).filter(Boolean),
      status: "connected",
      connected_at: new Date().toISOString(),
      last_error_at: null,
      last_error_code: null,
      last_error_message: null,
      google_account_email: null,
      next_sync_at: new Date(Date.now() + 60_000).toISOString(),
    });

    return { ok: true };
  } catch (err) {
    logger.error("GSC OAuth callback failed", {
      error: err instanceof Error ? err.message : "unknown",
    });
    return {
      ok: false,
      reason: err instanceof Error ? err.message : "callback_failed",
    };
  }
}
