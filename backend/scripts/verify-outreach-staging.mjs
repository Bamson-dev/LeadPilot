#!/usr/bin/env node
/**
 * Staging integration checks after migration 031 (uses backend/.env.staging).
 */
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const STAGING_API = process.env.STAGING_API_URL || "https://staging-backend.leadthur.com";

function loadEnvFiles() {
  for (const path of [join(__dirname, ".env.staging"), join(__dirname, "../.env.staging")]) {
    if (!existsSync(path)) continue;
    console.log(`Loaded env from ${path}`);
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

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_KEY;
if (!url || !key || url.includes("mock.supabase")) {
  console.error("Need SUPABASE_URL + SUPABASE_SERVICE_KEY in backend/.env.staging");
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { persistSession: false } });

async function checkMigration031() {
  const { data: plans, error: planErr } = await supabase
    .from("outreach_paystack_plans")
    .select("tier, plan_code, amount_kobo, monthly_allowance, max_mailboxes")
    .order("amount_kobo", { ascending: true });

  if (planErr) {
    fail("migration 031 outreach_paystack_plans table", planErr.message);
    return;
  }
  pass("migration 031 outreach_paystack_plans table", `rows=${plans?.length ?? 0}`);

  const { data: sample, error: acctErr } = await supabase
    .from("outreach_accounts")
    .select("user_id, subscription_status, paystack_subscription_code, grace_until")
    .limit(1);

  if (acctErr) {
    fail("migration 031 outreach_accounts columns", acctErr.message);
    return;
  }
  pass("migration 031 outreach_accounts columns", `readable, sample rows=${sample?.length ?? 0}`);

  if (plans?.length === 3) {
    pass(
      "paystack plans in DB",
      plans.map((p) => `${p.tier}=${p.plan_code}`).join(", ")
    );
  } else {
    fail("paystack plans in DB", JSON.stringify(plans));
  }
}

async function checkStagingHttp() {
  const health = await fetch(`${STAGING_API}/health`);
  if (health.status === 200) pass("staging /health", String(health.status));
  else fail("staging /health", String(health.status));

  const balance = await fetch(`${STAGING_API}/balance`);
  if (balance.status === 401) pass("staging GET /balance live", "401 without license (route exists)");
  else if (balance.status === 404) fail("staging GET /balance live", "404 — deploy may be pending");
  else fail("staging GET /balance live", String(balance.status));

  const checkout = await fetch(`${STAGING_API}/checkout`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type: "pack", pack_id: "small" }),
  });
  if (checkout.status === 401) pass("staging POST /checkout live", "401 without license (route exists)");
  else if (checkout.status === 404) fail("staging POST /checkout live", "404 — deploy may be pending");
  else fail("staging POST /checkout live", String(checkout.status));

  const send = await fetch(`${STAGING_API}/send`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ targets: [], subject: "x", body: "x" }),
  });
  if (send.status === 401) pass("staging POST /send live", "401 without license");
  else fail("staging POST /send live", String(send.status));
}

async function simulatePackWebhook(userId) {
  const secret = process.env.PAYSTACK_SECRET_KEY?.trim();
  if (!secret) {
    skip("live pack webhook on staging DB", "PAYSTACK_SECRET_KEY not in .env.staging");
    return;
  }

  const reference = `LT-STG-TEST-${Date.now()}`;
  const payload = {
    event: "charge.success",
    data: {
      reference,
      amount: 500_000,
      metadata: {
        outreach_type: "pack",
        user_id: userId,
        pack_id: "small",
      },
    },
  };
  const rawBody = JSON.stringify(payload);
  const signature = crypto.createHmac("sha512", secret).update(rawBody).digest("hex");

  const res = await fetch(`${STAGING_API}/webhooks/paystack`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-paystack-signature": signature,
    },
    body: rawBody,
  });

  if (res.status !== 200) {
    fail("live pack webhook HTTP", String(res.status));
    return;
  }

  await new Promise((r) => setTimeout(r, 1500));

  const { data: acct } = await supabase
    .from("outreach_accounts")
    .select("purchased_credits_balance")
    .eq("user_id", userId)
    .maybeSingle();

  const { data: ledger } = await supabase
    .from("outreach_credit_transactions")
    .select("type, bucket, amount, reference")
    .eq("user_id", userId)
    .eq("reference", reference);

  if (ledger?.length === 1 && ledger[0].amount === 1000 && ledger[0].bucket === "purchased_credits") {
    pass("live pack webhook credits ledger", `ref=${reference}, amount=1000`);
  } else {
    fail("live pack webhook credits ledger", JSON.stringify({ acct, ledger }));
  }

  const { error: cleanupLedger } = await supabase
    .from("outreach_credit_transactions")
    .delete()
    .eq("reference", reference);
  if (acct?.purchased_credits_balance != null) {
    await supabase
      .from("outreach_accounts")
      .update({ purchased_credits_balance: Math.max(0, acct.purchased_credits_balance - 1000) })
      .eq("user_id", userId);
  }
  if (!cleanupLedger) pass("live pack webhook cleanup", "test row removed");
}

async function seedTestUser() {
  const stamp = Date.now();
  const email = `outreach-stg-${stamp}@leadthur-verify.local`;
  const { data: user, error: userErr } = await supabase
    .from("users")
    .insert({ email })
    .select("id")
    .single();
  if (userErr) throw userErr;

  const licenseKey = `LP-STG-${stamp}`;
  const { error: licErr } = await supabase.from("license_keys").insert({
    email,
    key: licenseKey,
    activated: true,
    is_suspended: false,
  });
  if (licErr) throw licErr;

  const { error: acctErr } = await supabase.from("outreach_accounts").insert({
    user_id: user.id,
    purchased_credits_balance: 0,
  });
  if (acctErr) throw acctErr;

  return { userId: user.id, email, licenseKey };
}

async function checkBalanceEndpoint({ email, licenseKey, userId }) {
  const res = await fetch(`${STAGING_API}/balance`, {
    headers: {
      "x-license-key": licenseKey,
      "x-license-email": email,
    },
  });
  const body = await res.json().catch(() => ({}));
  if (res.status === 200 && typeof body.send_balance === "number") {
    pass("staging GET /balance authed", `send_balance=${body.send_balance}`);
  } else {
    fail("staging GET /balance authed", JSON.stringify({ status: res.status, body }));
  }
}

await checkMigration031();
await checkStagingHttp();

try {
  const testUser = await seedTestUser();
  try {
    await checkBalanceEndpoint(testUser);
    await simulatePackWebhook(testUser.userId);
  } finally {
    await supabase.from("outreach_credit_transactions").delete().eq("user_id", testUser.userId);
    await supabase.from("outreach_accounts").delete().eq("user_id", testUser.userId);
    await supabase.from("license_keys").delete().eq("email", testUser.email);
    await supabase.from("users").delete().eq("id", testUser.userId);
  }
} catch (err) {
  fail("staging test user flow", err instanceof Error ? err.message : String(err));
}

console.log("\n=== Summary ===");
for (const r of results) {
  console.log(`${r.status}: ${r.label}${r.detail ? ` — ${r.detail}` : ""}`);
}
process.exit(results.some((r) => r.status === "FAIL") ? 1 : 0);
