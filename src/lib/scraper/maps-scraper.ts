import { chromium, type Browser, type BrowserContext, type Page } from "playwright";
import {
  MAX_LEADS_PER_SEARCH,
  SCRAPE_CONCURRENCY,
  DETAIL_PANEL_WAIT_MS,
  PLACE_PAGE_TIMEOUT_MS,
  EMAIL_MAX_CONCURRENT_CRAWLS,
  SIDEBAR_MIN_LISTINGS,
  SIDEBAR_SCROLL_MAX_ROUNDS,
  SIDEBAR_SCROLL_WAIT_MS,
  SIDEBAR_STABLE_ROUNDS,
} from "../constants";
import type { LeadEmailUpdate, LeadInput } from "../types";
import {
  emailFieldsForLeadEmit,
  parseMapsEmailsFromLead,
  resolveLeadEmailFields,
  shouldCrawlWebsiteForEmail,
} from "../lead-email";
import { extractAllEmailsFromWebsite } from "./email-extractor";
import {
  buildLeadFromPanel,
  waitForDetailPanel,
} from "./detail-panel-extractor";
import { dedupeKey, sanitizeLead } from "./data-quality";
import { gotoWithRetry } from "./page-navigation";
import {
  createScrapeStats,
  logScrape,
  logScrapeSummary,
  type ScrapeStats,
} from "./scraper-logger";

export interface ScrapeCallbacks {
  onProgress: (count: number, max: number) => void;
  onPhase?: (message: string) => void;
  onLead: (lead: LeadInput, leadId: string) => Promise<void>;
  onLeadEmail?: (leadId: string, fields: LeadEmailUpdate) => Promise<void>;
}

let activeEmailJobs = 0;
const emailJobQueue: Array<() => Promise<void>> = [];

function queueEmailCrawl(job: () => Promise<void>): void {
  emailJobQueue.push(job);
  void drainEmailQueue();
}

async function drainEmailQueue(): Promise<void> {
  while (
    activeEmailJobs < EMAIL_MAX_CONCURRENT_CRAWLS &&
    emailJobQueue.length > 0
  ) {
    const job = emailJobQueue.shift();
    if (!job) break;
    activeEmailJobs++;
    void job().finally(() => {
      activeEmailJobs--;
      void drainEmailQueue();
    });
  }
}

export async function waitForPendingEmailJobs(maxMs = 30000): Promise<void> {
  const start = Date.now();
  while (
    (activeEmailJobs > 0 || emailJobQueue.length > 0) &&
    Date.now() - start < maxMs
  ) {
    await new Promise((r) => setTimeout(r, 300));
  }
}

async function emitLead(
  emailContext: BrowserContext,
  lead: LeadInput,
  callbacks: ScrapeCallbacks,
  stats: ScrapeStats
): Promise<void> {
  const leadId = crypto.randomUUID();
  const mapsEmails = parseMapsEmailsFromLead(lead);

  const initialFields = emailFieldsForLeadEmit(
    mapsEmails,
    lead.website,
    lead.category,
    lead.business_name
  );

  if (initialFields.email_source === "generated") {
    stats.emailsGenerated++;
  }

  await callbacks.onLead(
    {
      ...lead,
      ...initialFields,
    },
    leadId
  );

  if (!shouldCrawlWebsiteForEmail(lead.website)) return;

  queueEmailCrawl(async () => {
    let websiteEmails: string[] = [];
    try {
      const result = await extractAllEmailsFromWebsite(
        lead.website!,
        emailContext
      );
      websiteEmails = result.emails;
    } catch (err) {
      logScrape("warn", "Website email crawl failed", {
        website: lead.website,
        error: err instanceof Error ? err.message : "unknown",
      });
    }

    const fields = resolveLeadEmailFields({
      mapsEmails,
      websiteEmails,
      website: lead.website,
      category: lead.category,
      businessName: lead.business_name,
    });

    if (fields.email_source === "extracted") {
      stats.emailsFound++;
    }

    const changed =
      fields.email !== initialFields.email ||
      fields.email_source !== initialFields.email_source;

    if (fields.email && callbacks.onLeadEmail && changed) {
      await callbacks.onLeadEmail(leadId, fields);
    }
  });
}

