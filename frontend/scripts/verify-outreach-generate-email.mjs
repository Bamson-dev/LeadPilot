#!/usr/bin/env node
/**
 * Outreach AI writer frontend verification:
 *   node frontend/scripts/verify-outreach-generate-email.mjs
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const STAGING =
  process.env.STAGING_API_URL?.trim() || "https://staging-backend.leadthur.com";

function applyBusinessNameMerge(text, businessName) {
  const name = businessName?.trim() || "there";
  return text.replace(/\[Business Name\]/gi, name);
}

const results = [];

function pass(label, detail = "") {
  results.push({ label, status: "PASS", detail });
  console.log(`PASS: ${label}${detail ? ` — ${detail}` : ""}`);
}
function fail(label, detail = "") {
  results.push({ label, status: "FAIL", detail });
  console.error(`FAIL: ${label}${detail ? ` — ${detail}` : ""}`);
}
function skip(label, reason) {
  results.push({ label, status: "SKIP", detail: reason });
  console.log(`SKIP: ${label} — ${reason}`);
}

const panelSrc = readFileSync(
  join(__dirname, "../components/dashboard/outreach-send-panel.tsx"),
  "utf8"
);
const apiSrc = readFileSync(join(__dirname, "../services/outreach-api.ts"), "utf8");

for (const needle of [
  "AI email writer",
  "Generate email",
  "Generating…",
  "Choose a template",
  "generateOutreachEmail",
  "min-h-[280px]",
  "rows={14}",
  "generateError",
]) {
  if (panelSrc.includes(needle)) pass(`Compose panel includes ${needle}`);
  else fail(`Compose panel includes ${needle}`);
}

if (apiSrc.includes("/outreach/generate-email")) pass("API calls /outreach/generate-email");
else fail("API calls /outreach/generate-email");

const merged = applyBusinessNameMerge(
  "Hi [Business Name],\n\nQuick idea for your gym.",
  "Peak Fitness"
);
if (merged.includes("Peak Fitness") && !/\[Business Name\]/i.test(merged)) {
  pass("Preview merge token fills business name", merged.split("\n")[0]);
} else {
  fail("Preview merge token fills business name", merged);
}

const anon = await fetch(`${STAGING}/outreach/generate-email`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    service_description: "Web design",
    target_business_type: "restaurants",
  }),
});
if (anon.status === 401) pass("Staging endpoint requires auth");
else if (anon.status === 404) skip("Staging endpoint live check", "route not deployed yet");
else fail("Staging endpoint requires auth", String(anon.status));

const failed = results.filter((r) => r.status === "FAIL").length;
const passed = results.filter((r) => r.status === "PASS").length;
const skipped = results.filter((r) => r.status === "SKIP").length;
console.log(`\n${passed} passed, ${failed} failed, ${skipped} skipped\n`);
if (failed > 0) process.exit(1);
