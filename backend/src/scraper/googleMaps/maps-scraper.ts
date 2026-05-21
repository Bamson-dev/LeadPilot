import type { Browser, BrowserContext, Page } from "playwright";
import type { RawLeadInput } from "../../types/scraper";
import { buildLeadFromPanel, waitForDetailPanel } from "../extractors/detail-panel";
import { gotoWithRetry } from "../parsers/page-navigation";
import { dedupeKey, sanitizeLead } from "../utils/data-quality";
import { extractPhoneNumber } from "./extract-phone";
import { normalizePhoneForLocation } from "../utils/phone-validation";
import { logger } from "../../utils/logger";
import { formatSearchMessage } from "../../utils/search-messages";
import {
  acceptGoogleConsent,
  isOnConsentPage,
  seedGoogleConsentCookies,
} from "./google-consent";
import {
  DETAIL_PANEL_WAIT_MS,
  MAX_LEADS_PER_SEARCH,
  PLACE_PAGE_TIMEOUT_MS,
  PLACE_TIMEOUT_MS,
  SIDEBAR_SCROLL_MAX_ROUNDS,
  SIDEBAR_SCROLL_TIMEOUT_MS,
  SIDEBAR_SCROLL_WAIT_MS,
  SIDEBAR_STABLE_ROUNDS,
} from "../utils/constants";

const BATCH_SIZE = 5;

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

function withMapsLocale(url: string): string {
  const parsed = new URL(url);
  parsed.searchParams.set("hl", "en");
  return parsed.toString();
}

async function detectBlockedPage(page: Page): Promise<string | null> {
  if (await isOnConsentPage(page)) {
    return "Google cookie consent blocked the search. Please try again in a minute.";
  }
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

async function tryLoadMoreResults(page: Page): Promise<void> {
  for (const sel of [
    'button[aria-label*="More results"]',
    'button[aria-label*="more results"]',
    'button:has-text("More results")',
    'button:has-text("More places")',
  ]) {
    try {
      const btn = page.locator(sel).first();
      if (await btn.isVisible({ timeout: 600 })) {
        await btn.click({ timeout: 4000 });
        await page.waitForTimeout(2000);
        return;
      }
    } catch {
      // continue
    }
  }
}

async function scrollResults(
  page: Page,
  query: string,
  location: string,
  onPhase?: (m: string) => void
): Promise<void> {
  onPhase?.(formatSearchMessage(query, location));

  const scrollWork = async (): Promise<void> => {
    const feed = page.locator('div[role="feed"]').first();
    const hasFeed = (await feed.count().catch(() => 0)) > 0;

    if (!hasFeed) {
      for (let i = 0; i < 18; i++) {
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

      if (i > 0 && i % 8 === 0) {
        await tryLoadMoreResults(page);
      }

      const count = await countListingsOnPage(page);
      if (count === prevCount && count > 0) {
        stableRounds++;
        if (stableRounds >= SIDEBAR_STABLE_ROUNDS) {
          await tryLoadMoreResults(page);
          const afterMore = await page
            .locator('a[href*="/maps/place/"]')
            .count()
            .catch(() => 0);
          if (afterMore <= count) break;
          stableRounds = 0;
        }
      } else {
        stableRounds = 0;
      }
      prevCount = count;
      if (count >= MAX_LEADS_PER_SEARCH) break;
    }
  };

  await Promise.race([
    scrollWork(),
    new Promise<void>((resolve) => {
      setTimeout(resolve, SIDEBAR_SCROLL_TIMEOUT_MS);
    }),
  ]);
}

async function collectPlaceUrls(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const results: string[] = [];
    const seen = new Set<string>();
    const add = (raw: string | null | undefined) => {
      if (!raw || raw.startsWith("javascript:")) return;
      const href = raw.split("?")[0] || raw;
      if (
        !href.includes("/maps/place/") &&
        !href.includes("google.com/maps/place")
      ) {
        return;
      }
      if (seen.has(href)) return;
      seen.add(href);
      results.push(raw);
    };

    document
      .querySelectorAll(
        'a[href*="/maps/place/"], a[href*="google.com/maps/place"], a.hfpxzc, div[role="article"] a[href*="place"]'
      )
      .forEach((anchor) => add((anchor as HTMLAnchorElement).href));

    return results;
  });
}

