import type { BrowserContext, Page } from "playwright";
import {
  EMAIL_CRAWL_PATHS,
  EMAIL_MAX_PAGES_PER_SITE,
  EMAIL_PAGE_READY_MS,
  EMAIL_PAGE_TIMEOUT_MS,
} from "../constants";
import {
  extractAllEmailsFromText,
  formatEmailsForDisplay,
  mergeEmails,
} from "./email-filter";
import { gotoWithRetry } from "./page-navigation";
import { logScrape } from "./scraper-logger";
import { resolveBusinessWebsite } from "./website-utils";

export interface EmailExtractionLog {
  page: string;
  source: string;
  emails: string[];
}

export interface EmailExtractionResult {
  emails: string[];
  pagesVisited: string[];
  logs: EmailExtractionLog[];
}

function logPageEmails(
  logs: EmailExtractionLog[],
  page: string,
  source: string,
  emails: string[]
) {
  if (emails.length > 0) {
    logs.push({ page, source, emails: [...emails] });
  }
}

async function waitForPageReady(page: Page): Promise<void> {
  await page.waitForLoadState("domcontentloaded").catch(() => undefined);
  await page
    .waitForLoadState("networkidle", { timeout: 8000 })
    .catch(() => undefined);
  await page.waitForTimeout(EMAIL_PAGE_READY_MS);
}

async function extractEmailsFromPage(
  page: Page,
  pageUrl: string,
  logs: EmailExtractionLog[]
): Promise<string[]> {
  const collected = new Set<string>();

  const html = await page.content().catch(() => "");
  const fromContent = extractAllEmailsFromText(html);
  fromContent.forEach((e) => collected.add(e));
  logPageEmails(logs, pageUrl, "page.content()", fromContent);

  const browserData = await page.evaluate(() => {
    const regex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
    const results: { source: string; emails: string[] }[] = [];
    const addFromText = (source: string, text: string) => {
      const emails: string[] = [];
      const normalized = text
        .replace(/\s*\[at\]\s*/gi, "@")
        .replace(/\s*\[dot\]\s*/gi, ".");
      for (const m of normalized.matchAll(regex)) {
        emails.push(m[0].toLowerCase());
      }
      if (emails.length) results.push({ source, emails });
    };

    document.querySelectorAll('a[href^="mailto:"]').forEach((a) => {
      const href = a.getAttribute("href") || "";
      const raw = href
        .replace(/^mailto:/i, "")
        .split("?")[0]
        ?.trim()
        .toLowerCase();
      if (raw) results.push({ source: "mailto", emails: [raw] });
    });

    document
      .querySelectorAll(
        "footer, [role='contentinfo'], .footer, #footer, [class*='footer'], [id*='footer'], [class*='contact'], [id*='contact']"
      )
      .forEach((el) => {
        addFromText("footer-html", el.innerHTML || "");
        addFromText("footer-text", el.textContent || "");
      });

    addFromText("body-innerText", document.body?.innerText || "");
    addFromText("body-innerHTML", document.body?.innerHTML || "");

    document.querySelectorAll("script[type='application/ld+json']").forEach(
      (script) => {
        addFromText("json-ld", script.textContent || "");
      }
    );

    document.querySelectorAll("script:not([src])").forEach((script) => {
      const t = script.textContent || "";
      if (t.includes("@")) addFromText("inline-script", t);
    });

    document.querySelectorAll("meta").forEach((meta) => {
      const content = meta.getAttribute("content") || "";
      if (content.includes("@")) addFromText("meta", content);
    });

    return results;
  });

  for (const block of browserData) {
    const normalized = extractAllEmailsFromText(block.emails.join(" "));
    normalized.forEach((e) => collected.add(e));
    logPageEmails(logs, pageUrl, block.source, normalized);
  }

  return [...collected];
}

async function crawlUrl(
  context: BrowserContext,
  url: string,
  logs: EmailExtractionLog[]
): Promise<string[]> {
  const page = await context.newPage();
  try {
    logScrape("info", "Email crawl visiting", { url });
    await gotoWithRetry(page, url, {
      timeout: EMAIL_PAGE_TIMEOUT_MS,
      retries: 2,
    });
    await waitForPageReady(page);
    return await extractEmailsFromPage(page, url, logs);
  } catch (err) {
    logScrape("warn", "Email page failed", {
      url,
      error: err instanceof Error ? err.message : "unknown",
    });
    return [];
  } finally {
    await page.close().catch(() => undefined);
  }
}

/**
 * Playwright-only deep extraction — captures ALL public emails, no quality filter.
 */
export async function extractAllEmailsFromWebsite(
  website: string,
  context: BrowserContext
): Promise<EmailExtractionResult> {
  const logs: EmailExtractionLog[] = [];
  const pagesVisited: string[] = [];
  const allEmails = new Set<string>();

  const baseUrl = resolveBusinessWebsite(website);
  if (!baseUrl) {
    logScrape("warn", "Email skip — could not resolve website", { website });
    return { emails: [], pagesVisited, logs };
  }

  const urlsToVisit = new Set<string>([baseUrl]);
  for (const path of EMAIL_CRAWL_PATHS) {
    try {
      urlsToVisit.add(new URL(path, baseUrl).href);
    } catch {
      // skip
    }
  }

  const homepagePage = await context.newPage();
  try {
    await gotoWithRetry(homepagePage, baseUrl, {
      timeout: EMAIL_PAGE_TIMEOUT_MS,
      retries: 2,
    });
    await waitForPageReady(homepagePage);
    pagesVisited.push(baseUrl);

    const homeEmails = await extractEmailsFromPage(homepagePage, baseUrl, logs);
    homeEmails.forEach((e) => allEmails.add(e));

    const discovered = await homepagePage.evaluate((origin) => {
      const urls = new Set<string>();
      const patterns = /(contact|about|support|team|reach|enquir|book|reserv)/i;
      document.querySelectorAll("a[href]").forEach((a) => {
        try {
          const u = new URL((a as HTMLAnchorElement).href);
          if (u.origin === origin && patterns.test(u.pathname)) {
            urls.add(u.origin + u.pathname.replace(/\/$/, "") || u.pathname);
          }
        } catch {
          // skip
        }
      });
      return [...urls];
    }, new URL(baseUrl).origin);

    discovered.forEach((u) => urlsToVisit.add(u));
  } catch (err) {
    logScrape("warn", "Email homepage failed", {
      baseUrl,
      error: err instanceof Error ? err.message : "unknown",
    });
  } finally {
    await homepagePage.close().catch(() => undefined);
  }

  const extraPages = [...urlsToVisit].filter((u) => !pagesVisited.includes(u));
  for (const url of extraPages.slice(0, EMAIL_MAX_PAGES_PER_SITE)) {
    pagesVisited.push(url);
    const pageEmails = await crawlUrl(context, url, logs);
    pageEmails.forEach((e) => allEmails.add(e));
  }

  const emails = [...allEmails];

  logScrape("info", "Email extraction complete", {
    website: baseUrl,
    pagesVisited,
    emailsFound: emails,
    emailCount: emails.length,
    sources: logs.map((l) => ({ page: l.page, source: l.source, count: l.emails.length })),
  });

  return { emails, pagesVisited, logs };
}

/** Returns comma-separated emails or null */
export async function extractEmailsFromWebsite(
  website: string,
  context: BrowserContext
): Promise<string | null> {
  const result = await extractAllEmailsFromWebsite(website, context);
  return formatEmailsForDisplay(result.emails);
}
