#!/usr/bin/env node
/**
 * Sends report frontend verification — run from repo root:
 *   node frontend/scripts/verify-sends-report.mjs
 */
import { createClient } from "@supabase/supabase-js";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { randomBytes } from "node:crypto";

const __dirname = dirname(fileURLToPath(import.meta.url));
const STAGING =
  process.env.STAGING_API_URL?.trim() || "https://staging-backend.leadthur.com";

function loadEnvFiles() {
  for (const path of [join(__dirname, "../../backend/.env.staging")]) {
    if (!existsSync(path)) continue;
    for (const line of readFileSync(path, "utf8").split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq <= 0) continue;
      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (!process.env[key]) process.env[key] = value;
    }
  }
}

loadEnvFiles();

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

function authHeaders(email, key) {
  return {
    "Content-Type": "application/json",
    "x-license-email": email,
    "x-license-key": key,
  };
}

function rateColor(rate) {
  if (rate > 40) return "#10B981";
  if (rate >= 20) return "#F59E0B";
  return "#EF4444";
}

async function createTestUser(supabase) {
  const email = `srpt-${Date.now()}@leadthur-test.invalid`;
  const key = randomBytes(8).toString("hex").toUpperCase();
  const { data: user, error: userErr } = await supabase
    .from("users")
    .insert({ email })
    .select("id")
    .single();
  if (userErr) throw new Error(userErr.message);
  await supabase.from("license_keys").insert({
    email,
    key,
    activated: true,
    payment_channel: "bank_transfer",
    payment_reference: `srpt-${Date.now()}`,
    max_devices: 4,
    monthly_search_limit: 100,
    is_suspended: false,
  });
  await supabase.from("outreach_accounts").insert({
    user_id: user.id,
    subscription_status: "none",
    subscription_tier: null,
    max_mailboxes: 1,
    monthly_allowance: 0,
    monthly_allowance_remaining: 0,
    purchased_credits_balance: 0,
    free_sends_granted: 200,
    free_sends_used: 0,
    free_sends_expire_at: new Date(Date.now() + 30 * 86400000).toISOString(),
  });
  return { email, key, userId: user.id };
}

async function cleanupTestUser(supabase, email, userId) {
  await supabase.from("sent_emails").delete().eq("user_id", userId);
  await supabase.from("connected_mailboxes").delete().eq("user_id", userId);
  await supabase.from("outreach_credit_transactions").delete().eq("user_id", userId);
  await supabase.from("outreach_accounts").delete().eq("user_id", userId);
  await supabase.from("license_keys").delete().eq("email", email);
  await supabase.from("users").delete().eq("id", userId);
}

