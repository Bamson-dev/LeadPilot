/**
 * Phase 2.2 email → revenue attribution static verification.
 * Run: node backend/scripts/verify-phase22-email-attribution.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const failures = [];

function assert(cond, msg) {
  if (!cond) failures.push(msg);
}

function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

function exists(rel) {
  return fs.existsSync(path.join(root, rel));
}

assert(exists("backend/src/services/email-nurture-attribution.ts"), "nurture attribution helper missing");
assert(exists("backend/src/observability/email-revenue-report.ts"), "email revenue report missing");
assert(exists("docs/product-v2/28-phase2.2-email-revenue-attribution.md"), "phase 2.2 doc missing");

const attr = read("backend/src/services/email-nurture-attribution.ts");
assert(attr.includes("trial_nurture_v3"), "campaign constant missing");
assert(attr.includes("appendNurtureAttribution"), "append helper missing");
assert(attr.includes("NURTURE_ATTRIBUTION_WINDOW_DAYS"), "window missing");
assert(attr.includes("setIfAbsent"), "must not overwrite existing UTM keys");

const template = read("backend/src/services/email-template.ts");
assert(template.includes("appendNurtureAttribution"), "emailButton must tag nurture CTAs");
assert(template.includes("getActiveNurtureContext"), "nurture context wiring missing");

const email = read("backend/src/services/email.ts");
assert(email.includes("EVENT_NAMES.EMAIL_SENT"), "email_sent tracking missing");
assert(email.includes("withNurtureEmailContext"), "send path must wrap body in nurture context");
assert(email.includes("nurture_sent:"), "sent idempotency missing");

const trialRouter = read("backend/src/api/trial-router.ts");
assert(trialRouter.includes("EVENT_NAMES.EMAIL_OPENED"), "open → analytics missing");
assert(trialRouter.includes("recordTrialEmailOpen"), "must preserve trial_email_opens");

const publicEvents = read("backend/src/observability/public-events-router.ts");
assert(publicEvents.includes('"email_clicked"'), "email_clicked must be allowed");

const taxonomy = read("backend/src/observability/event-taxonomy.ts");
assert(taxonomy.includes("EMAIL_CLICKED"), "EMAIL_CLICKED taxonomy missing");
assert(taxonomy.includes("EMAIL_SENT"), "EMAIL_SENT taxonomy missing");
assert(taxonomy.includes("EMAIL_OPENED"), "EMAIL_OPENED taxonomy missing");

const analytics = read("frontend/lib/analytics.ts");
assert(analytics.includes("LAST_NURTURE_CLICK_KEY"), "last nurture click storage missing");
assert(analytics.includes("captureNurtureEmailClick"), "click capture missing");
assert(analytics.includes("email_clicked"), "client email_clicked missing");
assert(analytics.includes("First-touch"), "first-touch docs/comments missing");

const polish = read("backend/src/observability/admin-observability-polish.ts");
assert(polish.includes("/email-revenue"), "email-revenue route missing");
assert(polish.includes("NURTURE_EMAIL_CHANNEL"), "outreach filter must exclude nurture");

const ui = read("frontend/components/admin/workspaces/analytics-workspace.tsx");
assert(ui.includes("email-revenue"), "admin Email Revenue tab missing");
assert(ui.includes("getObservabilityEmailRevenue"), "admin API hook missing");

const v3 = read("backend/src/services/trial-email-content-v3.ts");
assert(v3.includes("checkoutCta"), "checkout CTA helper expected");
// Copy must remain — spot-check a known subject-independent body fragment
assert(v3.includes("Get Lifetime Access for $25"), "must not rewrite CTA wording");

const payment = read("backend/src/services/payment-fulfillment.ts");
assert(payment.includes("amount_usd") || payment.includes("currency"), "payment amount metadata expected");

if (failures.length) {
  console.error("FAIL Phase 2.2 attribution checks:");
  for (const f of failures) console.error(" -", f);
  process.exit(1);
}

console.log("PASS Phase 2.2 email → revenue attribution static checks");
