const SKIP_HOSTS = [
  "facebook.com",
  "fb.com",
  "instagram.com",
  "twitter.com",
  "x.com",
  "tiktok.com",
  "linkedin.com",
  "youtube.com",
  "google.com",
  "goo.gl",
  "maps.google",
];

export function resolveBusinessWebsite(
  url: string | null | undefined
): string | null {
  if (!url?.trim()) return null;

  let href = url.trim();
  if (!href.startsWith("http")) href = `https://${href}`;

  try {
    const parsed = new URL(href);

    if (
      parsed.hostname.includes("google.") &&
      (parsed.pathname === "/url" || parsed.pathname === "/aclk")
    ) {
      const target =
        parsed.searchParams.get("q") ||
        parsed.searchParams.get("url") ||
        parsed.searchParams.get("adurl");
      if (target) return resolveBusinessWebsite(target);
    }

    const host = parsed.hostname.replace(/^www\./, "");
    if (SKIP_HOSTS.some((s) => host.includes(s))) return null;

    return `${parsed.protocol}//${parsed.host}`;
  } catch {
    return null;
  }
}
