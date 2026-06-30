import { EMAIL_FETCH_TIMEOUT_MS, EMAIL_PLAYWRIGHT_IDLE_MS } from "../utils/constants";
import { isValidEmail, pickBestEmail } from "../parsers/email-validation";
import { logger } from "../../utils/logger";
import { resolveEffectiveBusinessWebsite } from "../utils/effective-website";
import { resolveGenerationDomain } from "../utils/domain-utils";
import { generateEmailsFromWebsite } from "../parsers/email-generator";
import type { Browser, BrowserContext } from "playwright";

export interface EmailCrawlResult {
  emails: string[];
  email: string | null;
  emailSource: "website" | "generated" | "none";
}

export interface WebsiteEmailCrawlResult {
  emails: string[];
  predicted: boolean;
}

const MAX_PAGE_FETCHES = 4;

const SKIP_PREDICTION_DOMAINS = [
  "facebook.com",
  "instagram.com",
  "twitter.com",
  "linkedin.com",
  "tiktok.com",
  "youtube.com",
  "wa.me",
  "whatsapp.com",
  "linktr.ee",
  "wix.com",
  "squarespace.com",
  "weebly.com",
  "wordpress.com",
  "blogspot.com",
  "medium.com",
  "google.com",
  "gmail.com",
  "yahoo.com",
  "hotmail.com",
  "outlook.com",
];

/** Simple domain-pattern predictions when the website crawl finds no addresses. */
export function generatePredictedEmails(websiteUrl: string): string[] {
  if (!websiteUrl) return [];

  try {
    let url = websiteUrl.trim();
    if (!url.startsWith("http")) url = `https://${url}`;

    const urlObj = new URL(url);
    let domain = urlObj.hostname;

    if (domain.startsWith("www.")) {
      domain = domain.slice(4);
    }

    if (SKIP_PREDICTION_DOMAINS.some((skip) => domain.includes(skip))) return [];

    const parts = domain.split(".");
    if (parts.length < 2) return [];

    const predictions = [`info@${domain}`, `contact@${domain}`, `hello@${domain}`];

    return predictions.filter((email) => isValidEmail(email));
  } catch {
    return [];
  }
}

const EMAIL_REGEX = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,6}/g;
const MAILTO_REGEX =
  /mailto:([a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,6})/gi;
const JSON_LD_REGEX =
  /<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi;
const FOOTER_REGEX = /<footer[^>]*>([\s\S]*?)<\/footer>/gi;

/** Return verified emails found on the business website (up to 4 pages). */
export async function crawlEmailsFromWebsite(
  websiteUrl: string | null | undefined
): Promise<WebsiteEmailCrawlResult> {
  if (!websiteUrl) return { emails: [], predicted: false };

  const validEmails = new Set<string>();
  const seenUrls = new Set<string>();
  let fetchCount = 0;

  try {
    const resolved = await resolveEffectiveBusinessWebsite(websiteUrl);
    if (!resolved) return { emails: [], predicted: false };

    let baseUrl = resolved.trim();
    if (!baseUrl.startsWith("http")) {
      baseUrl = `https://${baseUrl}`;
    }
    baseUrl = baseUrl.replace(/\/$/, "");

    const addEmails = (emails: string[]) => {
      for (const email of emails) {
        validEmails.add(email);
      }
    };

    const hasGoodContactEmails = () =>
      Array.from(validEmails).some(
        (e) =>
          e.includes("contact") || e.includes("info") || e.includes("hello")
      ) && validEmails.size >= 2;

    const crawlUrl = async (pageUrl: string, cachedHtml?: string): Promise<void> => {
      if (fetchCount >= MAX_PAGE_FETCHES || seenUrls.has(pageUrl)) return;
      seenUrls.add(pageUrl);
      fetchCount++;

      const emails = cachedHtml
        ? parseEmailsFromHtml(cachedHtml, pageUrl)
        : await extractEmailsFromPage(pageUrl);
      addEmails(emails);
    };

    const homepageHtml = await fetchPageHtml(baseUrl);
    await crawlUrl(baseUrl, homepageHtml ?? undefined);

    const discoveredContact = homepageHtml
      ? findContactPageUrlFromHtml(homepageHtml, baseUrl)
      : await findContactPageUrl(baseUrl);

    const pageQueue = [
      discoveredContact,
      `${baseUrl}/contact`,
      `${baseUrl}/contact-us`,
      `${baseUrl}/about`,
      `${baseUrl}/about-us`,
    ].filter((url): url is string => Boolean(url));

    for (const pageUrl of pageQueue) {
      if (fetchCount >= MAX_PAGE_FETCHES) break;
      if (hasGoodContactEmails()) break;
      await crawlUrl(pageUrl);
    }

    const pagesFetched = fetchCount;

    if (validEmails.size === 0) {
      const predicted = generatePredictedEmails(websiteUrl);
      if (predicted.length > 0) {
        logger.info("No emails found — using predictions", {
          websiteUrl: websiteUrl.substring(0, 50),
          predicted,
          pagesFetched,
        });
        return { emails: predicted, predicted: true };
      }
    }

    const result = prioritizeEmails(Array.from(validEmails));
    logger.info("Email crawl complete", {
      websiteUrl: websiteUrl.substring(0, 50),
      emailsFound: validEmails.size,
      pagesFetched,
      emails: Array.from(validEmails),
    });
    return { emails: result, predicted: false };
  } catch (err) {
    logger.error("Email crawl failed", {
      websiteUrl: websiteUrl.substring(0, 50),
      error: err instanceof Error ? err.message : "unknown",
    });
    return { emails: [], predicted: false };
  }
}

