import type { Page } from "playwright";
import type { RawLeadInput } from "../../types/scraper";
import {
  cleanBusinessName,
  isBlockedText,
  normalizeWebsite,
} from "../utils/data-quality";
import { extractAllEmailsFromText, formatEmailsForDisplay, mergeEmails } from "../parsers/email-filter";
import { filterValidEmails } from "../parsers/email-validation";
import { extractPhoneNumber } from "../googleMaps/extract-phone";
import {
  extractPhoneFromLabel,
  normalizePhoneForLocation,
} from "../utils/phone-validation";

export async function waitForDetailPanel(page: Page, timeoutMs = 8000): Promise<boolean> {
  try {
    await page.waitForFunction(
      () => {
        const h1 = document.querySelector("h1");
        if (!h1?.textContent?.trim()) return false;
        const main = document.querySelector('[role="main"]');
        if (!main) return false;
        const hasPhone = !!main.querySelector(
          'button[data-item-id^="phone"], button[data-item-id*="phone:tel"], a[href^="tel:"], button[aria-label*="Phone"], button[aria-label*="phone"]'
        );
        const hasWebsite = !!main.querySelector(
          'a[data-item-id="authority"][href^="http"], a[href^="http"]:not([href*="google.com"])'
        );
        const hasAddress = !!main.querySelector(
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
  placeUrl: string,
  location: string
): Promise<RawLeadInput | null> {
  const raw = (await page.evaluate(() => {
    const result: Record<string, unknown> = { google_maps_url: window.location.href };
    const main = document.querySelector('[role="main"]');
    if (!main) return result;

    const name = main.querySelector("h1")?.textContent?.trim();
    if (name) result.business_name = name;

    const tryTel = (value: string | null | undefined): string | null => {
      if (!value?.trim()) return null;
      const decoded = decodeURIComponent(value.replace(/^tel:/i, "").trim());
      if (/[\d+()]/.test(decoded) && decoded.replace(/\D/g, "").length >= 10) {
        return decoded;
      }
      return null;
    };

    main
      .querySelectorAll('button[data-item-id^="phone"], button[data-item-id*="phone:tel"]')
      .forEach((btn) => {
        if (result.phone) return;
        const dataId = btn.getAttribute("data-item-id") || "";
        const telMatch = dataId.match(/tel:([^;]+)/i);
        if (telMatch) {
          const fromId = tryTel(telMatch[1]);
          if (fromId) {
            result.phone = fromId;
            return;
          }
        }
        const label = btn.getAttribute("aria-label") || btn.textContent || "";
        const fromLabel = label.match(
          /(\+\d{1,3}[\s.-]?\(?\d{2,4}\)?[\s.-]?\d{3,4}[\s.-]?\d{3,4}|\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4})/
        );
        if (fromLabel?.[1]) result.phone = fromLabel[1].trim();
      });

    if (!result.phone) {
      main.querySelectorAll('a[href^="tel:"]').forEach((link) => {
        if (result.phone) return;
        const href = (link as HTMLAnchorElement).href || "";
        const fromHref = tryTel(href.replace(/^tel:/i, "").split("?")[0]);
        if (fromHref) result.phone = fromHref;
      });
    }

    if (!result.phone) {
      main.querySelectorAll("[aria-label]").forEach((el) => {
        if (result.phone) return;
        const label = el.getAttribute("aria-label") || "";
        if (!/^phone[:\s]/i.test(label) && !/^call[:\s]/i.test(label)) return;
        const match = label.match(
          /(\+\d{1,3}[\s.-]?\(?\d{2,4}\)?[\s.-]?\d{3,4}[\s.-]?\d{3,4}|\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4})/
        );
        if (match?.[1]) result.phone = match[1].trim();
      });
    }

    const emailsFound: string[] = [];
    main.querySelectorAll('a[href^="mailto:"]').forEach((a) => {
      const href = a.getAttribute("href") || "";
      const rawEmail = href.replace(/^mailto:/i, "").split("?")[0]?.trim();
      if (rawEmail?.includes("@")) emailsFound.push(rawEmail.toLowerCase());
    });

    const authority = main.querySelector('a[data-item-id="authority"]') as HTMLAnchorElement | null;
    if (authority?.href) result.website = authority.href;

    if (!result.website) {
      const candidates = Array.from(
        main.querySelectorAll(
          'a[href^="http"]:not([href*="google.com/maps"]):not([href*="google.com/search"])'
        )
      );
      for (const link of candidates) {
        const href = (link as HTMLAnchorElement).href;
        if (
          href &&
          !href.includes("google.com/url") &&
          !href.includes("accounts.google") &&
          !href.includes("support.google")
        ) {
          result.website = href;
          break;
        }
      }
    }

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

    let contactText = "";
    main
      .querySelectorAll(
        'button[data-item-id], a[href^="mailto:"], [aria-label*="Phone"], [aria-label*="phone"]'
      )
      .forEach((el) => {
        contactText += ` ${el.getAttribute("aria-label") || ""} ${el.textContent || ""}`;
      });
    result.contactText = contactText.slice(0, 2000);
    result.emails = emailsFound;
    return result;
  })) as Record<string, unknown> & { emails?: string[]; contactText?: string };

  const panelEmails = filterValidEmails(
    mergeEmails(
      raw.emails ?? [],
      extractAllEmailsFromText(
        typeof raw.contactText === "string" ? raw.contactText : ""
      )
    )
  );

  const business_name = cleanBusinessName(
    typeof raw.business_name === "string" ? raw.business_name : null
  );
  if (!business_name) return null;

  let phone = normalizePhoneForLocation(raw.phone as string | null, location);

  if (!phone) {
    const phoneBtn = page.locator('[role="main"] button[data-item-id*="phone"]').first();
    const ariaLabel = await phoneBtn.getAttribute("aria-label").catch(() => null);
    phone = normalizePhoneForLocation(extractPhoneFromLabel(ariaLabel ?? ""), location);
  }

  if (!phone) {
    const fallback = await extractPhoneNumber(page);
    phone = normalizePhoneForLocation(fallback, location);
  }

  const website = normalizeWebsite((raw.website as string) ?? null);
  const mapsEmail = formatEmailsForDisplay(panelEmails, website);

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
    category: searchTerm,
    google_maps_url: (raw.google_maps_url as string) ?? placeUrl,
  };
}
