/**
 * Worldwide restaurant URL collection test (Phase 1).
 * Usage: node backend/scripts/worldwide-search-test.mjs
 */
import { chromium } from "playwright";
import {
  geocodeNominatimFull,
  geocodeNominatimShortened,
  geocodeGoogle,
  hasGoogleGeocodingApiKey,
} from "../dist/scraper/googleMaps/grid-search.js";
import { countCollectedBusinessUrls } from "../dist/scraper/googleMaps/maps-scraper.js";

const CITIES = [
  ["Lagos Nigeria", "West Africa"],
  ["Abuja Nigeria", "West Africa"],
  ["Accra Ghana", "West Africa"],
  ["Kumasi Ghana", "West Africa"],
  ["Port Harcourt Nigeria", "West Africa"],
  ["Dakar Senegal", "West Africa"],
  ["Abidjan Ivory Coast", "West Africa"],
  ["Nairobi Kenya", "East Africa"],
  ["Kampala Uganda", "East Africa"],
  ["Dar es Salaam Tanzania", "East Africa"],
  ["Kigali Rwanda", "East Africa"],
  ["Addis Ababa Ethiopia", "East Africa"],
  ["Johannesburg South Africa", "Southern Africa"],
  ["Cape Town South Africa", "Southern Africa"],
  ["Lusaka Zambia", "Southern Africa"],
  ["Cairo Egypt", "North Africa"],
  ["Casablanca Morocco", "North Africa"],
  ["Tunis Tunisia", "North Africa"],
  ["Dubai UAE", "Middle East"],
  ["Riyadh Saudi Arabia", "Middle East"],
  ["Amman Jordan", "Middle East"],
  ["Beirut Lebanon", "Middle East"],
  ["London UK", "Europe"],
  ["Paris France", "Europe"],
  ["Berlin Germany", "Europe"],
  ["Warsaw Poland", "Europe"],
  ["Madrid Spain", "Europe"],
  ["New York USA", "North America"],
  ["Toronto Canada", "North America"],
  ["Mexico City Mexico", "North America"],
  ["São Paulo Brazil", "Latin America"],
  ["Buenos Aires Argentina", "Latin America"],
  ["Bogota Colombia", "Latin America"],
  ["Mumbai India", "South Asia"],
  ["Dhaka Bangladesh", "South Asia"],
  ["Karachi Pakistan", "South Asia"],
  ["Bangkok Thailand", "Southeast Asia"],
  ["Jakarta Indonesia", "Southeast Asia"],
  ["Manila Philippines", "Southeast Asia"],
  ["Tokyo Japan", "East Asia"],
  ["Seoul South Korea", "East Asia"],
  ["Tashkent Uzbekistan", "Central Asia"],
];

const QUERY = "restaurants";
const PHASE1_MS = 50_000;

async function geocodeSummary(location) {
  const full = await geocodeNominatimFull(location);
  if (full?.geo) return `nominatim-full (${full.queryUsed})`;
  const short = await geocodeNominatimShortened(location);
  if (short?.geo) return `nominatim-short (${short.queryUsed})`;
  if (hasGoogleGeocodingApiKey()) {
    const google = await geocodeGoogle(location);
    if (google?.geo) return `google (${google.queryUsed})`;
  }
  return "none (single-point fallback only)";
}

async function main() {
  console.log("Google Geocoding API key present:", hasGoogleGeocodingApiKey());
  console.log("Query:", QUERY);
  console.log("Phase 1 deadline per city:", PHASE1_MS / 1000, "s\n");

  const browser = await chromium.launch({ headless: true });
  const results = [];
  let failures = 0;

  try {
    for (const [location, region] of CITIES) {
      const geo = await geocodeSummary(location);
      const start = Date.now();
      let count = 0;
      let error = null;
      try {
        count = await countCollectedBusinessUrls(
          browser,
          QUERY,
          location,
          PHASE1_MS
        );
      } catch (err) {
        error = err instanceof Error ? err.message : String(err);
      }
      const seconds = ((Date.now() - start) / 1000).toFixed(1);
      const pass = count > 0;
      if (!pass) failures++;
      results.push({ location, region, geo, count, seconds, pass, error });
      console.log(
        `${pass ? "PASS" : "FAIL"} | ${location.padEnd(28)} | ${String(count).padStart(4)} urls | ${seconds}s | ${geo}${error ? ` | ${error}` : ""}`
      );
    }
  } finally {
    await browser.close();
  }

  console.log("\n--- Summary ---");
  console.log(`Passed: ${results.length - failures}/${results.length}`);
  if (failures > 0) {
    console.log("Failures:");
    for (const r of results.filter((x) => !x.pass)) {
      console.log(`  - ${r.location}: ${r.count} urls, geocode=${r.geo}`);
    }
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
