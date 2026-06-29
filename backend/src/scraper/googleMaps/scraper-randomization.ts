import type { BrowserContext } from "playwright";

export const MAPS_VIEWPORTS = [
  { width: 1366, height: 768 },
  { width: 1920, height: 1080 },
  { width: 1440, height: 900 },
  { width: 1280, height: 800 },
] as const;

export const MAPS_USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:133.0) Gecko/20100101 Firefox/133.0",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
];

export function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function randomDelay(minMs: number, maxMs: number): Promise<void> {
  const ms = randomInt(minMs, maxMs);
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function shuffleArray<T>(array: T[]): T[] {
  const copy = [...array];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function pickRandom<T>(items: T[]): T {
  return items[randomInt(0, items.length - 1)];
}

export function randomZoomLevel(): number {
  return randomInt(13, 15);
}

export async function applyRandomPageFingerprint(
  context: BrowserContext
): Promise<void> {
  const viewport = pickRandom([...MAPS_VIEWPORTS]);
  await context.setExtraHTTPHeaders({
    "Accept-Language": "en-US,en;q=0.9",
  });
  // Viewport is set per-page in scrapeUrlsFromPage via newPage options when possible
  void viewport;
}

export function randomUserAgent(): string {
  return pickRandom(MAPS_USER_AGENTS);
}
