/** Pure heuristics for Phase 2 email scraping decisions (unit-testable). */

export function isUnscrapableHttpStatus(status: number | null): boolean {
  if (status == null) return false;
  if (status === 403 || status === 429) return true;
  if (status === 520 || status === 521 || status === 522 || status === 523 || status === 524) {
    return true;
  }
  return status >= 500;
}

export function looksLikeChallengeOrErrorPage(html: string): boolean {
  const lower = html.toLowerCase();
  if (lower.includes("cf-error") || lower.includes("cloudflare ray id")) return true;
  if (lower.includes("attention required") && lower.includes("cloudflare")) return true;
  if (html.length < 8_000 && /error code\s*[:\s]*(522|523|524|520|521)/i.test(html)) {
    return true;
  }
  return false;
}

export function resolveDefaultContactPaths(baseUrl: string): string[] {
  const root = baseUrl.replace(/\/$/, "");
  return [
    `${root}/contact`,
    `${root}/contact-us`,
    `${root}/get-in-touch`,
    `${root}/enquiry`,
    `${root}/enquiries`,
    `${root}/reach-us`,
  ];
}

export function resolveDefaultAboutPaths(baseUrl: string): string[] {
  const root = baseUrl.replace(/\/$/, "");
  return [`${root}/about`, `${root}/about-us`];
}