interface PlaceListing {
  index: number;
  placeUrl: string;
}

async function dismissConsent(page: Page): Promise<void> {
  const selectors = [
    'button:has-text("Accept all")',
    'button:has-text("Accept All")',
    'button:has-text("I agree")',
    'button:has-text("Reject all")',
    "#L2AGLb",
  ];
  for (const sel of selectors) {
    try {
      const btn = page.locator(sel).first();
      if (await btn.isVisible({ timeout: 2000 })) {
        await btn.click({ timeout: 4000 });
        await page.waitForTimeout(1200);
        return;
      }
    } catch {
      // try next
    }
  }
}

/** Scroll sidebar — stop early once enough listings for fast first results */
async function scrollSidebarUntilReady(
  page: Page,
  onPhase?: (msg: string) => void
): Promise<number> {
  const feed = page.locator('div[role="feed"]').first();
  const hasFeed = (await feed.count().catch(() => 0)) > 0;
  const feedLocator = hasFeed
    ? feed
    : page.locator('div[role="feed"], div[role="feed"]').first();

  let prevCount = 0;
  let stableRounds = 0;

  onPhase?.("Scanning businesses in your area…");

  for (let scroll = 0; scroll < SIDEBAR_SCROLL_MAX_ROUNDS; scroll++) {
    try {
      await feedLocator.evaluate((el) => {
        el.scrollTop = el.scrollHeight;
      });
    } catch {
      await page.mouse.wheel(0, 1600);
    }
    await page.waitForTimeout(SIDEBAR_SCROLL_WAIT_MS);

    const count = await page
      .locator('div[role="feed"] [role="article"], div[role="feed"] [role="article"]')
      .count()
      .catch(() => 0);

    if (count >= SIDEBAR_MIN_LISTINGS) {
      onPhase?.(`Found ${count} businesses — loading profiles…`);
      if (count >= MAX_LEADS_PER_SEARCH) break;
      if (stableRounds >= 1 && count === prevCount) break;
    }

    if (count === prevCount && count > 0) {
      stableRounds++;
      if (stableRounds >= SIDEBAR_STABLE_ROUNDS) break;
    } else {
      stableRounds = 0;
    }
    prevCount = count;

    if (count >= MAX_LEADS_PER_SEARCH) break;
  }

  logScrape("info", "Sidebar scroll complete", { listingsVisible: prevCount });
  return prevCount;
}

/** Collect place URLs from sidebar cards only — no preview data extraction */
async function collectPlaceListings(page: Page): Promise<PlaceListing[]> {
  const listings = await page.evaluate(() => {
    const results: { index: number; placeUrl: string }[] = [];
    const seen = new Set<string>();
    const articles = document.querySelectorAll(
      'div[role="feed"] [role="article"], div[role="feed"] [role="article"]'
    );

    articles.forEach((article, index) => {
      const link = article.querySelector(
        'a[href*="/maps/place/"]'
      ) as HTMLAnchorElement | null;
      if (!link?.href || seen.has(link.href)) return;
      seen.add(link.href);
      results.push({ index, placeUrl: link.href });
    });

    return results;
  });

  return listings;
}

async function launchBrowser(): Promise<Browser> {
  const args = [
    "--no-sandbox",
    "--disable-setuid-sandbox",
    "--disable-dev-shm-usage",
    "--disable-blink-features=AutomationControlled",
  ];
  try {
    return await chromium.launch({ headless: true, args });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    if (msg.includes("Executable doesn't exist")) {
      throw new Error(
        "Playwright Chromium is not installed. Run: npx playwright install chromium"
      );
    }
    throw err;
  }
}

/**
 * Click listing on search page → wait for detail panel → extract.
 * Used when parallel workers are not suitable.
 */
