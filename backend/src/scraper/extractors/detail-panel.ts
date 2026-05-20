import type { Page } from "playwright";
import type { RawLeadInput } from "../../types/scraper";
import {
  cleanBusinessName,
  extractPhoneNumber,
  isBlockedText,
  normalizeWebsite,
} from "../utils/data-quality";
import { formatEmailsForDisplay, mergeEmails } from "../parsers/email-filter";

export async function waitForDetailPanel(page: Page, timeoutMs = 8000): Promise<boolean> {
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

export async function buildLeadFromPanel(
  page: Page,
  searchTerm: string,
  placeUrl: string
): Promise<RawLeadInput | null> {
  const raw = (await page.evaluate((term) => {
    const result: Record<string, unknown> = { google_maps_url: window.location.href };
    const main = document.querySelector('[role="main"]') || document.body;
    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
    const emailsFound: string[] = [];
    const name = main.querySelector("h1")?.textContent?.trim();
    if (name) result.business_name = name;

    const phoneBtn = main.querySelector('button[data-item-id^="phone:tel:"]');
    if (phoneBtn) {
      const dataId = phoneBtn.getAttribute("data-item-id") || "";
      const telMatch = dataId.match(/tel:([^;]+)/i);
      if (telMatch) result.phone = decodeURIComponent(telMatch[1]);
    }

    main.querySelectorAll('a[href^="mailto:"]').forEach((a) => {
      const href = a.getAttribute("href") || "";
      const rawEmail = href.replace(/^mailto:/i, "").split("?")[0]?.trim();
      if (rawEmail?.includes("@")) emailsFound.push(rawEmail.toLowerCase());
    });

    const authority = main.querySelector('a[data-item-id="authority"]') as HTMLAnchorElement | null;
    if (authority?.href) result.website = authority.href;

    const addressBtn = main.querySelector('button[data-item-id="address"]');
    if (addressBtn) {
      const label = addressBtn.getAttribute("aria-label") || "";
      const addr = label.replace(/^address:?\s*/i, "").trim() || addressBtn.textContent?.trim();
      if (addr && addr.length > 5) result.address = addr;
    }

    const starsEl = main.querySelector('[role="img"][aria-label*="stars"]');
    if (starsEl) {
      const sm = starsEl.getAttribute("aria-label")?.match(/([\d.]+)/);
      if (sm) result.rating = parseFloat(sm[1]);
    }

    const blockMatch = (main.textContent || "").match(/(\d[.,]\d)\s*\(([\d,]+)\)/);
    if (blockMatch) {
      result.rating = result.rating ?? parseFloat(blockMatch[1].replace(",", "."));
      result.reviews_count = parseInt(blockMatch[2].replace(/,/g, ""), 10);
    }

    result.category = term;
    return { ...result, emails: emailsFound };
  }, searchTerm)) as Record<string, unknown> & { emails?: string[] };

  const panelEmails = mergeEmails(raw.emails ?? []);
  const business_name = cleanBusinessName(
    typeof raw.business_name === "string" ? raw.business_name : null
  );
  if (!business_name) return null;

  let phone = extractPhoneNumber(raw.phone as string | null);
  if (!phone) {
    const panelText = await page.locator('[role="main"]').first().innerText().catch(() => "");
    phone = extractPhoneNumber(panelText);
  }

  const mapsEmail = formatEmailsForDisplay(panelEmails);
  const website = normalizeWebsite((raw.website as string) ?? null);

  return {
    business_name,
    phone,
    email: mapsEmail,
    extracted_email: mapsEmail,
    generated_email: null,
    email_source: mapsEmail ? "extracted" : null,
    website,
    address:
      typeof raw.address === "string" && !isBlockedText(raw.address)
        ? raw.address.trim()
        : null,
    rating: (raw.rating as number) ?? null,
    reviews_count: (raw.reviews_count as number) ?? null,
    category: (raw.category as string) ?? searchTerm,
    google_maps_url: (raw.google_maps_url as string) ?? placeUrl,
  };
}
