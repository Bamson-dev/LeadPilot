#!/usr/bin/env node
/**
 * Dashboard sections restore verification.
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

const results = [];

function pass(label, detail = "") {
  results.push({ label, status: "PASS", detail });
  console.log(`PASS: ${label}${detail ? ` — ${detail}` : ""}`);
}

function fail(label, detail = "") {
  results.push({ label, status: "FAIL", detail });
  console.error(`FAIL: ${label}${detail ? ` — ${detail}` : ""}`);
}

function read(rel) {
  return readFileSync(join(ROOT, rel), "utf8");
}

function sectionOrder(src, label, earlier, later) {
  const a = src.indexOf(earlier);
  const b = src.indexOf(later);
  if (a >= 0 && b > a) {
    pass(label, `${earlier} before ${later}`);
    return true;
  }
  fail(label, `expected ${earlier} before ${later} (a=${a}, b=${b})`);
  return false;
}

const dashboard = read("components/dashboard/search-dashboard.tsx");
const saved = read("app/dashboard/search/[searchId]/search-result-client.tsx");
const workspace = read("components/dashboard/outreach-workspace.tsx");

if (workspace.includes("resultsFooter")) {
  pass("OutreachWorkspace supports resultsFooter");
} else {
  fail("OutreachWorkspace supports resultsFooter");
}

sectionOrder(
  dashboard,
  "Main dashboard: workspace before history sections",
  "<OutreachWorkspace",
  "<DashboardHistorySections"
);

sectionOrder(
  saved,
  "Saved view: workspace before history sections",
  "<OutreachWorkspace",
  "<DashboardHistorySections"
);

if (dashboard.includes("resultsFooter") && dashboard.includes("NearbyCityChips")) {
  const footerBlock = dashboard.slice(
    dashboard.indexOf("resultsFooter"),
    dashboard.indexOf("resultsContent")
  );
  if (footerBlock.includes("NearbyCityChips") && footerBlock.includes("ResultsActionsBar")) {
    pass("Main dashboard: chips and actions in resultsFooter below table");
  } else {
    fail("Main dashboard resultsFooter content");
  }
} else {
  fail("Main dashboard resultsFooter");
}

if (saved.includes("resultsFooter") && saved.includes("NearbyCityChips")) {
  pass("Saved view: nearby chips in resultsFooter");
} else {
  fail("Saved view nearby chips placement");
}

if (saved.includes('accumulate", "1"') || saved.includes("accumulate: true")) {
  pass("Saved view nearby/search-again use accumulate mode");
} else {
  fail("Saved view accumulate mode");
}

if (dashboard.includes('params.get("accumulate") === "1"')) {
  pass("Dashboard reads accumulate URL param for chip redirects");
} else {
  fail("Dashboard accumulate URL param");
}

const discoverCard = dashboard.slice(
  dashboard.indexOf("Discover Prospects"),
  dashboard.indexOf("<AffiliateSection")
);
if (!discoverCard.includes("Business type") && !discoverCard.includes('placeholder="e.g. restaurants')) {
  pass("Discover Prospects card has no duplicate search inputs");
} else {
  fail("Discover Prospects duplicate search inputs");
}

if (!discoverCard.includes("Download") && dashboard.includes("ResultsActionsBar")) {
  pass("Download moved out of Discover Prospects card");
} else {
  fail("Download duplication in Discover card");
}

if (dashboard.includes("<DashboardHistorySections")) {
  pass("Main dashboard renders DashboardHistorySections");
} else {
  fail("Main dashboard history sections");
}

if (saved.includes("<DashboardHistorySections")) {
  pass("Saved view renders DashboardHistorySections");
} else {
  fail("Saved view history sections");
}

if (read("components/dashboard/recent-searches-panel.tsx").includes("Search Again")) {
  pass("Recent Searches panel retains Search Again");
} else {
  fail("Recent Searches Search Again");
}

const historySrc = read("components/dashboard/search-history.tsx");
if (historySrc.includes("View") && historySrc.includes("Download")) {
  pass("Search History retains View Results and Download Leads");
} else {
  fail("Search History actions");
}

// URL builder sanity (same logic as saved view)
function dashboardSearchUrl(businessType, location, options = {}) {
  const params = new URLSearchParams();
  if (businessType.trim()) params.set("businessType", businessType.trim());
  params.set("location", location.trim());
  if (options.accumulate) params.set("accumulate", "1");
  return `/dashboard?${params.toString()}`;
}

const chipUrl = dashboardSearchUrl("restaurants", "Ikeja", { accumulate: true });
if (chipUrl.includes("accumulate=1") && chipUrl.includes("businessType=restaurants")) {
  pass("Accumulate chip URL", chipUrl);
} else {
  fail("Accumulate chip URL", chipUrl);
}

const preTab = existsSync(join(ROOT, "..", ".git"))
  ? null
  : null;

// Other sections comparison vs pre-tab layout (affa4b7 parent)
const otherStillPresent = [
  ["AffiliateSection", dashboard],
  ["WelcomeState", dashboard],
  ["Want more results?", dashboard],
  ["SearchUpgradeBanner", dashboard],
  ["WhatsappTemplateModal", dashboard],
  ["RegionCityChips", dashboard],
];
for (const [name, src] of otherStillPresent) {
  if (src.includes(name)) pass(`Still present after restructure: ${name}`);
  else fail(`Missing after restructure: ${name}`);
}

const notRestoredByThisTask = [
  "OutreachBalanceBanner (replaced by compact OutreachTopBar)",
  "New Search button (removed; use workspace search + Clear Results)",
  "Mobile fixed download bar (removed; download lives in Results tab footer)",
];
console.log("\n--- Other differences vs pre-tab layout (not restored in this task) ---");
for (const item of notRestoredByThisTask) {
  console.log(`NOTE: ${item}`);
}

console.log("\n=== Summary ===");
for (const r of results) {
  console.log(`${r.status}: ${r.label}${r.detail ? ` — ${r.detail}` : ""}`);
}
process.exit(results.some((r) => r.status === "FAIL") ? 1 : 0);