const EMAIL_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

/** Shared browser context for email scraping — one context, many tabs. */
export async function createEmailBrowserContext(
  browser: Browser
): Promise<BrowserContext> {
  return browser.newContext({
    userAgent: EMAIL_USER_AGENT,
    locale: "en-US",
    extraHTTPHeaders: { "Accept-Language": "en-US,en;q=0.9" },
  });
}

async function fetchRenderedHtmlWithPlaywright(
  context: BrowserContext,
  pageUrl: string,
  timeoutMs = EMAIL_FETCH_TIMEOUT_MS
): Promise<string | null> {
  const page = await context.newPage();
  try {
    logger.info("[email-diag] Playwright tab opening", {
      pageUrl: pageUrl.substring(0, 80),
      timeoutMs,
    });

    const response = await page.goto(pageUrl, {
      timeout: timeoutMs,
      waitUntil: "domcontentloaded",
    });

    logger.info("[email-diag] Playwright page goto complete", {
      pageUrl: pageUrl.substring(0, 80),
      httpStatus: response?.status() ?? null,
    });

    await Promise.race([
      page
        .waitForLoadState("networkidle", { timeout: EMAIL_PLAYWRIGHT_IDLE_MS })
        .catch(() => undefined),
      page.waitForTimeout(EMAIL_PLAYWRIGHT_IDLE_MS),
    ]);

    const html = await page.content();
    logger.info("[email-diag] Playwright rendered HTML retrieved", {
      pageUrl: pageUrl.substring(0, 80),
      htmlLength: html.length,
      mailtoFound: html.toLowerCase().includes("mailto:"),
      atSymbolCount: (html.match(/@/g) ?? []).length,
    });
    return html;
  } catch (err) {
    logger.warn("[email-diag] Playwright tab load failed", {
      pageUrl: pageUrl.substring(0, 80),
      error: err instanceof Error ? err.message : "unknown",
    });
    return null;
  } finally {
    await page.close().catch(() => undefined);
  }
}

export interface CombinedEmailDiscovery {
  verifiedEmails: string[];
  predictedEmails: string[];
}

/** Build domain-pattern candidates (info@, contact@, category-specific, etc.). */
export function generateDomainPatternEmails(
  websiteUrl: string,
  category?: string | null
): string[] {
  const domain = resolveGenerationDomain(websiteUrl);
  if (!domain) return [];

  if (SKIP_PREDICTION_DOMAINS.some((skip) => domain.includes(skip))) return [];

  const prefixes = new Set([
    "info",
    "contact",
    "hello",
    "support",
    "enquiries",
    "bookings",
    "admin",
  ]);

  if (/salon|beauty|barber|nail/i.test(category ?? "")) {
    prefixes.add("salon");
  }
  if (/hotel|resort|lodge|inn|motel|hospitality/i.test(category ?? "")) {
    prefixes.add("reservations");
  }

  for (const email of generateEmailsFromWebsite(websiteUrl, category, null)) {
    const local = email.split("@")[0]?.toLowerCase();
    if (local) prefixes.add(local);
  }

  return [...prefixes]
    .map((prefix) => `${prefix}@${domain}`)
    .filter(isValidEmail);
}


