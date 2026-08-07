/**
 * Site-script hardening for analytics snippets stored in site_settings.
 * Blocks license-theft payloads that read localStorage / cookies, and
 * restricts external script hosts to a known allowlist.
 */

const ALLOWED_SCRIPT_HOSTS = [
  "www.googletagmanager.com",
  "www.google-analytics.com",
  "www.google.com",
  "googleads.g.doubleclick.net",
  "connect.facebook.net",
  "www.facebook.com",
  "static.hotjar.com",
  "script.hotjar.com",
  "www.clarity.ms",
  "scripts.clarity.ms",
  "cdn.segment.com",
  "js.hs-scripts.com",
  "js.hsforms.net",
  "snap.licdn.com",
  "px.ads.linkedin.com",
];

const THEFT_PATTERN =
  /localStorage|sessionStorage|document\.cookie|indexedDB|webkitRequestFileSystem/i;

function hostAllowed(src: string): boolean {
  try {
    const url = new URL(src, "https://www.leadthur.com");
    if (url.protocol !== "https:" && url.protocol !== "http:") return false;
    const host = url.hostname.toLowerCase();
    return ALLOWED_SCRIPT_HOSTS.some(
      (allowed) => host === allowed || host.endsWith(`.${allowed}`)
    );
  } catch {
    return false;
  }
}

export function filterSafeExternalScripts(html: string): string[] {
  if (!html?.trim()) return [];
  const results: string[] = [];
  const regex = /<script[^>]*\ssrc=["']([^"']+)["'][^>]*>/gi;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(html)) !== null) {
    const src = match[1];
    if (hostAllowed(src)) results.push(src);
  }
  return results;
}

export function filterSafeInlineScripts(html: string): string[] {
  if (!html?.trim()) return [];
  const results: string[] = [];
  const regex = /<script(?![^>]*\ssrc=)[^>]*>([\s\S]*?)<\/script>/gi;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(html)) !== null) {
    const body = match[1].trim();
    if (!body) continue;
    if (THEFT_PATTERN.test(body)) continue;
    results.push(body);
  }
  // Raw JS without script tags (legacy admin format)
  if (results.length === 0 && html.trim() && !html.includes("<")) {
    if (!THEFT_PATTERN.test(html)) results.push(html.trim());
  }
  return results;
}
