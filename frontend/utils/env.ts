const PRODUCTION_BACKEND = "https://backend.leadthur.com";

/**
 * API base URL from build-time env (NEXT_PUBLIC_*).
 * Relative paths (e.g. `/backend`) are same-origin proxies in the browser;
 * on the server they resolve to BACKEND_ORIGIN for direct upstream calls.
 */
export function getApiUrl(): string {
  const url = process.env.NEXT_PUBLIC_API_URL?.trim();
  if (!url) return "";

  const cleaned = url.replace(/\/$/, "");

  if (cleaned.startsWith("/") && !cleaned.startsWith("//")) {
    if (typeof window === "undefined") {
      const origin =
        process.env.BACKEND_ORIGIN?.trim().replace(/\/$/, "") || PRODUCTION_BACKEND;
      return origin;
    }
    return cleaned;
  }

  return cleaned;
}

export function getSupabaseConfig(): {
  url: string | undefined;
  anonKey: string | undefined;
} {
  return {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL?.trim(),
    anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim(),
  };
}

/** True when a thrown value is a browser/Node network failure (often shown as "fetch failed"). */
export function isNetworkFetchError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const msg = err.message.toLowerCase();
  return (
    err.name === "TypeError" ||
    msg === "fetch failed" ||
    msg.includes("failed to fetch") ||
    msg.includes("networkerror") ||
    msg.includes("load failed") ||
    msg.includes("network request failed")
  );
}

export function networkFetchErrorMessage(action = "request"): string {
  return `Could not reach the server to ${action}. Check your connection, disable VPN/ad-block for this site, then try again. If it keeps failing, open https://www.leadthur.com/activate (with www) or WhatsApp 09067285890.`;
}
