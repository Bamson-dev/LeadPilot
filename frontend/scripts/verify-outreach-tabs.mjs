#!/usr/bin/env node
/**
 * Outreach tabbed layout verification — static source checks.
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

function hasAll(src, needles, label) {
  const missing = needles.filter((n) => !src.includes(n));
  if (missing.length === 0) {
    pass(label, needles.join(", "));
    return true;
  }
  fail(label, `missing: ${missing.join(", ")}`);
  return false;
}

const workspace = read("components/dashboard/outreach-workspace.tsx");
const topBar = read("components/dashboard/outreach-top-bar.tsx");
const searchBox = read("components/dashboard/outreach-search-box.tsx");
const dashboard = read("components/dashboard/search-dashboard.tsx");
const savedResults = read("app/dashboard/search/[searchId]/search-result-client.tsx");
const sendsReport = read("components/dashboard/outreach-sends-report.tsx");
const resultsTable = read("features/results/results-table.tsx");

hasAll(
  workspace,
  ["OutreachTopBar", "OutreachSearchBox", 'id: "results"', 'id: "sends"', 'id: "mailboxes"', "OutreachSendsReport", "OutreachMailboxSection", "OutreachSendPanel"],
  "OutreachWorkspace contains top bar, search, tabs, and panels"
);

hasAll(
  topBar,
  ["sends left", "Free trial", "Monthly", "Purchased", "daily_send_count", "daily_cap", "Mailboxes"],
  "Top bar shows balance breakdown and mailbox stats"
);

hasAll(
  searchBox,
  ["Business type", "Location", "Search"],
  "Search box has business type, location, and Search button"
);

if (dashboard.includes("OutreachWorkspace") && !dashboard.includes("OutreachSection outreach")) {
  pass("Main dashboard uses OutreachWorkspace", "no standalone OutreachSection");
} else {
  fail("Main dashboard uses OutreachWorkspace");
}

if (savedResults.includes("OutreachWorkspace") && savedResults.includes("onSearch={handleSearch}")) {
  pass("Saved results view uses OutreachWorkspace with search");
} else {
  fail("Saved results view uses OutreachWorkspace with search");
}

if (workspace.includes("OutreachSendsReport") && !dashboard.includes("<OutreachSendsReport")) {
  pass("Sends report moved into workspace tab", "not inline on dashboard page");
} else {
  fail("Sends report tab wiring");
}

if (!read("components/dashboard/results-outreach-shell.tsx").includes("<OutreachSendsReport")) {
  pass("Legacy results-outreach-shell no longer embeds sends report");
} else {
  fail("Legacy shell still embeds sends report");
}

hasAll(
  sendsReport,
  ["total_sent", "total_opened", "open_rate", "statusFilter", "PAGE_SIZE", "offset"],
  "Sends report retains summary, filter, and pagination"
);

hasAll(
  resultsTable,
  ["onSendSelected", "selectedLeadIds", "onToggleLeadSelect", "Send email"],
  "Results table retains selection and send button"
);

if (workspace.includes("role=\"tablist\"") && workspace.includes("overflow-x-auto")) {
  pass("Tabs are scrollable for mobile");
} else {
  fail("Mobile tab scroll");
}

if (topBar.includes("flex-col") && topBar.includes("sm:flex-row")) {
  pass("Top bar stacks on mobile");
} else {
  fail("Top bar mobile stacking");
}

if (
  dashboard.includes("businessType={businessType}") &&
  savedResults.includes("businessType={businessType}") &&
  dashboard.includes("onSearch={handleSearch}") &&
  savedResults.includes("onSearch={handleSearch}")
) {
  pass("Both views wire search state consistently");
} else {
  fail("Consistent search wiring");
}

if (savedResults.includes("router.push") && savedResults.includes("businessType=")) {
  pass("Saved results search redirects to dashboard with params");
} else {
  fail("Saved results search action");
}

console.log("\n=== Summary ===");
for (const r of results) {
  console.log(`${r.status}: ${r.label}${r.detail ? ` — ${r.detail}` : ""}`);
}
process.exit(results.some((r) => r.status === "FAIL") ? 1 : 0);
