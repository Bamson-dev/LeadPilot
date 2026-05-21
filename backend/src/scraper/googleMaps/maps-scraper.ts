import type { Browser, BrowserContext, Page } from "playwright";
import type { RawLeadInput } from "../../types/scraper";
import { buildLeadFromPanel, waitForDetailPanel } from "../extractors/detail-panel";
import { gotoWithRetry } from "../parsers/page-navigation";
import { dedupeKey, sanitizeLead } from "../utils/data-quality";
import { logger } from "../../utils/logger";
import {
  DETAIL_PANEL_WAIT_MS,
  MAX_LEADS_PER_SEARCH,
  PLACE_PAGE_TIMEOUT_MS,
  PLACE_TIMEOUT_MS,
  SIDEBAR_SCROLL_MAX_ROUNDS,
  SIDEBAR_SCROLL_WAIT_MS,
  SIDEBAR_STABLE_ROUNDS,
} from "../utils/constants";

const SIDEBAR_ARTICLE = 'div[role="feed"] [role="article"]';
const BATCH_SIZE = 5;
const TIMEOUT_MS = 8000;

export interface MapsScrapeOptions {
  query: string;
  location: string;
  onPhase?: (message: string) => void;
  onProgress?: (count: number, max: number) => void;
  onLead?: (lead: RawLeadInput) => void | Promise<void>;
}

async function processWithTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  fallback: T
): Promise<T> {
  const timeout = new Promise<T>((resolve) =>
    setTimeout(() => resolve(fallback), timeoutMs)
  );
  return Promise.race([promise, timeout]);
}

async function dismissConsent(page: Page): Promise<void> {
  for (const sel of ['button:has-text("Accept all")', "#L2AGLb"]) {
    try {
      const btn = page.locator(sel).first();
      if (await btn.isVisible({ timeout: 1500 })) {
        await btn.click({ timeout: 3000 });
        return;
      }
    } catch {
      // continue
    }
  }
}

async function scrollSidebar(page: Page, onPhase?: (m: string) => void): Promise<void> {
  const feed = page.locator('div[role="feed"]').first();
  let prevCount = 0;
  let stableRounds = 0;
  onPhase?.("Scanning businesses in your area…");

  for (let i = 0; i < SIDEBAR_SCROLL_MAX_ROUNDS; i++) {
    try {
      await feed.evaluate((el: HTMLElement) => {
        el.scrollTop = el.scrollHeight;
      });
    } catch {
      await page.mouse.wheel(0, 1600);
    }
    await page.waitForTimeout(SIDEBAR_SCROLL_WAIT_MS);
    const count = await page.locator(SIDEBAR_ARTICLE).count().catch(() => 0);
    if (count === prevCount && count > 0) {
      stableRounds++;
      if (stableRounds >= SIDEBAR_STABLE_ROUNDS) break;
    } else {
      stableRounds = 0;
    }
    prevCount = count;
    if (count >= MAX_LEADS_PER_SEARCH) break;
  }
}

async function collectPlaceUrls(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const results: string[] = [];
    const seen = new Set<string>();
    document.querySelectorAll('div[role="feed"] [role="article"]').forEach((article) => {
      const link = article.querySelector('a[href*="/maps/place/"]') as HTMLAnchorElement | null;
      if (link?.href && !seen.has(link.href)) {
        seen.add(link.href);
        results.push(link.href);
      }
    });
    return results;
  });
}

async function extractBusinessDetails(
  context: BrowserContext,
  placeUrl: string,
  searchTerm: string
): Promise<RawLeadInput | null> {
  const page = await context.newPage();
  try {
    await gotoWithRetry(page, placeUrl, { timeout: PLACE_PAGE_TIMEOUT_MS, retries: 1 });
    await dismissConsent(page);
    await page.waitForTimeout(DETAIL_PANEL_WAIT_MS);
    if (!(await waitForDetailPanel(page, 6000))) return null;
    const lead = await buildLeadFromPanel(page, searchTerm, placeUrl);
    return lead ? sanitizeLead(lead) : null;
  } catch (err) {
    logger.warn("Place scrape failed", {
      url: placeUrl.slice(0, 80),
      error: err instanceof Error ? err.message : "unknown",
    });
    return null;
  } finally {
    await page.close().catch(() => undefined);
  }
}

export async function scrapeGoogleMaps(
  browser: Browser,
  options: MapsScrapeOptions
): Promise<number> {
  const { query, location, onPhase, onProgress, onLead } = options;
  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36",
    viewport: { width: 1400, height: 900 },
  });

  await context.addInitScript(() => {
    Object.defineProperty(navigator, "webdriver", { get: () => undefined });
  });

  const searchPage = await context.newPage();
  const searchUrl = `https://www.google.com/maps/search/${encodeURIComponent(`${query} in ${location}`)}`;
  const seen = new Set<string>();
  let count = 0;

  try {
    await gotoWithRetry(searchPage, searchUrl, { timeout: 45000, retries: 2 });
    await dismissConsent(searchPage);
    onPhase?.("Opening discovery feed…");
    await scrollSidebar(searchPage, onPhase);

    const businessUrls = (await collectPlaceUrls(searchPage)).slice(0, MAX_LEADS_PER_SEARCH);
    if (businessUrls.length === 0) {
      throw new Error("No businesses found. Try a different niche or location.");
    }

    const max = businessUrls.length;
    onProgress?.(0, max);
    onPhase?.("Streaming prospects to your table…");

    for (let i = 0; i < businessUrls.length; i += BATCH_SIZE) {
      const batch = businessUrls.slice(i, i + BATCH_SIZE);
      const results = await Promise.allSettled(
        batch.map((url) =>
          processWithTimeout(
            extractBusinessDetails(context, url, query),
            TIMEOUT_MS,
            null
          )
        )
      );

      for (const result of results) {
        if (result.status !== "fulfilled" || !result.value) continue;
        const lead = result.value;
        const key = dedupeKey(lead);
        if (seen.has(key)) continue;
        seen.add(key);
        count++;
        onProgress?.(count, max);
        if (onLead) void onLead(lead);
      }
    }

    return count;
  } finally {
    await searchPage.close().catch(() => undefined);
    await context.close().catch(() => undefined);
  }
}

/** Async generator wrapper for backward compatibility. */
export async function* scrapeGoogleMapsStream(
  browser: Browser,
  options: MapsScrapeOptions
): AsyncGenerator<RawLeadInput> {
  const buffer: RawLeadInput[] = [];
  let done = false;

  const scrapePromise = scrapeGoogleMaps(browser, {
    ...options,
    onLead: (lead) => {
      buffer.push(lead);
    },
  }).then(() => {
    done = true;
  });

  while (!done || buffer.length > 0) {
    if (buffer.length > 0) {
      yield buffer.shift()!;
    } else {
      await new Promise((r) => setTimeout(r, 50));
    }
  }

  await scrapePromise;
}
