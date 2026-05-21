import type { Page } from "playwright";

export async function extractPhoneNumber(page: Page): Promise<string | null> {
  const phoneSelectors = [
    'button[data-item-id*="phone"] [data-tooltip]',
    '[data-item-id*="phone"]',
    'button[aria-label*="Phone"]',
    '[aria-label*="phone" i]',
    'a[href^="tel:"]',
    '[data-tooltip*="+"]',
    'button[data-tooltip*="phone" i]',
  ];

  for (const selector of phoneSelectors) {
    try {
      const element = await page.$(selector);
      if (!element) continue;

      const text =
        (await element.getAttribute("aria-label")) ||
        (await element.getAttribute("data-tooltip")) ||
        (await element.textContent());

      if (text) {
        const cleaned = text.replace(/phone:/i, "").replace(/call:/i, "").trim();

        if (/[\d+\-() ]{7,}/.test(cleaned) && cleaned.replace(/\D/g, "").length >= 7) {
          return cleaned;
        }
      }
    } catch {
      continue;
    }
  }

  try {
    const telLink = await page.$('a[href^="tel:"]');
    if (telLink) {
      const href = await telLink.getAttribute("href");
      if (href) return href.replace(/^tel:/i, "").trim();
    }
  } catch {
    /* ignore */
  }

  return null;
}
