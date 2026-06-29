import { EMAIL_FETCH_TIMEOUT_MS } from "../utils/constants";
import { isValidEmail } from "../parsers/email-validation";
import { logger } from "../../utils/logger";
import { resolveEffectiveBusinessWebsite } from "../utils/effective-website";
import { chromium } from "playwright";
import { acquirePlaywrightSlot } from "../browser/playwright-semaphore";
import { getChromiumLaunchOptions } from "../browser/chromium-options";

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

async function fetchPageHtmlWithPlaywright(
  pageUrl: string,
  timeoutMs: number
): Promise<string | null> {
  const release = await acquirePlaywrightSlot();
  let browser = null;
  try {
    logger.info("[email-diag] Launching Playwright browser for email scrape", {
      pageUrl: pageUrl.substring(0, 80),
      timeoutMs,
    });
    browser = await chromium.launch(getChromiumLaunchOptions());
    const page = await browser.newPage({
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    });
    await page.goto(pageUrl, {
      timeout: timeoutMs,
      waitUntil: "domcontentloaded",
    });
    await page.waitForTimeout(1500);
    const html = await page.content();
    logger.info("[email-diag] Playwright page loaded", {
      pageUrl: pageUrl.substring(0, 80),
      htmlLength: html.length,
      mailtoFound: html.toLowerCase().includes("mailto:"),
    });
    return html;
  } catch (err) {
    logger.warn("[email-diag] Playwright page load failed", {
      pageUrl: pageUrl.substring(0, 80),
      error: err instanceof Error ? err.message : "unknown",
    });
    return null;
  } finally {
    await browser?.close().catch(() => undefined);
    release();
  }
}