async function countListingsOnPage(page: Page): Promise<number> {
  const [links, articles] = await Promise.all([
    page.locator('a[href*="/maps/place/"]').count().catch(() => 0),
    page.locator('div[role="feed"] [role="article"]').count().catch(() => 0),
  ]);
  return Math.max(links, articles);
}

async function logMapsDiagnostics(page: Page, query: string, location: string): Promise<void> {
  const diagnostics = await page
    .evaluate(() => ({
      title: document.title,
      pageUrl: window.location.href,
      placeLinks: document.querySelectorAll('a[href*="/maps/place/"]').length,
      hpfxzc: document.querySelectorAll("a.hfpxzc").length,
      feed: document.querySelectorAll('div[role="feed"]').length,
      feedArticles: document.querySelectorAll('div[role="feed"] [role="article"]').length,
      articles: document.querySelectorAll('[role="article"]').length,
      bodyPreview: document.body.innerText.slice(0, 280).replace(/\s+/g, " "),
    }))
    .catch(() => null);

  logger.warn("Maps scrape diagnostics", { query, location, diagnostics });
}

async function backToResultsList(page: Page): Promise<void> {
  for (const sel of [
    'button[aria-label="Back"]',
    'button[aria-label="Close"]',
    'button[jsaction*="back"]',
  ]) {
    try {
      const btn = page.locator(sel).first();
      if (await btn.isVisible({ timeout: 1200 })) {
        await btn.click({ timeout: 3000 });
        await page.waitForTimeout(700);
        return;
      }
    } catch {
      // try next
    }
  }
  await page.keyboard.press("Escape");
  await page.waitForTimeout(700);
}

/** When listing cards have no place hrefs, open each result in the side panel. */
async function extractLeadsViaFeedClicks(
  page: Page,
  query: string,
  location: string,
  seen: Set<string>,
  onProgress?: (count: number, max: number) => void,
  onLead?: (lead: RawLeadInput) => void | Promise<void>
): Promise<number> {
  const articles = page.locator('div[role="feed"] [role="article"]');
  let articleCount = await articles.count().catch(() => 0);
  if (articleCount === 0) {
    articleCount = await page.locator('[role="article"]').count().catch(() => 0);
  }

  logger.info("Maps feed click fallback", { query, location, articleCount });
  if (articleCount === 0) return 0;

  const max = Math.min(articleCount, MAX_LEADS_PER_SEARCH);
  let count = 0;
  onProgress?.(0, max);

  for (let i = 0; i < max; i++) {
    const article = page.locator('div[role="feed"] [role="article"]').nth(i);
    try {
      await article.scrollIntoViewIfNeeded({ timeout: 8000 });
      await article.click({ timeout: 10000 });
      await page.waitForTimeout(DETAIL_PANEL_WAIT_MS + 500);

      if (!(await waitForDetailPanel(page, 12000))) {
        await backToResultsList(page);
        continue;
      }

      const lead = await buildLeadFromPanel(page, query, page.url(), location);
      await backToResultsList(page);

      if (!lead) continue;
      const sanitized = sanitizeLead(lead, location);
      if (!sanitized) continue;
      const key = dedupeKey(sanitized);
      if (seen.has(key)) continue;
      seen.add(key);
      count++;
      onProgress?.(count, max);
      if (onLead) await onLead(sanitized);
    } catch (err) {
      logger.warn("Feed article click failed", {
        index: i,
        error: err instanceof Error ? err.message : "unknown",
      });
      await backToResultsList(page).catch(() => undefined);
    }
  }

  return count;
}

async function loadMapsSearchPage(page: Page, searchUrl: string): Promise<void> {
  await gotoWithRetry(page, withMapsLocale(searchUrl), {
    waitUntil: "domcontentloaded",
    timeout: 40000,
    retries: 2,
  });
  const consentOk = await acceptGoogleConsent(page);
  if (!consentOk) {
    logger.error("Failed to pass Google consent", { url: page.url().slice(0, 160) });
  }
  await page.waitForLoadState("networkidle", { timeout: 12000 }).catch(() => undefined);
  await page.waitForTimeout(2500);
  if (await isOnConsentPage(page)) {
    await acceptGoogleConsent(page, 6);
  }
}

