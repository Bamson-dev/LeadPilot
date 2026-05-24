import type { Page } from "playwright";

export function isValidInternationalPhone(phone: string): boolean {
  if (!phone) return false;
  const digits = phone.replace(/[\s\-().]/g, "").replace(/^\+/, "").replace(/\D/g, "");
  if (digits.length < 7 || digits.length > 15) return false;
  return true;
}

export async function extractPhoneNumber(page: Page): Promise<string | null> {
  try {
    const phoneFromAria = await page.evaluate(() => {
      const selectors = [
        '[data-item-id*="phone"]',
        '[data-tooltip*="phone" i]',
        'button[aria-label*="phone" i]',
        'button[aria-label*="Phone" i]',
        '[aria-label*="Call " i]',
        '[data-item-id="phone:tel"]',
      ];

      for (const selector of selectors) {
        const el = document.querySelector(selector);
        if (el) {
          const label =
            el.getAttribute("aria-label") ||
            el.getAttribute("data-tooltip") ||
            el.textContent;
          if (label) {
            const cleaned = label
              .replace(/^(phone|call|tel|telephone)[\s:]+/i, "")
              .trim();
            if (/[\d+]/.test(cleaned) && cleaned.length >= 6) {
              return cleaned;
            }
          }
        }
      }
      return null;
    });

    if (phoneFromAria) return phoneFromAria;

    const phoneFromTel = await page.evaluate(() => {
      const telLinks = Array.from(document.querySelectorAll('a[href^="tel:"]'));
      for (const link of telLinks) {
        const href = (link as HTMLAnchorElement).href;
        const phone = href.replace("tel:", "").trim();
        if (phone && phone.length >= 6) return phone;
      }
      return null;
    });

    if (phoneFromTel) return phoneFromTel;

    const phoneFromText = await page.evaluate(() => {
      const allElements = document.querySelectorAll("span, div, button, a");

      for (const el of Array.from(allElements)) {
        const text = el.textContent?.trim() || "";
        if (!/^[\+\d(]/.test(text)) continue;
        if (text.length < 7 || text.length > 25) continue;
        const digits = text.replace(/\D/g, "");
        if (digits.length >= 7 && digits.length <= 15) {
          if (/[\+\-()\s]/.test(text) || digits.length >= 10) {
            return text;
          }
        }
      }
      return null;
    });

    if (phoneFromText) return phoneFromText;

    return null;
  } catch {
    return null;
  }
}
