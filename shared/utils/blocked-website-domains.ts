/** Domains that are not business-owned websites (social, WhatsApp, booking platforms). */
const BLOCKED_EMAIL_SCRAPE_DOMAINS = [
  "wa.me",
  "wa.link",
  "whatsapp.com",
  "facebook.com",
  "instagram.com",
  "twitter.com",
  "x.com",
  "tiktok.com",
  "youtube.com",
  "linkedin.com",
  "fresha.com",
  "booksy.com",
  "treatwell.com",
  "vagaro.com",
  "mindbodyonline.com",
  "mindbody.io",
  "styleseat.com",
  "schedulicity.com",
  "glossgenius.com",
  "square.com",
  "squareup.com",
  "linktr.ee",
  "linkinbio.com",
  "beacons.ai",
  "allmylinks.com",
  "bit.ly",
  "glovoapp.com",
  "calendly.com",
] as const;

function hostnameFromUrl(websiteUrl: string): string | null {
  try {
    let url = websiteUrl.trim();
    if (!url) return null;
    if (!url.startsWith("http")) url = `https://${url}`;
    return new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return null;
  }
}

export function isBlockedEmailScrapeDomain(
  websiteUrl: string | null | undefined
): boolean {
  if (!websiteUrl?.trim()) return false;
  const host = hostnameFromUrl(websiteUrl);
  if (!host) return false;

  return BLOCKED_EMAIL_SCRAPE_DOMAINS.some(
    (blocked) => host === blocked || host.endsWith(`.${blocked}`)
  );
}

export function isScrappableBusinessWebsite(
  websiteUrl: string | null | undefined
): boolean {
  if (!websiteUrl?.trim()) return false;
  return !isBlockedEmailScrapeDomain(websiteUrl);
}

/** Website is a WhatsApp deep link (wa.me / wa.link), not a business-owned domain. */
export function isWhatsappPlatformWebsite(
  websiteUrl: string | null | undefined
): boolean {
  if (!websiteUrl?.trim()) return false;
  const host = hostnameFromUrl(websiteUrl);
  if (!host) return false;
  return host === "wa.me" || host === "wa.link" || host === "whatsapp.com";
}

/** Business has a website field but it is only a third-party platform link. */
export function isPlatformOnlyWebsite(
  websiteUrl: string | null | undefined
): boolean {
  if (!websiteUrl?.trim()) return false;
  return isBlockedEmailScrapeDomain(websiteUrl);
}
