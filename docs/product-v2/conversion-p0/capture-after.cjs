const { chromium } = require("playwright");
const path = require("path");

const BASE = process.env.SCREENSHOT_BASE || "http://localhost:3010";
const OUT = path.join(__dirname, "after");

const pages = [
  ["landing", "/"],
  ["freetrial-gate", "/freetrial"],
  ["checkout", "/checkout"],
];

const viewports = [
  ["desktop", 1440, 900],
  ["tablet", 768, 1024],
  ["mobile", 390, 844],
];

(async () => {
  const browser = await chromium.launch();
  const page = await (await browser.newContext()).newPage();

  for (const [vpName, width, height] of viewports) {
    await page.setViewportSize({ width, height });
    for (const [slug, route] of pages) {
      await page.goto(`${BASE}${route}`, { waitUntil: "networkidle", timeout: 60000 });
      await page.waitForTimeout(1200);
      const file = path.join(OUT, vpName, `${slug}-${vpName}.png`);
      await page.screenshot({ path: file, fullPage: false });
      console.log("Saved", file);
    }
  }

  await browser.close();
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
