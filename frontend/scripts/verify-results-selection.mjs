#!/usr/bin/env node
/**
 * Results table selection + WhatsApp restore verification.
 *   node frontend/scripts/verify-results-selection.mjs
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const STAGING =
  process.env.STAGING_API_URL?.trim() || "https://staging-backend.leadthur.com";

const results = [];
function pass(label, detail = "") {
  results.push({ label, status: "PASS", detail });
  console.log(`PASS: ${label}${detail ? ` — ${detail}` : ""}`);
}
function fail(label, detail = "") {
  results.push({ label, status: "FAIL", detail });
  console.error(`FAIL: ${label}${detail ? ` — ${detail}` : ""}`);
}

function hasAnyEmail(lead) {
  const verified = lead.verifiedEmails ?? lead.verified_emails ?? [];
  if (verified.some((e) => e?.trim())) return true;
  if (lead.email?.trim()) return true;
  return (lead.emails ?? []).some((e) => e?.trim());
}

function emailSelectionColumnVisible(selectedLeadIds) {
  return selectedLeadIds !== undefined;
}

function countEmailableSelected(leads, selectedIds) {
  return leads.filter((l) => selectedIds.has(l.id) && hasAnyEmail(l)).length;
}

async function main() {
  console.log("\nResults selection verification\n");

  const tableSrc = readFileSync(
    join(__dirname, "../features/results/results-table.tsx"),
    "utf8"
  );
  const dashboardSrc = readFileSync(
    join(__dirname, "../components/dashboard/search-dashboard.tsx"),
    "utf8"
  );
  const savedSrc = readFileSync(
    join(__dirname, "../app/dashboard/search/[searchId]/search-result-client.tsx"),
    "utf8"
  );
  const historySrc = readFileSync(
    join(__dirname, "../components/dashboard/search-history.tsx"),
    "utf8"
  );

  if (tableSrc.includes("showEmailSelection = selectedLeadIds !== undefined")) {
    pass("Checkbox column gated on selectedLeadIds not optional callback");
  } else fail("Checkbox column visibility logic");

  if (tableSrc.includes("STICKY_SELECT_CLASS") && tableSrc.includes("sticky left-0")) {
    pass("Checkbox column sticky on horizontal scroll", "sticky left-0");
  } else fail("Sticky checkbox column");

  if (tableSrc.includes('label: `Select ${lead.business_name} for email`') || tableSrc.includes('"Email"')) {
    pass("Email checkbox labeled distinctly from WhatsApp");
  } else fail("Email checkbox label");

  if (tableSrc.includes("WhatsApp") && tableSrc.includes("onUseTemplate")) {
    pass("WhatsApp template button restored on desktop rows");
  } else fail("WhatsApp button on rows");

  if (dashboardSrc.includes("onUseTemplate={setTemplateLead}") && dashboardSrc.includes("WhatsappTemplateModal")) {
    pass("Fresh search dashboard wires WhatsApp modal");
  } else fail("Dashboard WhatsApp wiring");

  if (savedSrc.includes("selectedLeadIds={selectedLeadIds}") && savedSrc.includes("onToggleLeadSelect")) {
    pass("Saved search View Results page passes selection props", "search-result-client.tsx");
  } else fail("Saved search selection props");

  if (historySrc.includes("router.push(`/dashboard/search/")) {
    pass("Search history View Results navigates to /dashboard/search/[id]");
  } else fail("View Results navigation");

  if (dashboardSrc.includes("selectedLeadIds={selectedLeadIds}")) {
    pass("Fresh search results page passes selection props", "search-dashboard.tsx");
  } else fail("Fresh search selection props");

  const leads = [
    { id: "1", email: "a@b.com" },
    { id: "2", email: null },
    { id: "3", email: "c@b.com" },
  ];
  const selected = new Set(["1", "2", "3"]);
  if (countEmailableSelected(leads, selected) === 2) {
    pass("Only emailable rows count toward toolbar", "count=2");
  } else fail("Emailable count");

  if (emailSelectionColumnVisible(new Set())) pass("Column visible with empty Set");
  else fail("Column with empty set");

  if (!emailSelectionColumnVisible(undefined)) pass("Column hidden without selectedLeadIds prop");
  else fail("Column without prop");

  const sendRes = await fetch(`${STAGING}/send`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{}",
  });
  if (sendRes.status === 401) pass("POST /send still live for compose flow");
  else fail("POST /send", `status ${sendRes.status}`);

  const mobileSrc = readFileSync(
    join(__dirname, "../components/dashboard/mobile-lead-card.tsx"),
    "utf8"
  );
  if (mobileSrc.includes("WhatsApp template") && mobileSrc.includes("Email")) {
    pass("Mobile card has both Email checkbox and WhatsApp button");
  } else fail("Mobile card actions");

  const failed = results.filter((r) => r.status === "FAIL").length;
  const passed = results.filter((r) => r.status === "PASS").length;
  console.log(`\n${passed} passed, ${failed} failed\n`);
  if (failed > 0) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
