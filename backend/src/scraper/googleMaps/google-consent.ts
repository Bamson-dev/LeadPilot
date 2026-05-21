import type { BrowserContext, Page } from "playwright";
import { logger } from "../../utils/logger";

/** Pre-seed consent so EU/DE visitors skip the interstitial when possible. */
export async function seedGoogleConsentCookies(context: BrowserContext): Promise<void> {
  const expires = Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 400;
  await context.addCookies([
    {
      name: "SOCS",
      value: "CAISNQgBEitib3FfaWRlbnRpdHlmcm9udGVuZHVpc2VydmVyX3N0Y2thbm9uaWNhbC0yMDIwMDgxNy4wLjEuMQGaBGxhIzCAnikBrFAIasAggis",
      domain: ".google.com",
      path: "/",
      expires,
      sameSite: "Lax",
    },
    {
      name: "CONSENT",
      value: "YES+cb.20210420-11-p0.en+FX+667",
      domain: ".google.com",
      path: "/",
      expires,
      sameSite: "Lax",
    },
  ]);
}

const CONSENT_ACCEPT_PATTERNS = [
  /accept all/i,
  /reject all/i,
  /i agree/i,
  /^agree$/i,
  /alle akzeptieren/i,
  /alles akzeptieren/i,
  /alle ablehnen/i,
  /ich stimme zu/i,
  /zustimmen/i,
  /weiter/i,
  /tout accepter/i,
  /aceptar todo/i,
];

function isConsentUrl(url: string): boolean {
  return url.includes("consent.google.");
}

export async function isOnConsentPage(page: Page): Promise<boolean> {
  const url = page.url();
  if (isConsentUrl(url)) return true;
  const title = await page.title().catch(() => "");
  if (/bevor sie zu google|before you continue|avant d'accéder/i.test(title)) return true;
  return false;
}

async function clickConsentButton(page: Page): Promise<boolean> {
  for (const sel of ["#L2AGLb", 'button[id="L2AGLb"]', 'form button[type="submit"]']) {
    try {
      const btn = page.locator(sel).first();
      if (await btn.isVisible({ timeout: 800 })) {
        await btn.click({ timeout: 5000 });
        return true;
      }
    } catch {
      // continue
    }
  }

  const buttons = page.locator('button, div[role="button"], input[type="submit"]');
  const count = await buttons.count().catch(() => 0);
  for (let i = 0; i < Math.min(count, 24); i++) {
    const btn = buttons.nth(i);
    const label = (
      (await btn.innerText().catch(() => "")) +
      " " +
      (await btn.getAttribute("aria-label").catch(() => ""))
    ).trim();
    if (!label) continue;
    if (CONSENT_ACCEPT_PATTERNS.some((re) => re.test(label))) {
      try {
        await btn.click({ timeout: 5000 });
        return true;
      } catch {
        // try next
      }
    }
  }

  const clicked = await page
    .evaluate((patterns) => {
      const nodes = Array.from(
        document.querySelectorAll(
          'button, div[role="button"], input[type="submit"], span[role="button"]'
        )
      );
      for (const node of nodes) {
        const text = (node.textContent || "").trim();
        const aria = node.getAttribute("aria-label") || "";
        const combined = `${text} ${aria}`;
        if (patterns.some((p: string) => new RegExp(p, "i").test(combined))) {
          (node as HTMLElement).click();
          return true;
        }
      }
      return false;
    }, CONSENT_ACCEPT_PATTERNS.map((r) => r.source))
    .catch(() => false);

  return clicked;
}

/**
 * Accept Google's EU consent wall and wait until Maps (or google.com) loads.
 */
export async function acceptGoogleConsent(page: Page, maxAttempts = 4): Promise<boolean> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    if (!(await isOnConsentPage(page))) return true;

    logger.info("Google consent page detected — accepting", {
      attempt: attempt + 1,
      url: page.url().slice(0, 120),
    });

    const clicked = await clickConsentButton(page);
    if (!clicked) {
      logger.warn("No consent button matched", { url: page.url().slice(0, 120) });
    }

    try {
      await page.waitForURL(
        (url) => !isConsentUrl(url.toString()),
        { timeout: 20000, waitUntil: "domcontentloaded" }
      );
      await page.waitForTimeout(1500);
      if (!(await isOnConsentPage(page))) return true;
    } catch {
      await page.waitForTimeout(2000);
      if (!(await isOnConsentPage(page))) return true;
    }
  }

  return !(await isOnConsentPage(page));
}