async function extractBusinessDetails(
  context: BrowserContext,
  placeUrl: string,
  searchTerm: string,
  location: string,
  index: number,
  total: number
): Promise<RawLeadInput | null> {
  const page = await context.newPage();
  try {
    logger.info("Extracting business details", { url: placeUrl, index, total });

    await page.goto(placeUrl, {
      waitUntil: "domcontentloaded",
      timeout: 10000,
    });
    await acceptGoogleConsent(page);
    await page.waitForSelector("h1", { timeout: 5000 }).catch(() => undefined);
    await page.waitForTimeout(1500);

    if (!(await waitForDetailPanel(page, 6000))) {
      logger.warn("Business extraction returned null — skipping", { url: placeUrl });
      return null;
    }

    let lead = await buildLeadFromPanel(page, searchTerm, placeUrl, location);
    if (lead && !lead.phone) {
      const rawPhone = await extractPhoneNumber(page);
      if (rawPhone) {
        lead = { ...lead, phone: normalizePhoneForLocation(rawPhone, location) };
      }
    }

    const sanitized = lead ? sanitizeLead(lead, location) : null;
    if (sanitized) {
      logger.info("Business extracted successfully", {
        name: sanitized.business_name,
        hasPhone: !!sanitized.phone,
        hasEmail: !!(sanitized.email || sanitized.extracted_email),
        hasWebsite: !!sanitized.website,
      });
    } else {
      logger.warn("Business extraction returned null — skipping", { url: placeUrl });
    }

    return sanitized;
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
    timezoneId: "America/Los_Angeles",
    extraHTTPHeaders: {
      "Accept-Language": "en-US,en;q=0.9",
    },
  });

  await context.addInitScript(() => {
    Object.defineProperty(navigator, "webdriver", { get: () => undefined });
  });
  await seedGoogleConsentCookies(context);

  const searchPage = await context.newPage();
  const searchPhrase = `${query} in ${location}`;
  const searchUrl = `https://www.google.com/maps/search/${encodeURIComponent(searchPhrase)}`;
  const seen = new Set<string>();
  let count = 0;

  try {
    logger.info("Maps search starting", { query, location, searchUrl });
    await loadMapsSearchPage(searchPage, searchUrl);

    const blocked = await detectBlockedPage(searchPage);
    if (blocked) throw new Error(blocked);

    const panelReady = await waitForResultsPanel(searchPage);
    if (!panelReady) {
      logger.warn("Maps results panel slow — continuing with scroll", { query, location });
    }

    await scrollResults(searchPage, query, location, onPhase);

    let businessUrls = await collectPlaceUrls(searchPage);
    if (businessUrls.length === 0) {
      await searchPage.waitForTimeout(3500);
      businessUrls = await collectPlaceUrls(searchPage);
    }

    businessUrls = businessUrls.slice(0, MAX_LEADS_PER_SEARCH);

    logger.info("Maps place URLs collected", {
      query,
      location,
      count: businessUrls.length,
    });

    if (businessUrls.length === 0) {
      onPhase?.(formatSearchMessage(query, location));
      const feedCount = await extractLeadsViaFeedClicks(
        searchPage,
        query,
        location,
        seen,
        onProgress,
        onLead
      );
      if (feedCount > 0) return feedCount;
    }

    if (businessUrls.length === 0) {
      const blockedAgain = await detectBlockedPage(searchPage);
      if (blockedAgain) throw new Error(blockedAgain);
      await logMapsDiagnostics(searchPage, query, location);
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
        batch.map((url, batchIndex) =>
          processWithTimeout(
            extractBusinessDetails(
              context,
              url,
              query,
              location,
              i + batchIndex + 1,
              businessUrls.length
            ),
            PLACE_TIMEOUT_MS,
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
        if (onLead) onLead(lead);
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