async function scrapeViaClickFlow(
  page: Page,
  emailContext: BrowserContext,
  listings: PlaceListing[],
  searchTerm: string,
  stats: ScrapeStats,
  seen: Set<string>,
  callbacks: ScrapeCallbacks
): Promise<number> {
  let count = 0;
  const articles = page.locator(
    'div[role="feed"] [role="article"], div[role="feed"] [role="article"]'
  );
  const max = Math.min(listings.length, MAX_LEADS_PER_SEARCH);

  for (const listing of listings.slice(0, MAX_LEADS_PER_SEARCH)) {
    stats.processed++;
    try {
      const article = articles.nth(listing.index);
      await article.scrollIntoViewIfNeeded({ timeout: 8000 });
      const link = article.locator('a[href*="/maps/place/"]').first();
      await link.click({ timeout: 10000 });
      await page.waitForTimeout(DETAIL_PANEL_WAIT_MS);

      const panelReady = await waitForDetailPanel(page);
      if (!panelReady) {
        logScrape("warn", "Detail panel timeout (click)", { index: listing.index });
        stats.failed++;
        continue;
      }

      const lead = await buildLeadFromPanel(page, searchTerm, page.url());
      if (!lead) {
        stats.failed++;
        continue;
      }

      const sanitized = sanitizeLead(lead);
      if (!sanitized) {
        stats.failed++;
        continue;
      }

      const key = dedupeKey(sanitized);
      if (seen.has(key)) {
        stats.skippedDuplicate++;
        continue;
      }
      seen.add(key);

      if (sanitized.phone) stats.phonesFound++;
      if (sanitized.website) stats.websitesFound++;

      await emitLead(emailContext, sanitized, callbacks, stats);
      count++;
      stats.succeeded++;
      callbacks.onProgress(count, max);
    } catch (err) {
      stats.failed++;
      logScrape("warn", "Click scrape failed", {
        index: listing.index,
        error: err instanceof Error ? err.message : "unknown",
      });
    }
  }

  return count;
}

/** Worker: open place URL → full detail panel → extract */
async function scrapePlaceUrl(
  context: BrowserContext,
  placeUrl: string,
  searchTerm: string,
  stats: ScrapeStats,
  retries = 1
): Promise<LeadInput | null> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    const page = await context.newPage();
    try {
      await gotoWithRetry(page, placeUrl, {
        timeout: PLACE_PAGE_TIMEOUT_MS,
        retries: 2,
      });
      await dismissConsent(page);
      await page.waitForTimeout(DETAIL_PANEL_WAIT_MS);

      const ready = await waitForDetailPanel(page);
      if (!ready) {
        throw new Error("Detail panel did not load");
      }

      const lead = await buildLeadFromPanel(page, searchTerm, placeUrl);
      if (!lead) throw new Error("No extractable data");

      return sanitizeLead(lead);
    } catch (err) {
      lastError = err instanceof Error ? err : new Error("Scrape failed");
      if (attempt < retries) {
        await page.waitForTimeout(1000 * (attempt + 1));
      }
    } finally {
      await page.close().catch(() => undefined);
    }
  }

  logScrape("warn", "Place scrape failed after retries", {
    url: placeUrl.slice(0, 80),
    error: lastError?.message,
  });
  return null;
}

async function runConcurrentPool(
  mapsContext: BrowserContext,
  emailContext: BrowserContext,
  listings: PlaceListing[],
  searchTerm: string,
  stats: ScrapeStats,
  seen: Set<string>,
  callbacks: ScrapeCallbacks
): Promise<number> {
  let count = 0;
  const queue = [...listings.slice(0, MAX_LEADS_PER_SEARCH)];
  const max = queue.length;
  let cursor = 0;

  async function worker(): Promise<void> {
    while (cursor < queue.length && count < MAX_LEADS_PER_SEARCH) {
      const i = cursor++;
      const listing = queue[i];
      stats.processed++;

      const lead = await scrapePlaceUrl(
        mapsContext,
        listing.placeUrl,
        searchTerm,
        stats
      );
      if (!lead) {
        stats.failed++;
        continue;
      }

      const key = dedupeKey(lead);
      if (seen.has(key)) {
        stats.skippedDuplicate++;
        continue;
      }
      seen.add(key);

      if (lead.phone) stats.phonesFound++;
      if (lead.website) stats.websitesFound++;

      await emitLead(emailContext, lead, callbacks, stats);
      count++;
      stats.succeeded++;
      callbacks.onProgress(count, max);
    }
  }

  const workers = Array.from({ length: SCRAPE_CONCURRENCY }, () => worker());
  await Promise.all(workers);
  return count;
}

