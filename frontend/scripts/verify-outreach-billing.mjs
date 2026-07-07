#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const plansPath = join(root, "app/dashboard/plans/page.tsx");
const apiPath = join(root, "services/outreach-api.ts");
const successPath = join(root, "app/checkout/success/page.tsx");
const topBarPath = join(root, "components/dashboard/outreach-top-bar.tsx");
const mailboxPath = join(root, "components/dashboard/outreach-mailbox-section.tsx");

const plans = readFileSync(plansPath, "utf8");
const api = readFileSync(apiPath, "utf8");
const success = readFileSync(successPath, "utf8");
const topBar = readFileSync(topBarPath, "utf8");
const mailbox = readFileSync(mailboxPath, "utf8");

const checks = [];

function check(label, condition, detail = "") {
  checks.push({ label, ok: Boolean(condition), detail });
  const prefix = condition ? "PASS" : "FAIL";
  console.log(`${prefix}: ${label}${detail ? ` — ${detail}` : ""}`);
}

check(
  "plans page has starter tier",
  plans.includes('id: "starter"') &&
    plans.includes("amount_ngn: 5000") &&
    plans.includes("monthly_allowance: 1500") &&
    plans.includes("max_mailboxes: 1")
);
check(
  "plans page has growth tier",
  plans.includes('id: "growth"') &&
    plans.includes("amount_ngn: 10000") &&
    plans.includes("monthly_allowance: 5000") &&
    plans.includes("max_mailboxes: 3")
);
check(
  "plans page has scale tier",
  plans.includes('id: "scale"') &&
    plans.includes("amount_ngn: 20000") &&
    plans.includes("monthly_allowance: 15000") &&
    plans.includes("max_mailboxes: 5")
);
check(
  "plans page has small pack",
  plans.includes('id: "small"') &&
    plans.includes("amount_ngn: 5000") &&
    plans.includes("credits: 1000")
);
check(
  "plans page has medium pack",
  plans.includes('id: "medium"') &&
    plans.includes("amount_ngn: 10000") &&
    plans.includes("credits: 3500")
);
check(
  "plans page has large pack",
  plans.includes('id: "large"') &&
    plans.includes("amount_ngn: 20000") &&
    plans.includes("credits: 10000")
);
check(
  "subscription checkout posts correct payload",
  api.includes("initializeOutreachSubscriptionCheckout") &&
    api.includes('type: "subscription"') &&
    api.includes("tier")
);
check(
  "pack checkout posts correct payload",
  api.includes("initializeOutreachPackCheckout") &&
    api.includes('type: "pack"') &&
    api.includes("pack_id: packId")
);
check(
  "return handler detects outreach reference",
  success.includes('reference.startsWith("LT-OUT-")')
);
check(
  "return handler polls outreach balance",
  success.includes("maxAttempts = 6") &&
    success.includes("await fetchOutreachBalance()") &&
    success.includes("setTimeout(resolve, pollDelayMs)")
);
check(
  "return handler shows pending webhook state",
  success.includes("webhook is still processing")
);
check(
  "top bar links to outreach billing",
  topBar.includes('href="/dashboard/plans"') && topBar.includes("Buy outreach sends")
);
check(
  "mailboxes tab area links to outreach billing",
  mailbox.includes('href="/dashboard/plans"') && mailbox.includes("Open outreach billing")
);
check(
  "billing copy keeps outreach separate from search credits",
  plans.includes("This does not purchase search credits") &&
    plans.includes("separate from search credits")
);

const failed = checks.filter((c) => !c.ok);
console.log(`\n${checks.length - failed.length}/${checks.length} passed`);
if (failed.length > 0) process.exit(1);
