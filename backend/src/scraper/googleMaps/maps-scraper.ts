import type { Browser, BrowserContext, Page } from "playwright";
import type { RawLeadInput } from "../../types/scraper";
import { buildLeadFromPanel, waitForDetailPanel } from "../extractors/detail-panel";
import { gotoWithRetry } from "../parsers/page-navigation";
import { dedupeKey, sanitizeLead } from "../utils/data-quality";
import { logger } from "../../utils/logger";
import { formatSearchMessage } from "../../utils/search-messages";
import {
  DETAIL_PANEL_WAIT_MS,
  MAX_LEADS_PER_SEARCH,
  PLACE_PAGE_TIMEOUT_MS,
  PLACE_TIMEOUT_MS,
  SIDEBAR_SCROLL_MAX_ROUNDS,
  SIDEBAR_SCROLL_WAIT_MS,
  SIDEBAR_STABLE_ROUNDS,
} from "../utils/constants";

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
  for (const sel of [
    'button:has-text("Accept all")',
    'button:has-text("Accept All")',
    'button:has-text("Reject all")',
    "#L2AGLb",
  ]) {
    try {
      const btn = page.locator(sel).first();
      if (await btn.isVisible({ timeout: 1500 })) {
        await btn.click({ timeout: 3000 });
        await page.waitForTimeout(500);
        return;
      }
    } catch {
      // continue
    }
  }
}

async function detectBlockedPage(page: Page): Promise<string | null> {
  const bodyText = await page.locator("body").innerText().catch(() => "");
  if (/unusual traffic|captcha|not a robot|sorry/i.test(bodyText)) {
    return "Google Maps blocked automated access. Try again in a few minutes.";
  }
  return null;
}

/** Wait until Maps shows listing links or the results feed. */
async function waitForResultsPanel(page: Page, timeoutMs = 28000): Promise<boolean> {
  const selectors = [
    'a[href*="/maps/place/"]',
    'div[role="feed"] [role="article"]',
    'div[role="feed"]',
  ];

  try {
    await Promise.race(
      selectors.map((sel) =>
        page.waitForSelector(sel, { timeout: timeoutMs, state: "attached" })
      )
    );
    return true;
  } catch {
    const deadline = Date.now() + 5000;
    while (Date.now() < deadline) {
      for (const sel of selectors) {
        const count = await page.locator(sel).count().catch(() => 0);
        if (count > 0) return true;
      }
      await page.waitForTimeout(600);
    }
    return false;
  }
}

async function scrollResults(
  page: Page,
  query: string,
  location: string,
  onPhase?: (m: string) => void
): Promise<void> {
  onPhase?.(formatSearchMessage(query, location));

  const feed = page.locator('div[role="feed"]').first();
  const hasFeed = (await feed.count().catch(() => 0)) > 0;

  if (!hasFeed) {
    for (let i = 0; i < 10; i++) {
      await page.mouse.wheel(0, 1400);
      await page.waitForTimeout(SIDEBAR_SCROLL_WAIT_MS);
    }
    return;
  }

  let prevCount = 0;
  let stableRounds = 0;

  for (let i = 0; i < SIDEBAR_SCROLL_MAX_ROUNDS; i++) {
    try {
      await feed.evaluate((el: HTMLElement) => {
        el.scrollTop = el.scrollHeight;
      });
    } catch {
      await page.mouse.wheel(0, 1600);
    }
    await page.waitForTimeout(SIDEBAR_SCROLL_WAIT_MS);

    const count = await page.locator('a[href*="/maps/place/"]').count().catch(() => 0);
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
    document.querySelectorAll('a[href*="/maps/place/"]').forEach((anchor) => {
      const href = (anchor as HTMLAnchorElement).href;
      if (!href || seen.has(href)) return;
      seen.add(href);
      results.push(href);
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
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    viewport: { width: 1400, height: 900 },
    locale: "en-US",
    timezoneId: "Africa/Lagos",
    geolocation: { latitude: 6.5244, longitude: 3.3792 },
    permissions: ["geolocation"],
    extraHTTPHeaders: {
      "Accept-Language": "en-US,en;q=0.9",
    },
  });

  await context.addInitScript(() => {
    Object.defineProperty(navigator, "webdriver", { get: () => undefined });
  });

  const searchPage = await context.newPage();
  const searchUrl = `https://www.google.com/maps/search/${encodeURIComponent(`${query} in ${location}`)}`;
  const seen = new Set<string>();
  let count = 0;

  try {
    logger.info("Maps search starting", { query, location, searchUrl });

    await gotoWithRetry(searchPage, searchUrl, {
      waitUntil: "domcontentloaded",
      timeout: 35000,
      retries: 2,
    });
    await dismissConsent(searchPage);
    await searchPage.waitForTimeout(2500);

    const blocked = await detectBlockedPage(searchPage);
    if (blocked) throw new Error(blocked);

    const panelReady = await waitForResultsPanel(searchPage);
    if (!panelReady) {
      logger.warn("Maps results panel slow — continuing with scroll", { query, location });
    }

    await scrollResults(searchPage, query, location, onPhase);

    let businessUrls = await collectPlaceUrls(searchPage);
    logger.info("Maps place URLs collected", {
      query,
      location,
      count: businessUrls.length,
    });

    if (businessUrls.length === 0) {
      await searchPage.waitForTimeout(3000);
      businessUrls = await collectPlaceUrls(searchPage);
    }

    businessUrls = businessUrls.slice(0, MAX_LEADS_PER_SEARCH);

    if (businessUrls.length === 0) {
      const blockedAgain = await detectBlockedPage(searchPage);
      if (blockedAgain) throw new Error(blockedAgain);
      throw new Error(
        "No businesses found on Google Maps for this search. Try different wording or location."
      );
    }

    const max = businessUrls.length;
    onProgress?.(0, max);
    onPhase?.(
      `Found ${businessUrls.length} businesses for ${query} in ${location}. Extracting details...`
    );

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