function dedupeEmails(emails: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of emails) {
    const email = raw.toLowerCase().trim();
    if (!isValidEmail(email) || seen.has(email)) continue;
    seen.add(email);
    out.push(email);
  }
  return out;
}

/**
 * Playwright-rendered page scrape, then domain patterns only when scrape finds nothing.
 */
export async function discoverBusinessEmailsCombined(
  websiteUrl: string | null | undefined,
  options?: {
    category?: string | null;
    businessName?: string | null;
    browserContext?: BrowserContext;
  }
): Promise<CombinedEmailDiscovery> {
  const siteLabel = websiteUrl?.trim().substring(0, 80) ?? "(empty)";
  const category = options?.category ?? null;

  logger.info("[email-diag] discoverBusinessEmailsCombined start", {
    websiteUrl: siteLabel,
    category,
    method: "playwright",
    timeoutMs: EMAIL_FETCH_TIMEOUT_MS,
  });

  if (!websiteUrl?.trim()) {
    logger.info("[email-diag] Skipped — no website URL", { websiteUrl: siteLabel });
    return { verifiedEmails: [], predictedEmails: [] };
  }

  if (!options?.browserContext) {
    logger.warn("[email-diag] No browser context — skipping Playwright scrape", {
      websiteUrl: siteLabel,
    });
    return { verifiedEmails: [], predictedEmails: buildFallbackPredictions(websiteUrl, category) };
  }

  const scraped = await scrapePagesForEmailsWithPlaywright(
    websiteUrl,
    options.browserContext
  );

  const verified = dedupeEmails(scraped.emails);
  let predicted: string[] = [];

  if (verified.length === 0) {
    predicted = buildFallbackPredictions(websiteUrl, category);
    logger.info("[email-diag] No verified emails — using domain pattern fallback", {
      websiteUrl: siteLabel,
      predictedCount: predicted.length,
      predicted: predicted.slice(0, 3),
    });
  } else {
    logger.info("[email-diag] Verified emails found via Playwright — skipping predictions", {
      websiteUrl: siteLabel,
      verifiedCount: verified.length,
      verified: verified.slice(0, 3),
    });
  }

  logger.info("[email-diag] discoverBusinessEmailsCombined result", {
    websiteUrl: siteLabel,
    verifiedCount: verified.length,
    predictedCount: predicted.length,
    htmlLength: scraped.htmlLength,
    mailtoInHtml: scraped.mailtoFound,
  });

  return { verifiedEmails: verified, predictedEmails: predicted };
}

function buildFallbackPredictions(
  websiteUrl: string,
  category?: string | null
): string[] {
  const patterns = generateDomainPatternEmails(websiteUrl, category);
  let predicted = pickBestEmail(patterns, websiteUrl, 3);
  if (predicted.length > 0) return predicted;

  const domain = resolveGenerationDomain(websiteUrl);
  if (!domain) return [];
  return [`info@${domain}`, `contact@${domain}`].filter(isValidEmail);
}

interface PageScrapeResult {
  emails: string[];
  html: string;
  htmlLength: number;
  mailtoFound: boolean;
}