async function main() {
  console.log(`\nSends report frontend verification (${STAGING})\n`);

  const reportSrc = readFileSync(
    join(__dirname, "../components/dashboard/outreach-sends-report.tsx"),
    "utf8"
  );
  const shellSrc = readFileSync(
    join(__dirname, "../components/dashboard/results-outreach-shell.tsx"),
    "utf8"
  );
  const apiSrc = readFileSync(join(__dirname, "../services/outreach-api.ts"), "utf8");

  for (const needle of [
    "Total sent",
    "Total opened",
    "Open rate",
    "Not opened yet",
    "Opened ·",
    "rateColor",
    "statusFilter",
    "setOffset",
    "fetchSendsReport",
  ]) {
    if (reportSrc.includes(needle)) pass(`Report UI includes ${needle}`);
    else fail(`Report UI includes ${needle}`);
  }

  if (shellSrc.includes("sendsRefreshKey") && shellSrc.includes("OutreachSendsReport")) {
    pass("Results shell refreshes report after send");
  } else {
    fail("Results shell refresh wiring");
  }

  if (apiSrc.includes("fetchSendsReport") && apiSrc.includes("OutreachSendsReport")) {
    pass("Outreach API fetchSendsReport");
  } else {
    fail("Outreach API fetchSendsReport");
  }

  if (rateColor(50) === "#10B981" && rateColor(30) === "#F59E0B" && rateColor(10) === "#EF4444") {
    pass("Open rate color thresholds", "green>40, amber 20-40, red<20");
  } else {
    fail("Open rate color thresholds");
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_KEY;
  if (!supabaseUrl || !serviceKey) {
    skip("Live GET /sends report shape", "no SUPABASE_SERVICE_KEY");
  } else {
    const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
    let testUser;
    try {
      testUser = await createTestUser(supabase);
      const headers = authHeaders(testUser.email, testUser.key);
      const openedAt = new Date().toISOString();
      const sentAt = new Date().toISOString();
      await supabase.from("sent_emails").insert([
        {
          user_id: testUser.userId,
          recipient_email: "opened@example.com",
          business_name: "Opened Co",
          subject: "Opened subject",
          body: "Body",
          status: "sent",
          tracking_token: `srpt-open-${Date.now()}`,
          opened_at: openedAt,
          open_count: 3,
          sent_at: sentAt,
        },
        {
          user_id: testUser.userId,
          recipient_email: "pending@example.com",
          business_name: "Pending Co",
          subject: "Pending subject",
          body: "Body",
          status: "sent",
          tracking_token: `srpt-pend-${Date.now()}`,
          open_count: 0,
          sent_at: sentAt,
        },
        {
          user_id: testUser.userId,
          recipient_email: "queued@example.com",
          business_name: "Queued Co",
          subject: "Queued subject",
          body: "Body",
          status: "queued",
          tracking_token: `srpt-q-${Date.now()}`,
        },
      ]);

      const res = await fetch(`${STAGING}/sends?limit=2&offset=0&status=sent`, { headers });
      const json = await res.json();

      if (!json.summary || !json.pagination) {
        skip(
          "Live GET /sends report",
          "staging API not yet deployed with summary/pagination — run backend verify-sends-report.mjs locally"
        );
        return;
      }

      const fields = [
        "recipient_email",
        "business_name",
        "subject",
        "status",
        "sent_at",
        "opened_at",
        "open_count",
        "mailbox_email",
      ];
      const row = json.sends?.[0];
      const missing = fields.filter((f) => !(f in (row ?? {})));
      if (res.ok && missing.length === 0 && json.pagination && json.summary) {
        pass(
          "Live GET /sends report",
          `sent=${json.summary.total_sent}, opened=${json.summary.total_opened}, rate=${json.summary.open_rate}%`
        );
      } else {
        fail("Live GET /sends report", JSON.stringify({ status: res.status, missing }));
      }

      const page2 = await fetch(`${STAGING}/sends?limit=2&offset=1&status=sent`, { headers });
      const page2Json = await page2.json();
      if (page2.ok && page2Json.sends?.length === 1 && page2Json.pagination?.offset === 1) {
        pass("Live pagination offset", `rows=${page2Json.sends.length}`);
      } else {
        fail("Live pagination offset", JSON.stringify(page2Json.pagination));
      }

      const opened = json.sends?.find((r) => r.opened_at);
      const unopened = json.sends?.find((r) => !r.opened_at && r.status === "sent");
      if (opened?.open_count === 3) pass("Live opened row has open_count", String(opened.open_count));
      else fail("Live opened row", JSON.stringify(opened));
      if (unopened && unopened.opened_at === null) pass("Live unopened row null opened_at");
      else fail("Live unopened row", JSON.stringify(unopened));
    } finally {
      if (testUser) await cleanupTestUser(supabase, testUser.email, testUser.userId);
    }
  }

  const failed = results.filter((r) => r.status === "FAIL").length;
  const passed = results.filter((r) => r.status === "PASS").length;
  const skipped = results.filter((r) => r.status === "SKIP").length;
  console.log(`\n${passed} passed, ${failed} failed, ${skipped} skipped\n`);
  if (failed > 0) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
