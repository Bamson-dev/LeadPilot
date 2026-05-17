import type { Page } from "playwright";
import type { LeadInput } from "../types";
import {
  cleanBusinessName,
  extractPhoneNumber,
  isBlockedText,
  normalizeWebsite,
} from "./data-quality";
import {
  extractAllEmailsFromText,
  formatEmailsForDisplay,
  mergeEmails,
} from "./email-filter";

export async function waitForDetailPanel(
  page: Page,
  timeoutMs = 8000
): Promise<boolean> {
  try {
    await page.waitForFunction(
      () => {
        const h1 = document.querySelector("h1");
        if (!h1?.textContent?.trim()) return false;
        const hasPhone = !!document.querySelector(
          'button[data-item-id^="phone:tel:"], a[href^="tel:"]'
        );
        const hasWebsite = !!document.querySelector(
          'a[data-item-id="authority"][href^="http"], a[href^="http"]:not([href*="google.com"])'
        );
        const hasAddress = !!document.querySelector(
          'button[data-item-id="address"], button[data-item-id^="oloc"]'
        );
        return hasPhone || hasWebsite || hasAddress;
      },
      { timeout: timeoutMs }
    );
    await page.waitForTimeout(300);
    return true;
  } catch {
    return false;
  }
}

export async function extractFromDetailPanel(
  page: Page,
  searchTerm: string
): Promise<Partial<LeadInput>> {
  return page.evaluate((term) => {
    const result: Partial<LeadInput> & { google_maps_url: string } = {
      google_maps_url: window.location.href,
    };

    const main = document.querySelector('[role="main"]') || document.body;
    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
    const emailsFound: string[] = [];

    const name = main.querySelector("h1")?.textContent?.trim();
    if (name) result.business_name = name;

    // Phone
    const phoneButtons = main.querySelectorAll(
      'button[data-item-id^="phone:tel:"], button[data-item-id*="tel:"]'
    );
    for (const btn of phoneButtons) {
      const dataId = btn.getAttribute("data-item-id") || "";
      const telMatch = dataId.match(/tel:([^;]+)/i);
      if (telMatch) {
        result.phone = decodeURIComponent(telMatch[1]);
        break;
      }
    }
    if (!result.phone) {
      const telLink = main.querySelector('a[href^="tel:"]') as HTMLAnchorElement | null;
      if (telLink?.href) {
        result.phone = telLink.href.replace(/^tel:/i, "").trim();
      }
    }

    // Email from Maps panel (mailto + visible text)
    main.querySelectorAll('a[href^="mailto:"]').forEach((a) => {
      const href = a.getAttribute("href") || "";
      const raw = String(href)
        .replace(/^mailto:/i, "")
        .split("?")[0]
        .trim();
      if (raw && raw.includes("@")) emailsFound.push(raw.toLowerCase());
    });
    const textEmails = main.textContent?.match(emailRegex) ?? [];
    for (const e of textEmails) {
      if (typeof e === "string" && e.includes("@")) {
        emailsFound.push(e.toLowerCase());
      }
    }
    if (emailsFound.length) result.email = emailsFound[0];

    // Website — authority link, then any external link
    const authority = main.querySelector(
      'a[data-item-id="authority"]'
    ) as HTMLAnchorElement | null;
    if (authority?.href) result.website = authority.href;

    if (!result.website) {
      main.querySelectorAll('a[href^="http"]').forEach((a) => {
        const href = (a as HTMLAnchorElement).href;
        if (
          !href ||
          href.includes("google.com") ||
          href.includes("gstatic.com") ||
          href.includes("googleusercontent") ||
          href.includes("schema.org")
        )
          return;
        if (
          href.includes("facebook.com") ||
          href.includes("instagram.com") ||
          href.includes("twitter.com")
        )
          return;
        result.website = href;
      });
    }

    // Address
    const addressBtn = main.querySelector(
      'button[data-item-id="address"], button[data-item-id^="oloc"]'
    );
    if (addressBtn) {
      const label = addressBtn.getAttribute("aria-label") || "";
      let addr = label.replace(/^address:?\s*/i, "").trim();
      if (!addr) addr = addressBtn.textContent?.trim() || "";
      if (addr.length > 5) result.address = addr;
    }

    // Rating
    const starsEl = main.querySelector('[role="img"][aria-label*="stars"]');
    if (starsEl) {
      const sm = starsEl.getAttribute("aria-label")?.match(/([\d.]+)/);
      if (sm) result.rating = parseFloat(sm[1]);
    }
    const blockMatch = (main.textContent || "").match(
      /(\d[.,]\d)\s*\(([\d,]+)\)/
    );
    if (blockMatch) {
      result.rating =
        result.rating ?? parseFloat(blockMatch[1].replace(",", "."));
      result.reviews_count = parseInt(blockMatch[2].replace(/,/g, ""), 10);
    }

    result.category = term;
    const categoryBtn = main.querySelector('button[jsaction*="category"]');
    if (categoryBtn?.textContent?.trim()) {
      result.category =
        categoryBtn.textContent.trim().split("·")[0]?.trim() || term;
    }

    return { ...result, emails: emailsFound };
  }, searchTerm);
}

export async function buildLeadFromPanel(
  page: Page,
  searchTerm: string,
  placeUrl: string
): Promise<LeadInput | null> {
  const raw = (await extractFromDetailPanel(
    page,
    searchTerm
  )) as Partial<LeadInput> & { emails?: unknown };
  const panelEmails = mergeEmails(raw.emails ?? []);

  const business_name = cleanBusinessName(
    typeof raw.business_name === "string" ? raw.business_name : null
  );
  if (!business_name) return null;

  let phone = extractPhoneNumber(raw.phone);
  if (!phone) {
    const panelText = await page
      .locator('[role="main"]')
      .first()
      .innerText()
      .catch(() => "");
    phone = extractPhoneNumber(panelText);
  }

  const mapsEmail = formatEmailsForDisplay(panelEmails);
  const website = normalizeWebsite(raw.website ?? null);

  return {
    business_name,
    phone,
    email: mapsEmail,
    extracted_email: mapsEmail,
    generated_email: null,
    email_source: mapsEmail ? ("extracted" as const) : null,
    website,
    address:
      typeof raw.address === "string" && !isBlockedText(raw.address)
        ? raw.address.trim()
        : null,
    rating: raw.rating ?? null,
    reviews_count: raw.reviews_count ?? null,
    category: raw.category ?? searchTerm,
    google_maps_url: raw.google_maps_url ?? placeUrl,
  };
}