async function scrapePagesForEmailsWithPlaywright(
  websiteUrl: string,
  context: BrowserContext
): Promise<PageScrapeResult> {
  const siteLabel = websiteUrl.trim().substring(0, 80);
  const htmlChunks: string[] = [];

  try {
    const resolved = await resolveEffectiveBusinessWebsite(websiteUrl);
    if (!resolved) {
      logger.warn("[email-diag] Could not resolve effective website", {
        websiteUrl: siteLabel,
      });
      return { emails: [], html: "", htmlLength: 0, mailtoFound: false };
    }

    let baseUrl = resolved.trim();
    if (!baseUrl.startsWith("http")) baseUrl = `https://${baseUrl}`;
    baseUrl = baseUrl.replace(/\/$/, "");

    logger.info("[email-diag] Playwright scraping homepage", {
      websiteUrl: siteLabel,
      baseUrl: baseUrl.substring(0, 80),
    });

    const homepageHtml = await fetchRenderedHtmlWithPlaywright(context, baseUrl);
    if (!homepageHtml) {
      logger.warn("[email-diag] Playwright homepage returned empty HTML", {
        websiteUrl: siteLabel,
      });
      return { emails: [], html: "", htmlLength: 0, mailtoFound: false };
    }

    htmlChunks.push(homepageHtml);
    const fromHome = extractEmailsFromHtmlStrict(homepageHtml);
    logger.info("[email-diag] Playwright homepage email scan", {
      websiteUrl: siteLabel,
      htmlLength: homepageHtml.length,
      mailtoFound: homepageHtml.toLowerCase().includes("mailto:"),
      emailsFound: fromHome.length,
      emails: fromHome.slice(0, 3),
    });

    if (fromHome.length > 0) {
      return {
        emails: fromHome,
        html: homepageHtml,
        htmlLength: homepageHtml.length,
        mailtoFound: homepageHtml.toLowerCase().includes("mailto:"),
      };
    }

    const contactUrl = findContactLinkFromHtml(homepageHtml, baseUrl);
    let contactEmails: string[] = [];

    if (contactUrl) {
      logger.info("[email-diag] Playwright scraping contact page", {
        websiteUrl: siteLabel,
        contactUrl: contactUrl.substring(0, 80),
      });
      const contactHtml = await fetchRenderedHtmlWithPlaywright(context, contactUrl);
      if (contactHtml) {
        htmlChunks.push(contactHtml);
        contactEmails = extractEmailsFromHtmlStrict(contactHtml);
        logger.info("[email-diag] Playwright contact page email scan", {
          websiteUrl: siteLabel,
          htmlLength: contactHtml.length,
          emailsFound: contactEmails.length,
          emails: contactEmails.slice(0, 3),
        });
      } else {
        logger.warn("[email-diag] Playwright contact page returned empty HTML", {
          websiteUrl: siteLabel,
          contactUrl: contactUrl.substring(0, 80),
        });
      }
    } else {
      logger.info("[email-diag] No contact page link found in rendered HTML", {
        websiteUrl: siteLabel,
      });
    }

    const combinedHtml = htmlChunks.join("\n");
    const emails = dedupeEmails([...fromHome, ...contactEmails]);
    return {
      emails,
      html: combinedHtml,
      htmlLength: combinedHtml.length,
      mailtoFound: combinedHtml.toLowerCase().includes("mailto:"),
    };
  } catch (err) {
    logger.error("[email-diag] scrapePagesForEmailsWithPlaywright failed", {
      websiteUrl: siteLabel,
      error: err instanceof Error ? err.message : "unknown",
    });
    return { emails: [], html: "", htmlLength: 0, mailtoFound: false };
  }
}

async function fetchPageHtml(pageUrl: string, timeoutMs = EMAIL_FETCH_TIMEOUT_MS): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    const response = await fetch(pageUrl, {
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
      },
      redirect: "follow",
    });

    clearTimeout(timeout);

    logger.info("[email-diag] HTTP fetch response", {
      pageUrl: pageUrl.substring(0, 80),
      status: response.status,
      ok: response.ok,
    });

    if (!response.ok) {
      logger.warn("[email-diag] HTTP fetch failed", {
        pageUrl: pageUrl.substring(0, 80),
        status: response.status,
      });
      return null;
    }

    const text = await response.text();
    logger.info("[email-diag] HTTP fetch body retrieved", {
      pageUrl: pageUrl.substring(0, 80),
      htmlLength: text.length,
      mailtoFound: text.toLowerCase().includes("mailto:"),
    });
    return text;
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      logger.warn("[email-diag] Email page fetch timeout", {
        pageUrl: pageUrl.substring(0, 80),
        timeoutMs,
      });
    } else {
      logger.warn("[email-diag] Email page fetch error", {
        pageUrl: pageUrl.substring(0, 80),
        error: err instanceof Error ? err.message : "unknown",
      });
    }
    return null;
  }
}

