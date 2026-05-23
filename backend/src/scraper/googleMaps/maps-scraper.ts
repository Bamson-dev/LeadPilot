import type { Browser, BrowserContext, Page } from "playwright";
import type { RawLeadInput } from "../../types/scraper";
import { buildLeadFromPanel, waitForDetailPanel } from "../extractors/detail-panel";
import { gotoWithRetry } from "../parsers/page-navigation";
import { dedupeKey, sanitizeLead } from "../utils/data-quality";
import {
  extractPhoneNumber,
  isValidInternationalPhone,
} from "./extract-phone";
import { normalizePhoneForLocation } from "../utils/phone-validation";
import { logger } from "../../utils/logger";
import { formatSearchMessage } from "../../utils/search-messages";
import {
  acceptGoogleConsent,
  isOnConsentPage,
  seedGoogleConsentCookies,
} from "./google-consent";
import { buildSearchStrategyUrls } from "./search-strategies";
import {
  DETAIL_PANEL_WAIT_MS,
  MAX_LEADS_PER_SEARCH,
  PLACE_GOTO_TIMEOUT_MS,
  PLACE_TIMEOUT_MS,
  SIDEBAR_SCROLL_MAX_ROUNDS,
  SIDEBAR_SCROLL_TIMEOUT_MS,
  SIDEBAR_SCROLL_WAIT_MS,
  SIDEBAR_STABLE_ROUNDS,
} from "../utils/constants";

const BATCH_SIZE = 6;
const EXTRACT_RACE_TIMEOUT_MS = 20000;

export interface MapsScrapeOptions {
  query: string;
  location: string;
  isTrial?: boolean;
  onPhase?: (message: string) => void;
  onProgress?: (count: number, max: number) => void;
  onLead?: (lead: RawLeadInput) => void | Promise<void>;
}

const TRIAL_URL_CAP = 20;
const TRIAL_STRATEGY_LIMIT = 2;

const IRRELEVANT_EXACT_NAMES = new Set([
  "mosque",
  "church",
  "temple",
  "masjid",
  "cathedral",
]);

function isIrrelevantBusinessName(name: string): boolean {
  const nameLower = name.toLowerCase().trim();
  return IRRELEVANT_EXACT_NAMES.has(nameLower);
}

async function waitForBusinessContactPanel(page: Page): Promise<void> {
  await page.waitForSelector("h1", { timeout: 6000 }).catch(() => undefined);
  await page.waitForTimeout(2000);
  await page
    .waitForSelector('[data-item-id*="phone"], a[href^="tel:"]', {
      timeout: 3000,
    })
    .catch(() => undefined);
}

function resolveExtractedPhone(
  raw: string | null | undefined,
  location: string
): string | null {
  if (!raw?.trim() || !isValidInternationalPhone(raw)) return null;
  return normalizePhoneForLocation(raw, location);
}

