import { extractAllEmailsFromText } from "../parsers/email-filter";
import { filterValidEmails, isValidEmail } from "../parsers/email-validation";
import { resolveEffectiveBusinessWebsite } from "../utils/effective-website";
import { EMAIL_FETCH_TIMEOUT_MS } from "../utils/constants";
import { logger } from "../../utils/logger";

export interface EmailCrawlResult {
  emails: string[];
  email: string | null;
  emailSource: "website" | "generated" | "none";
}

const EMAIL_PRIORITY = [
  "contact",
  "info",
  "hello",
  "enquir",
  "reserv",
  "book",
  "appoint",
];

function sortEmailsByPriority(emails: string[]): string[] {
  return [...emails].sort((a, b) => {
    const aLower = a.toLowerCase();
    const bLower = b.toLowerCase();
    const aScore = EMAIL_PRIORITY.findIndex((p) => aLower.includes(p));
    const bScore = EMAIL_PRIORITY.findIndex((p) => bLower.includes(p));
    if (aScore === -1 && bScore === -1) return aLower.localeCompare(bLower);
    if (aScore === -1) return 1;
    if (bScore === -1) return -1;
    return aScore - bScore;
  });
}

async function fetchPageText(url: string): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), EMAIL_FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "Mozilla/5.0 (compatible; LeadPilot/1.0)" },
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
  const emailRegex = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,6}/g;
  const found = [...(html.match(emailRegex) ?? [])];

  const mailtoRegex = /mailto:([a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,6})/gi;
  let mailtoMatch: RegExpExecArray | null;
  while ((mailtoMatch = mailtoRegex.exec(html)) !== null) {
    if (mailtoMatch[1]) found.push(mailtoMatch[1]);
  }

  return extractAllEmailsFromText(found.join(" "));
}

function generatedEmailsForDomain(websiteUrl: string): string[] {
  try {
    const domain = new URL(websiteUrl).hostname.replace(/^www\./i, "");
    const generated = [`info@${domain}`, `contact@${domain}`, `hello@${domain}`].filter(
      isValidEmail
    );
    return generated;
  } catch {
    return [];
  }
}

/** Return every valid email found on the business website (no display cap). */
export async function crawlEmailsFromWebsite(
  websiteUrl: string | null | undefined
): Promise<string[]> {
  logger.info("Starting email crawl", { websiteUrl: websiteUrl ?? null });

  const baseUrl = await resolveEffectiveBusinessWebsite(websiteUrl);
  if (!baseUrl) {
    logger.info("Email crawl complete", {
      websiteUrl: websiteUrl ?? null,
      emailsFound: 0,
      emails: [],
    });
    return [];
  }

  const validEmails = new Set<string>();
  const base = baseUrl.replace(/\/$/, "");
  const pagesToCheck = [
    baseUrl,
    `${base}/contact`,
    `${base}/contact-us`,
    `${base}/about`,
    `${base}/about-us`,
  ];

  for (const pageUrl of pagesToCheck) {
    try {
      const html = await fetchPageText(pageUrl);
      if (!html) continue;
      for (const email of extractFromHtml(html)) {
        if (isValidEmail(email)) {
          validEmails.add(email.toLowerCase().trim());
        }
      }
    } catch {
      continue;
    }
  }

  const emailArray = sortEmailsByPriority(filterValidEmails([...validEmails]));

  const result =
    emailArray.length === 0 ? generatedEmailsForDomain(baseUrl) : emailArray;

  logger.info("Email crawl complete", {
    websiteUrl: baseUrl,
    emailsFound: result.length,
    emails: result,
  });

  return result;
}

export async function crawlEmailForWebsite(
  website: string | null | undefined
): Promise<EmailCrawlResult> {
  const emails = await crawlEmailsFromWebsite(website);
  if (emails.length > 0) {
    const generatedOnly = emails.every((e) =>
      /^(info|contact|hello)@/.test(e.split("@")[0] ?? "")
    );
    return {
      emails,
      email: emails[0] ?? null,
      emailSource: generatedOnly ? "generated" : "website",
    };
  }
  return { emails: [], email: null, emailSource: "none" };
}
