import { extractAllEmailsFromText } from "../parsers/email-filter";
import { resolveBusinessWebsite } from "../utils/website-utils";
import { EMAIL_CRAWL_PATHS, EMAIL_FETCH_TIMEOUT_MS } from "../utils/constants";

export interface EmailCrawlResult {
  email: string | null;
  emailSource: "website" | "none";
}

async function fetchPageText(url: string): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), EMAIL_FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "LeadPilot/1.0 (+https://leadpilot.app)" },
      redirect: "follow",
    });
    if (!res.ok) return "";
    return await res.text();
  } catch {
    return "";
  } finally {
    clearTimeout(timeout);
  }
}

function extractFromHtml(html: string): string[] {
  const emails = extractAllEmailsFromText(html);
  const mailtoMatches = [...html.matchAll(/mailto:([^\s"'<>?]+)/gi)];
  for (const m of mailtoMatches) {
    const email = m[1]?.split("?")[0]?.trim().toLowerCase();
    if (email?.includes("@")) emails.push(email);
  }
  return [...new Set(emails)];
}

export async function crawlEmailForWebsite(
  website: string | null | undefined
): Promise<EmailCrawlResult> {
  const baseUrl = resolveBusinessWebsite(website);
  if (!baseUrl) {
    return { email: null, emailSource: "none" };
  }

  const urls = [baseUrl];
  for (const path of EMAIL_CRAWL_PATHS) {
    try {
      urls.push(new URL(path, baseUrl).href);
    } catch {
      // skip invalid path
    }
  }

  const found = new Set<string>();
  for (const url of urls) {
    const html = await fetchPageText(url);
    extractFromHtml(html).forEach((e) => found.add(e));
    if (found.size > 0) break;
  }

  if (found.size > 0) {
    const email = [...found].slice(0, 2).join(", ");
    return { email, emailSource: "website" };
  }

  return { email: null, emailSource: "none" };
}