function deduplicateByPlaceId(urls: string[]): string[] {
  const seen = new Set<string>();
  return urls.filter((url) => {
    const match = url.match(/\/maps\/place\/([^/?]+)/);
    if (!match) return true;
    const placeSlug = match[1];
    if (seen.has(placeSlug)) return false;
    seen.add(placeSlug);
    return true;
  });
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

async function extractWithRetry(
  extractFn: () => Promise<RawLeadInput | null>,
  timeoutMs: number
): Promise<RawLeadInput | null> {
  const result = await processWithTimeout(extractFn(), timeoutMs, null);
  if (result !== null) return result;

  await new Promise((resolve) => setTimeout(resolve, 1000));

  return processWithTimeout(extractFn(), timeoutMs, null);
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
  await page.waitForTimeout(2500);
  if (await isOnConsentPage(page)) {
    await acceptGoogleConsent(page, 6);
  }
}

async function autoScroll(page: Page): Promise<void> {
  try {
    await page.evaluate(async () => {
      await new Promise<void>((resolve) => {
        const feed =
          document.querySelector('[role="feed"]') ||
          document.querySelector('div[aria-label*="Results"]') ||
          document.querySelector(".m6QErb");

        if (!feed) {
          let lastCount = 0;
          let unchanged = 0;

          const interval = setInterval(() => {
            window.scrollBy(0, 500);
            const links = document.querySelectorAll('a[href*="/maps/place/"]').length;

            if (links === lastCount) {
              unchanged++;
              if (unchanged >= 5) {
                clearInterval(interval);
                resolve();
              }
            } else {
              unchanged = 0;
              lastCount = links;
            }
          }, 800);

          setTimeout(() => {
            clearInterval(interval);
            resolve();
          }, 45000);

          return;
        }

        let lastHeight = 0;
        let unchangedCount = 0;

        const interval = setInterval(() => {
          (feed as HTMLElement).scrollTop += 800;

          const el = feed as HTMLElement;
          const newHeight = el.scrollTop + el.clientHeight;
          if (Math.abs(newHeight - lastHeight) < 10) {
            unchangedCount++;
            if (unchangedCount >= 6) {
              clearInterval(interval);
              resolve();
            }
          } else {
            unchangedCount = 0;
            lastHeight = newHeight;
          }
        }, 800);

        setTimeout(() => {
          clearInterval(interval);
          resolve();
        }, 45000);
      });
    });
  } catch (err) {
    logger.warn("Auto-scroll error — continuing with available results", {
      error: err instanceof Error ? err.message : "unknown",
    });
  }
}

async function tryLoadMoreAndScroll(page: Page): Promise<void> {
  try {
    const selectors = [
      'button[jsaction*="pane.paginationSection"]',
      '[aria-label*="Next page"]',
      'button[data-value="Load more"]',
    ];

    for (const sel of selectors) {
      const loadMoreButton = await page.$(sel);
      if (loadMoreButton) {
        await loadMoreButton.click();
        await page.waitForTimeout(2000);
        await autoScroll(page);
        return;
      }
    }
  } catch {
    // No load more button — that is fine
  }
}

const STRATEGY_TIMEOUT_MS = 60_000;

async function scrapeUrlsFromPage(
  context: BrowserContext,
  searchUrl: string,
  query: string,
  location: string
): Promise<string[]> {
  const page = await context.newPage();

  try {
    logger.info("Maps search starting", { searchUrl, query, location });

    await page.setExtraHTTPHeaders({
      "Accept-Language": "en-US,en;q=0.9",
    });

    await page.goto(withMapsLocale(searchUrl), {
      waitUntil: "domcontentloaded",
      timeout: 20000,
    });

    await acceptGoogleConsent(page);

    const blocked = await detectBlockedPage(page);
    if (blocked) {
      logger.warn("Maps strategy blocked", { searchUrl, blocked });
      return [];
    }

    await Promise.race([
      page.waitForSelector('[role="feed"]', { timeout: 15000 }),
      page.waitForSelector('a[href*="/maps/place/"]', { timeout: 15000 }),
    ]).catch(() => {
      logger.warn("Feed selector timeout — attempting extraction anyway", { searchUrl });
    });

    await page.waitForTimeout(2000);

    await autoScroll(page);
    await tryLoadMoreAndScroll(page);

    const urls = await page.evaluate(() => {
      const links = Array.from(
        document.querySelectorAll('a[href*="/maps/place/"]')
      );
      const unique = new Set(links.map((a) => (a as HTMLAnchorElement).href));
      return Array.from(unique);
    });

    logger.info("Maps place URLs collected", {
      count: urls.length,
      searchUrl,
      query,
      location,
    });

    return urls;
  } catch (err) {
    logger.error("Strategy search failed", {
      searchUrl,
      error: err instanceof Error ? err.message : "unknown",
    });
    return [];
  } finally {
    await page.close().catch(() => undefined);
  }
}

async function getBusinessUrls(
  context: BrowserContext,
  query: string,
  location: string,
  isTrial = false
): Promise<string[]> {
  const allUrls = new Set<string>();
  const searchStrategies = buildSearchStrategyUrls(query, location, isTrial);
  const finalStrategies = isTrial
    ? searchStrategies.slice(0, TRIAL_STRATEGY_LIMIT)
    : searchStrategies;
  const urlCap = isTrial ? TRIAL_URL_CAP : MAX_LEADS_PER_SEARCH;

  logger.info("Multi-strategy Maps search", {
    query,
    location,
    strategies: finalStrategies.length,
    isTrial: isTrial || false,
  });

  if (isTrial) {
    for (const strategyUrl of finalStrategies) {
      const urls = await scrapeUrlsFromPage(context, strategyUrl, query, location);
      for (const url of urls) {
        allUrls.add(url);
      }
      if (allUrls.size >= TRIAL_URL_CAP) break;
    }
  } else {
    const results = await Promise.allSettled(
      finalStrategies.map((url) =>
        Promise.race([
          scrapeUrlsFromPage(context, url, query, location),
          new Promise<string[]>((_, reject) =>
            setTimeout(
              () => reject(new Error("Strategy timeout after 60s")),
              STRATEGY_TIMEOUT_MS
            )
          ),
        ])
      )
    );

    for (const result of results) {
      if (result.status === "fulfilled") {
        for (const url of result.value) {
          allUrls.add(url);
        }
      }
    }
  }

  let merged = deduplicateByPlaceId([...allUrls]);

  if (!isTrial && merged.length < 20) {
    logger.warn("Parallel strategies returned low results — trying sequential fallback", {
      query,
      location,
      count: merged.length,
    });

    for (const strategyUrl of finalStrategies) {
      const urls = await scrapeUrlsFromPage(context, strategyUrl, query, location);
      for (const url of urls) {
        allUrls.add(url);
      }
      if (allUrls.size >= 100) break;
    }

    merged = deduplicateByPlaceId([...allUrls]);
    logger.info("Sequential fallback complete", {
      query,
      location,
      total: merged.length,
    });
  }

  logger.info("URL collection complete — starting extraction", {
    query,
    location,
    urlsCollected: merged.length,
    strategiesRun: finalStrategies.length,
    isTrial: isTrial || false,
  });

  return merged.slice(0, urlCap);
}

export async function extractBusinessBasicDetails(
  context: BrowserContext,
  placeUrl: string,
  location: string
): Promise<RawLeadInput | null> {
  const page = await context.newPage();

  try {
    await page.goto(placeUrl, {
      waitUntil: "domcontentloaded",
      timeout: PLACE_GOTO_TIMEOUT_MS,
    });
    await acceptGoogleConsent(page);
    await waitForBusinessContactPanel(page);

    const details = await page.evaluate(() => {
      const getText = (selector: string) =>
        document.querySelector(selector)?.textContent?.trim() || null;

      const name = getText("h1");

      const addressEl =
        document.querySelector('[data-item-id="address"]') ||
        document.querySelector('[aria-label*="Address"]');
      const address =
        addressEl?.getAttribute("aria-label")?.replace("Address:", "").trim() ||
        addressEl?.textContent?.trim() ||
        null;

      const ratingText = document
        .querySelector('[aria-label*="stars"]')
        ?.getAttribute("aria-label");
      const rating = ratingText ? parseFloat(ratingText) : null;

      const reviewText = document
        .querySelector('[aria-label*="reviews"]')
        ?.getAttribute("aria-label");
      const reviewCount = reviewText
        ? parseInt(reviewText.replace(/[^0-9]/g, ""), 10)
        : null;

      const category =
        document.querySelector(".DkEaL")?.textContent?.trim() ||
        document.querySelector('[jsaction*="category"]')?.textContent?.trim() ||
        null;

      return { name, address, rating, reviewCount, category };
    });

    if (!details.name) return null;

    if (isIrrelevantBusinessName(details.name)) {
      logger.warn("Skipping irrelevant result", { name: details.name });
      return null;
    }

    const phone = resolveExtractedPhone(await extractPhoneNumber(page), location);

    const lead: RawLeadInput = {
      business_name: details.name,
      phone,
      address: details.address,
      rating: details.rating,
      reviews_count: details.reviewCount,
      category: details.category,
      email: null,
      extracted_email: null,
      generated_email: null,
      email_source: null,
      website: null,
      google_maps_url: placeUrl,
    };

    return sanitizeLead(lead, location);
  } catch {
    return null;
  } finally {
    await page.close().catch(() => undefined);
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
      timeout: PLACE_GOTO_TIMEOUT_MS,
    });
    await acceptGoogleConsent(page);
    await waitForBusinessContactPanel(page);

    if (!(await waitForDetailPanel(page, 6000))) {
      logger.warn("Business extraction returned null — skipping", { url: placeUrl });
      return null;
    }

    let lead = await buildLeadFromPanel(page, searchTerm, placeUrl, location);

    const panelPhone = lead?.phone
      ? resolveExtractedPhone(lead.phone, location)
      : null;
    const scrapedPhone = resolveExtractedPhone(
      await extractPhoneNumber(page),
      location
    );
    const phone = panelPhone || scrapedPhone;

    if (lead) {
      lead = { ...lead, phone };
    }

    if (lead?.business_name && isIrrelevantBusinessName(lead.business_name)) {
      logger.warn("Skipping irrelevant result", { name: lead.business_name });
      return null;
    }

    const sanitized = lead ? sanitizeLead(lead, location) : null;
    if (sanitized) {
      const emails =
        sanitized.email || sanitized.extracted_email
          ? [sanitized.email || sanitized.extracted_email].filter(Boolean)
          : [];
      logger.info("Business extracted successfully", {
        name: sanitized.business_name,
        hasPhone: !!sanitized.phone,
        phoneValue: sanitized.phone
          ? `${sanitized.phone.substring(0, 10)}...`
          : null,
        hasEmail: emails.length > 0,
        hasWebsite: !!sanitized.website,
        url: placeUrl.substring(0, 60),
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
  const { query, location, onPhase, onProgress, onLead, isTrial } = options;

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
  const seen = new Set<string>();
  let count = 0;

  try {
    onPhase?.(formatSearchMessage(query, location));
    let businessUrls = await getBusinessUrls(context, query, location, isTrial);

    if (businessUrls.length === 0) {
      onPhase?.(formatSearchMessage(query, location));
      const fallbackUrl = `https://www.google.com/maps/search/${encodeURIComponent(`${query} in ${location}`)}`;
      await loadMapsSearchPage(searchPage, fallbackUrl);
      await scrollResults(searchPage, query, location, onPhase);
      const collected = await collectPlaceUrls(searchPage);
      const urlCap = isTrial ? TRIAL_URL_CAP : MAX_LEADS_PER_SEARCH;
      businessUrls = deduplicateByPlaceId(collected).slice(0, urlCap);
    }

    if (businessUrls.length === 0) {
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
    const extractTimeoutMs = isTrial ? EXTRACT_RACE_TIMEOUT_MS : PLACE_TIMEOUT_MS;
    onProgress?.(0, max);
    onPhase?.(
      isTrial
        ? `Scanning ${query} in ${location}. Extracting preview details...`
        : `Found ${businessUrls.length} businesses for ${query} in ${location}. Extracting details...`
    );

    for (let i = 0; i < businessUrls.length; i += BATCH_SIZE) {
      const batch = businessUrls.slice(i, i + BATCH_SIZE);
      const results = await Promise.allSettled(
        batch.map((url, batchIndex) =>
          extractWithRetry(
            () =>
              isTrial
                ? extractBusinessBasicDetails(context, url, location)
                : extractBusinessDetails(
                    context,
                    url,
                    query,
                    location,
                    i + batchIndex + 1,
                    businessUrls.length
                  ),
            extractTimeoutMs
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