async function fetchPageHtmlBestEffort(
  pageUrl: string,
  timeoutMs: number
): Promise<string | null> {
  const httpHtml = await fetchPageHtml(pageUrl, timeoutMs);
  if (httpHtml && httpHtml.length > 500) return httpHtml;

  const remaining = Math.max(3000, timeoutMs);
  const playwrightHtml = await fetchPageHtmlWithPlaywright(pageUrl, remaining);
  return playwrightHtml ?? httpHtml;
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

    if (!response.ok) return null;
    return await response.text();
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      logger.warn("Email page fetch timeout", {
        pageUrl: pageUrl.substring(0, 50),
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
  }

  return unique;
}

async function extractEmailsFromPage(pageUrl: string): Promise<string[]> {
  const html = await fetchPageHtml(pageUrl);
  if (!html) return [];
  return parseEmailsFromHtml(html, pageUrl);
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
    /<a[^>]+href=["']([^"']+)["'][^>]*>([^<]*(?:contact|about|reach us)[^<]*)<\/a>/gi;
  let match: RegExpExecArray | null;
  while ((match = anchorRegex.exec(html)) !== null) {
    const href = match[1];
    const text = match[2]?.toLowerCase() ?? "";
    if (
      /contact|about|reach us/i.test(text) ||
      /contact|about|reach/i.test(href)
    ) {
      return resolveInternalUrl(baseUrl, href);
    }
  }
  return findContactPageUrlFromHtml(html, baseUrl);
}

/**
 * Strict website email scrape for background enrichment:
 * mailto → regex → contact page. 10s total timeout per site. No predictions.
 */
export async function scrapeBusinessEmailStrict(
  websiteUrl: string | null | undefined
): Promise<string[]> {
  const siteLabel = websiteUrl?.trim().substring(0, 80) ?? "(empty)";
  logger.info("[email-diag] scrapeBusinessEmailStrict start", {
    websiteUrl: siteLabel,
    method: "http-fetch",
    timeoutMs: EMAIL_FETCH_TIMEOUT_MS,
  });

  if (!websiteUrl?.trim()) {
    logger.info("[email-diag] Skipped — no website URL", { websiteUrl: siteLabel });
    return [];
  }

  const deadline = Date.now() + EMAIL_FETCH_TIMEOUT_MS;
  const timedOut = () => Date.now() >= deadline;

  try {
    const resolved = await resolveEffectiveBusinessWebsite(websiteUrl);
    if (!resolved) {
      logger.warn("[email-diag] Could not resolve effective website", {
        websiteUrl: siteLabel,
      });
      return [];
    }

    logger.info("[email-diag] Resolved website", {
      original: siteLabel,
      resolved: resolved.substring(0, 80),
    });

    let baseUrl = resolved.trim();
    if (!baseUrl.startsWith("http")) baseUrl = `https://${baseUrl}`;
    baseUrl = baseUrl.replace(/\/$/, "");

    const homepageTimeout = Math.max(500, deadline - Date.now());
    logger.info("[email-diag] Fetching homepage", {
      baseUrl: baseUrl.substring(0, 80),
      timeoutMs: homepageTimeout,
    });

    const homepageHtml = await fetchPageHtmlBestEffort(baseUrl, homepageTimeout);
    if (timedOut()) {
      logger.warn("[email-diag] Timed out before homepage loaded", {
        websiteUrl: siteLabel,
      });
      return [];
    }

    if (!homepageHtml) {
      logger.warn("[email-diag] Homepage returned empty HTML", {
        websiteUrl: siteLabel,
        baseUrl: baseUrl.substring(0, 80),
      });
    } else {
      logger.info("[email-diag] Homepage loaded", {
        websiteUrl: siteLabel,
        htmlLength: homepageHtml.length,
      });
      const rawHome = extractEmailsFromHtmlStrict(homepageHtml, true);
      const fromHome = extractEmailsFromHtmlStrict(homepageHtml);
      logger.info("[email-diag] Homepage email scan", {
        websiteUrl: siteLabel,
        rawMatches: rawHome.length,
        afterFilter: fromHome.length,
        mailtoFound: homepageHtml.toLowerCase().includes("mailto:"),
      });
      if (fromHome.length > 0) {
        logger.info("[email-diag] Emails found on homepage", {
          websiteUrl: siteLabel,
          emails: fromHome.slice(0, 3),
        });
        return fromHome.slice(0, 3);
      }
    }

    const contactUrl = homepageHtml
      ? findContactLinkFromHtml(homepageHtml, baseUrl)
      : await findContactPageUrl(baseUrl);

    if (contactUrl && !timedOut()) {
      logger.info("[email-diag] Fetching contact page", {
        websiteUrl: siteLabel,
        contactUrl: contactUrl.substring(0, 80),
      });
      const contactHtml = await fetchPageHtmlBestEffort(
        contactUrl,
        Math.max(500, deadline - Date.now())
      );
      if (contactHtml) {
        const rawContact = extractEmailsFromHtmlStrict(contactHtml, true);
        const fromContact = extractEmailsFromHtmlStrict(contactHtml);
        logger.info("[email-diag] Contact page email scan", {
          websiteUrl: siteLabel,
          rawMatches: rawContact.length,
          afterFilter: fromContact.length,
        });
        if (fromContact.length > 0) {
          logger.info("[email-diag] Emails found on contact page", {
            websiteUrl: siteLabel,
            emails: fromContact.slice(0, 3),
          });
          return fromContact.slice(0, 3);
        }
      } else {
        logger.warn("[email-diag] Contact page returned empty HTML", {
          websiteUrl: siteLabel,
          contactUrl: contactUrl.substring(0, 80),
        });
      }
    } else if (!contactUrl) {
      logger.info("[email-diag] No contact page link found", { websiteUrl: siteLabel });
    }

    logger.info("[email-diag] No emails found", { websiteUrl: siteLabel });
    return [];
  } catch (err) {
    logger.error("[email-diag] scrapeBusinessEmailStrict failed", {
      websiteUrl: siteLabel,
      error: err instanceof Error ? err.message : "unknown",
    });
    return [];
  }
}