function parseEmailsFromHtml(html: string, pageUrl?: string): string[] {
  const found: string[] = [];

  let match: RegExpExecArray | null;
  while ((match = MAILTO_REGEX.exec(html)) !== null) {
    const email = match[1].toLowerCase().trim();
    if (isValidEmail(email)) found.push(email);
  }
  MAILTO_REGEX.lastIndex = 0;

  const allMatches = html.match(EMAIL_REGEX) || [];
  for (const email of allMatches) {
    const normalized = email.toLowerCase().trim();
    if (isValidEmail(normalized)) {
      found.push(normalized);
    }
  }

  while ((match = JSON_LD_REGEX.exec(html)) !== null) {
    try {
      const jsonData = JSON.parse(match[1]);
      const jsonStr = JSON.stringify(jsonData);
      const schemaEmails = jsonStr.match(EMAIL_REGEX) || [];
      for (const email of schemaEmails) {
        const normalized = email.toLowerCase();
        if (isValidEmail(normalized)) {
          found.push(normalized);
        }
      }
    } catch {
      continue;
    }
  }
  JSON_LD_REGEX.lastIndex = 0;

  while ((match = FOOTER_REGEX.exec(html)) !== null) {
    const footerHtml = match[1];
    const footerMailtos = footerHtml.match(MAILTO_REGEX) || [];
    for (const raw of footerMailtos) {
      const emailMatch = raw.match(
        /mailto:([a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,6})/i
      );
      if (emailMatch?.[1] && isValidEmail(emailMatch[1].toLowerCase())) {
        found.push(emailMatch[1].toLowerCase());
      }
    }
    const footerEmails = footerHtml.match(EMAIL_REGEX) || [];
    for (const email of footerEmails) {
      const normalized = email.toLowerCase().trim();
      if (isValidEmail(normalized)) {
        found.push(normalized);
      }
    }
  }
  FOOTER_REGEX.lastIndex = 0;

  const unique = [...new Set(found)];
  if (unique.length > 0 && pageUrl) {
    logger.info("Emails found on page", {
      pageUrl: pageUrl.substring(0, 50),
      count: unique.length,
    });
  } else if (unique.length === 0 && html.includes("@") && pageUrl) {
    const rawMatches = html.match(EMAIL_REGEX) || [];
    logger.info("[email-diag] @ in HTML but no valid emails after filtering", {
      pageUrl: pageUrl.substring(0, 80),
      rawMatchCount: rawMatches.length,
      sampleRaw: rawMatches.slice(0, 5).map((e) => e.substring(0, 60)),
      mailtoCount: (html.match(/mailto:/gi) || []).length,
    });
  }

  return unique;
}

async function extractEmailsFromPage(pageUrl: string): Promise<string[]> {
  const html = await fetchPageHtml(pageUrl, EMAIL_FETCH_TIMEOUT_MS);
  if (!html) {
    logger.warn("[email-diag] No HTML retrieved for email extraction", {
      pageUrl: pageUrl.substring(0, 80),
    });
    return [];
  }
  const emails = parseEmailsFromHtml(html, pageUrl);
  if (emails.length === 0) {
    logger.info("[email-diag] Email extraction returned empty", {
      pageUrl: pageUrl.substring(0, 80),
      htmlLength: html.length,
    });
  }
  return emails;
}

function resolveInternalUrl(baseUrl: string, contactPath: string): string {
  if (contactPath.startsWith("http")) return contactPath;
  if (contactPath.startsWith("//")) return `https:${contactPath}`;
  if (contactPath.startsWith("/")) return `${baseUrl}${contactPath}`;
  return `${baseUrl}/${contactPath}`;
}

function findContactPageUrlFromHtml(html: string, baseUrl: string): string | null {
  const contactLinkRegex =
    /href=["']([^"']*contact[^"']*|[^"']*get-in-touch[^"']*|[^"']*reach-us[^"']*|[^"']*enquir[^"']*)[^"']*["']/gi;
  const match = contactLinkRegex.exec(html);
  if (!match) return null;
  return resolveInternalUrl(baseUrl, match[1]);
}

async function findContactPageUrl(baseUrl: string): Promise<string | null> {
  try {
    const html = await fetchPageHtml(baseUrl);
    if (!html) return null;
    return findContactPageUrlFromHtml(html, baseUrl);
  } catch {
    return null;
  }
}

