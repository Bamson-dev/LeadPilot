import { resolveBusinessWebsite } from "./website-utils";

const INVALID_HOSTS = new Set([
  "localhost",
  "127.0.0.1",
  "0.0.0.0",
  "example.com",
  "example.org",
  "test.com",
  "invalid",
]);

/** Link-in-bio / chat — not a business mail domain */
const MESSAGING_HOSTS = [
  "wa.me",
  "wa.link",
  "api.whatsapp.com",
  "bit.ly",
  "linktr.ee",
  "lnk.bio",
  "t.me",
  "m.me",
];

/** Root domain only: strips protocol, www, path, query */
export function extractRootDomain(
  url: string | null | undefined
): string | null {
  const resolved = resolveBusinessWebsite(url);
  if (!resolved) return null;

  try {
    const host = new URL(resolved).hostname.replace(/^www\./i, "").toLowerCase();
    return isValidBusinessDomain(host) ? host : null;
  } catch {
    return null;
  }
}

/** Parse domain from partial URLs, bare hostnames, or embedded strings */
export function extractDomainLoose(
  url: string | null | undefined
): string | null {
  const strict = extractRootDomain(url);
  if (strict) return strict;
  if (!url?.trim()) return null;

  const raw = url.trim().replace(/^https?:\/\//i, "").replace(/^www\./i, "");
  const host = raw.split(/[/?#]/)[0]?.toLowerCase();
  if (host && isValidBusinessDomain(host)) return host;

  const match = raw.match(
    /([a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+)/i
  );
  if (match?.[1]) {
    const candidate = match[1].toLowerCase();
    if (isValidBusinessDomain(candidate)) return candidate;
  }

  return null;
}

export function isMessagingHost(host: string): boolean {
  const h = host.toLowerCase();
  return MESSAGING_HOSTS.some((m) => h === m || h.endsWith(`.${m}`));
}

/**
 * Domain for generated emails — ONLY from a real website URL.
 * Never invent domains from business names.
 */
export function resolveGenerationDomain(
  website: string | null | undefined
): string | null {
  if (!website?.trim()) return null;
  const fromWebsite = extractDomainLoose(website);
  if (!fromWebsite || isMessagingHost(fromWebsite)) return null;
  return fromWebsite;
}

export function isValidBusinessDomain(host: string): boolean {
  if (!host || host.length < 4 || !host.includes(".")) return false;
  if (INVALID_HOSTS.has(host)) return false;
  if (MESSAGING_HOSTS.some((h) => host === h || host.endsWith(`.${h}`)))
    return false;
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return false;
  if (host.includes("google.") || host.includes("gstatic.")) return false;

  const labels = host.split(".");
  const tld = labels[labels.length - 1];
  if (!tld || tld.length < 2 || !/^[a-z]{2,24}$/i.test(tld)) return false;

  const domain = labels[labels.length - 2];
  if (!domain || domain.length < 2) return false;

  return /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*$/i.test(
    host
  );
}
