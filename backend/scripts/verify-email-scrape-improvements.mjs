/**
 * Offline checks for Phase 2 email scrape heuristics.
 * Run: node --import tsx scripts/verify-email-scrape-improvements.mjs
 */
import {
  isUnscrapableHttpStatus,
  looksLikeChallengeOrErrorPage,
  resolveDefaultAboutPaths,
  resolveDefaultContactPaths,
} from "../src/scraper/emailCrawler/email-scrape-heuristics.ts";
import { scorePredictionConfidence } from "../src/utils/email-predictor.ts";

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

assert(isUnscrapableHttpStatus(522) === true, "522 should be unscrapable");
assert(isUnscrapableHttpStatus(503) === true, "503 should be unscrapable");
assert(isUnscrapableHttpStatus(403) === true, "403 should be unscrapable");
assert(isUnscrapableHttpStatus(200) === false, "200 should be scrapable");
assert(isUnscrapableHttpStatus(null) === false, "null status not unscrapable");

assert(
  looksLikeChallengeOrErrorPage("<html>Error code: 522 Cloudflare Ray ID</html>") === true,
  "522 error page"
);
assert(looksLikeChallengeOrErrorPage("<html><body>Contact us at info@x.com</body></html>") === false, "normal page");

const contacts = resolveDefaultContactPaths("https://example.com");
assert(contacts.includes("https://example.com/contact"), "contact path");
assert(contacts.includes("https://example.com/get-in-touch"), "get-in-touch path");
assert(contacts.includes("https://example.com/enquiries"), "enquiries path");

const abouts = resolveDefaultAboutPaths("https://example.com");
assert(abouts.includes("https://example.com/about"), "about path");

const gym = scorePredictionConfidence("membership", "category_pattern", "gym");
assert(gym.confidence >= 70 && gym.label !== "low", "gym membership confidence");

console.log("verify-email-scrape-improvements: PASS");
