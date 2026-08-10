#!/usr/bin/env node
/**
 * Production smoke test: freetrial paywall intro line shows real query/location.
 */
import { chromium } from "playwright";

const URL = "https://www.leadthur.com/freetrial";
const API = "https://backend.leadthur.com";
const TEST_QUERY = "plumbers";
const TEST_LOCATION = "Bristol UK";
const TEST_EMAIL = `paywall-intro-${Date.now()}@leadthur-qa.test`;

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  let searchId = "";

  page.on("response", async (response) => {
    try {
      if (
        response.url().includes("/freetrial") &&
        response.request().method() === "POST" &&
        response.status() === 201
      ) {
        const json = await response.json();
        if (json.searchId) searchId = json.searchId;
      }
    } catch {
      /* ignore */
    }
  });

  try {
    await page.goto(URL, { waitUntil: "networkidle", timeout: 60000 });

    await page.getByPlaceholder("your@email.com").fill(TEST_EMAIL);
    await page.getByRole("button", { name: "Start My 2 Free Searches" }).click();
    await page.getByPlaceholder("e.g. restaurants, dentists, gyms").waitFor({ timeout: 30000 });

    await page.getByPlaceholder("e.g. restaurants, dentists, gyms").fill(TEST_QUERY);
    await page.getByPlaceholder("e.g. Lagos Nigeria, London UK").fill(TEST_LOCATION);
    await page.getByRole("button", { name: "Run free search" }).click();

    await page.getByText("Searching...", { exact: false }).waitFor({ timeout: 20000 }).catch(() => {});

    const pollDeadline = Date.now() + 720000;
    while (Date.now() < pollDeadline) {
      if (!searchId) {
        await page.waitForTimeout(2000);
        continue;
      }

      const progress = await page.evaluate(
        async ({ api, id, email }) => {
          const res = await fetch(
            `${api}/search/results/${id}?limit=15&trialEmail=${encodeURIComponent(email)}`
          );
          if (!res.ok) return null;
          return res.json();
        },
        { api: API, id: searchId, email: TEST_EMAIL }
      );

      if (progress) {
        const leads = progress.leads?.length ?? 0;
        const ready =
          progress.status === "completed" &&
          progress.emailScrapingComplete &&
          leads >= Math.min(15, progress.totalFound || leads) &&
          leads > 0;

        if (ready) break;
      }

      await page.waitForTimeout(3000);
    }

    const panelDeadline = Date.now() + 120000;
    while (Date.now() < panelDeadline) {
      await page.evaluate(() => {
        const rows = document.querySelectorAll("table tbody tr");
        const last = rows[rows.length - 1];
        if (last) last.scrollIntoView({ block: "end" });
        window.scrollTo(0, document.body.scrollHeight);
      });
      await page.waitForTimeout(1500);

      const intro = page.getByText(/You are seeing 15 of 1,000\+ businesses found for/i);
      if (await intro.count()) {
        const introText = (await intro.first().textContent())?.trim() ?? "";
        const expected = `You are seeing 15 of 1,000+ businesses found for ${TEST_QUERY} in ${TEST_LOCATION}.`;

        if (!introText.includes(TEST_QUERY) || !introText.includes(TEST_LOCATION)) {
          throw new Error(`Intro line mismatch.\nExpected: ${TEST_QUERY} / ${TEST_LOCATION}\nGot: ${introText}`);
        }

        console.log(JSON.stringify({
          ok: true,
          email: TEST_EMAIL,
          searchId,
          query: TEST_QUERY,
          location: TEST_LOCATION,
          renderedIntroLine: introText,
          expectedIntroLine: expected,
        }, null, 2));
        return;
      }
    }

    const bodyPreview = await page.evaluate(() => document.body.innerText.slice(0, 2500));
    throw new Error(`Paywall intro not visible. searchId=${searchId}\n${bodyPreview}`);
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error(JSON.stringify({ ok: false, error: err.message }, null, 2));
  process.exit(1);
});
