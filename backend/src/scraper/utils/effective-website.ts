import { extractDomainLoose, isMessagingHost } from "./domain-utils";
import { EMAIL_FETCH_TIMEOUT_MS } from "./constants";
import { resolveBusinessWebsite } from "./website-utils";

async function fetchHtml(url: string): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), EMAIL_FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "LeadThur/1.0 (+https://leadthur.com)" },
      redirect: "follow",
    });
    if (!res.ok) return "";
    return await res.text();
  } catch {
    return "";
  } finally {
    clearTimeout(timeout);
  }
}

/** Follow link-in-bio pages (Linktree, etc.) to a real business site when possible. */
export async function resolveEffectiveBusinessWebsite(
  website: string | null | undefined
): Promise<string | null> {
  const base = resolveBusinessWebsite(website);
  if (!base) return null;

  const domain = extractDomainLoose(base);
  if (domain && !isMessagingHost(domain)) return base;
  if (!domain || !isMessagingHost(domain)) return base;

  const html = await fetchHtml(base);
  if (!html) return base;

  const hrefs = [...html.matchAll(/href=["'](https?:\/\/[^"'#]+)["']/gi)].map((m) => m[1]);
  for (const href of hrefs) {
    const candidate = resolveBusinessWebsite(href);
    if (!candidate) continue;
    const host = extractDomainLoose(candidate);
    if (host && !isMessagingHost(host)) return candidate;
  }

  return base;
}