export async function scrapeGoogleMaps(
  searchTerm: string,
  location: string,
  callbacks: ScrapeCallbacks
): Promise<number> {
  const started = Date.now();
  const stats = createScrapeStats();
  const seen = new Set<string>();
  let browser: Browser | null = null;

  try {
    browser = await launchBrowser();
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    throw new Error(
      `Browser failed to start. Run: npx playwright install chromium — ${msg}`
    );
  }

  let emailContext: BrowserContext | null = null;

  try {
    const context = await browser.newContext({
      userAgent:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
      locale: "en-US",
      viewport: { width: 1400, height: 900 },
      geolocation: { latitude: 6.5244, longitude: 3.3792 },
      permissions: ["geolocation"],
    });

    await context.addInitScript(() => {
      Object.defineProperty(navigator, "webdriver", { get: () => undefined });
    });

    emailContext = await browser.newContext({
      userAgent:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    });

    const searchPage = await context.newPage();
    const query = encodeURIComponent(`${searchTerm} in ${location}`);

    logScrape("info", "Starting search", { searchTerm, location });

    await gotoWithRetry(
      searchPage,
      `https://www.google.com/maps/search/${query}`,
      { timeout: 45000, retries: 2 }
    );

    await dismissConsent(searchPage);
    await searchPage.waitForTimeout(1200);

    callbacks.onPhase?.("Opening discovery feed…");

    await searchPage
      .locator('div[role="feed"] [role="article"], div[role="feed"] [role="article"]')
      .first()
      .waitFor({ state: "visible", timeout: 20000 })
      .catch(() => undefined);

    await scrollSidebarUntilReady(searchPage, callbacks.onPhase);

    let listings = await collectPlaceListings(searchPage);
    stats.listingsFound = listings.length;

    if (listings.length === 0) {
      logScrape("warn", "No listings in sidebar, retrying search URL");
      callbacks.onPhase?.("Retrying discovery…");
      await gotoWithRetry(
        searchPage,
        `https://www.google.com/maps/search/${query}/@6.45,3.47,12z`,
        { timeout: 45000, retries: 2 }
      );
      await dismissConsent(searchPage);
      await scrollSidebarUntilReady(searchPage, callbacks.onPhase);
      listings = await collectPlaceListings(searchPage);
      stats.listingsFound = listings.length;
    }

    if (listings.length === 0) {
      throw new Error(
        "No businesses found. Try a different niche or location."
      );
    }

    logScrape("info", "Listings collected", { count: listings.length });
    const max = Math.min(listings.length, MAX_LEADS_PER_SEARCH);
    callbacks.onProgress(0, max);
    callbacks.onPhase?.("Streaming prospects to your table…");

    // Parallel profile loads — much faster than sequential click flow
    const count = await runConcurrentPool(
      context,
      emailContext,
      listings.slice(0, max),
      searchTerm,
      stats,
      seen,
      callbacks
    );

    await searchPage.close().catch(() => undefined);

    if (count === 0) {
      throw new Error(
        "Could not load business profiles. Try a different search or check your connection."
      );
    }

    await waitForPendingEmailJobs();
    logScrapeSummary(stats, Date.now() - started);
    return count;
  } finally {
    await emailContext?.close().catch(() => undefined);
    await browser?.close().catch(() => undefined);
  }
}
