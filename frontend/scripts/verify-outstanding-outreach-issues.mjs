#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const sendsReport = readFileSync(
  join(root, "components/dashboard/outreach-sends-report.tsx"),
  "utf8"
);
const workspace = readFileSync(
  join(root, "components/dashboard/outreach-workspace.tsx"),
  "utf8"
);
const searchDashboard = readFileSync(
  join(root, "components/dashboard/search-dashboard.tsx"),
  "utf8"
);
const savedResults = readFileSync(
  join(root, "app/dashboard/search/[searchId]/search-result-client.tsx"),
  "utf8"
);
const historySections = readFileSync(
  join(root, "components/dashboard/dashboard-history-sections.tsx"),
  "utf8"
);
const plansPage = readFileSync(join(root, "app/dashboard/plans/page.tsx"), "utf8");

const checks = [];
function check(label, ok, detail = "") {
  checks.push({ label, ok });
  console.log(`${ok ? "PASS" : "FAIL"}: ${label}${detail ? ` — ${detail}` : ""}`);
}

check(
  "sends report fetch is gated by active tab",
  sendsReport.includes("isActive = false") &&
    sendsReport.includes("if (!isActive) return;")
);
check(
  "sends report supports manual refresh",
  sendsReport.includes("onClick={() => void load()}") && sendsReport.includes("Refresh")
);
check(
  "completed send refresh key triggers report refetch when tab active",
  sendsReport.includes("[isActive, load, refreshKey]") &&
    workspace.includes("setSendsRefreshKey((key) => key + 1)")
);
check(
  "sends report has no polling loop",
  !sendsReport.includes("setInterval(") && !sendsReport.includes("setTimeout(")
);
check(
  "workspace passes active sends tab state",
  workspace.includes("isActive={activeTab === \"sends\"}")
);
check(
  "main dashboard renders shared history sections",
  searchDashboard.includes("<DashboardHistorySections")
);
check(
  "saved results renders shared history sections",
  savedResults.includes("<DashboardHistorySections")
);
check(
  "shared history sections use same components and queries",
  historySections.includes("<RecentSearchesPanel") &&
    historySections.includes("<SearchHistory")
);
check(
  "main dashboard no duplicate history refresh increment effect",
  (searchDashboard.match(/setHistoryRefreshKey\(\(prev\) => prev \+ 1\)/g) ?? []).length === 1
);
check(
  "subscription change is blocked when another active tier exists",
  plansPage.includes("Plan switching is blocked in this release") &&
    plansPage.includes("Manage current plan first")
);

const failed = checks.filter((c) => !c.ok);
console.log(`\n${checks.length - failed.length}/${checks.length} passed`);
if (failed.length) process.exit(1);