function prioritizeEmails(emails: string[]): string[] {
  if (emails.length === 0) return [];

  const filtered = emails.filter((email) => isValidEmail(email));
  if (filtered.length === 0) return [];

  const priority = [
    "contact",
    "info",
    "hello",
    "enquir",
    "reserv",
    "book",
    "appoint",
    "support",
    "sales",
    "admin",
  ];

  filtered.sort((a, b) => {
    const aScore = priority.findIndex((p) => a.includes(p));
    const bScore = priority.findIndex((p) => b.includes(p));
    if (aScore === -1 && bScore === -1) return 0;
    if (aScore === -1) return 1;
    if (bScore === -1) return -1;
    return aScore - bScore;
  });

  return filtered.slice(0, 3);
}

export async function crawlEmailForWebsite(
  website: string | null | undefined
): Promise<EmailCrawlResult> {
  const { emails, predicted } = await crawlEmailsFromWebsite(website);
  if (emails.length > 0) {
    return {
      emails,
      email: emails[0] ?? null,
      emailSource: predicted ? "generated" : "website",
    };
  }
  return { emails: [], email: null, emailSource: "none" };
}

const GENERIC_EMAIL_LOCALS = new Set([
  "noreply",
  "no-reply",
  "donotreply",
  "example",
  "test",
  "admin",
  "webmaster",
  "postmaster",
  "mailer-daemon",
  "placeholder",
  "sample",
]);

function isGenericPlaceholderEmail(email: string): boolean {
  const local = email.split("@")[0]?.toLowerCase() ?? "";
  return GENERIC_EMAIL_LOCALS.has(local) || local.startsWith("noreply");
}

function filterScrapedEmails(emails: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const raw of emails) {
    const email = raw.toLowerCase().trim();
    if (!isValidEmail(email)) continue;
    if (isGenericPlaceholderEmail(email)) continue;
    if (seen.has(email)) continue;
    seen.add(email);
    result.push(email);
  }
  return result;
}

function extractEmailsFromHtmlStrict(html: string, skipGenericFilter = false): string[] {
  const decoded = html
    .replace(/&#64;/g, "@")
    .replace(/&#x40;/gi, "@")
    .replace(/\[at\]/gi, "@")
    .replace(/\(at\)/gi, "@");

  const found: string[] = [];

  let match: RegExpExecArray | null;
  while ((match = MAILTO_REGEX.exec(decoded)) !== null) {
    const email = match[1].toLowerCase().trim();
    if (isValidEmail(email)) found.push(email);
  }
  MAILTO_REGEX.lastIndex = 0;

  const allMatches = decoded.match(EMAIL_REGEX) || [];
  for (const email of allMatches) {
    const normalized = email.toLowerCase().trim();
    if (isValidEmail(normalized)) found.push(normalized);
  }

  const unique = [...new Set(found)];
  if (skipGenericFilter) return unique;
  return filterScrapedEmails(unique);
}

function findContactLinkFromHtml(html: string, baseUrl: string): string | null {
  const anchorRegex =
    /<a[^>]+href=["']([^"']+)["'][^>]*>([^<]*(?:contact|about|reach|get-in-touch|get in touch)[^<]*)<\/a>/gi;
  let match: RegExpExecArray | null;
  while ((match = anchorRegex.exec(html)) !== null) {
    const href = match[1];
    const text = match[2]?.toLowerCase() ?? "";
    if (
      /contact|about|reach|get-in-touch|get in touch|enquir/i.test(text) ||
      /contact|about|reach|get-in-touch|enquir/i.test(href)
    ) {
      return resolveInternalUrl(baseUrl, href);
    }
  }
  return findContactPageUrlFromHtml(html, baseUrl);
}

/**
 * Strict website email scrape for background enrichment.
 * Combines page scrape with domain-pattern generation (production behaviour).
 */
export async function scrapeBusinessEmailStrict(
  websiteUrl: string | null | undefined,
  options?: {
    category?: string | null;
    businessName?: string | null;
    browserContext?: BrowserContext;
  }
): Promise<string[]> {
  const { verifiedEmails, predictedEmails } = await discoverBusinessEmailsCombined(
    websiteUrl,
    options
  );
  return [...verifiedEmails, ...predictedEmails].slice(0, 3);
}
