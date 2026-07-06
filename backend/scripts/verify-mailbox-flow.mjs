#!/usr/bin/env node
/**
 * Mailbox connect flow verification.
 *
 * Mock mode (default): in-memory DB + real Gmail SMTP for wrong-password test.
 * Staging mode: set USE_REAL_SUPABASE=1 plus SUPABASE_URL, SUPABASE_SERVICE_KEY,
 * MAILBOX_ENCRYPTION_KEY (optional: GMAIL_TEST_EMAIL, GMAIL_TEST_APP_PASSWORD).
 *
 * Optional: create backend/.env.staging with those variables and run this script.
 */
import express from "express";
import http from "http";
import { createRequire } from "node:module";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import {
  registerMailboxMocks,
  resetMailboxMocks,
  seedLicense,
  seedUser,
  mailboxCountForUser,
  getOutreachAccount,
  getLedgerForUser,
  getMailboxById,
  insertMailbox,
  setOutreachAccount,
} from "./verify-mailbox-mocks.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadEnvFiles() {
  const candidates = [
    join(__dirname, ".env.staging"),
    join(__dirname, "../.env.staging"),
  ];
  for (const path of candidates) {
    if (!existsSync(path)) continue;
    const text = readFileSync(path, "utf8");
    for (const line of text.split("\n")) {
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
    console.log(`Loaded env from ${path}`);
  }
}

loadEnvFiles();

const results = [];
const KEY =
  process.env.MAILBOX_ENCRYPTION_KEY?.trim() ||
  "9bf90eb4be912765783e5c05875295854f59c3dffbb0d3e5efd740089bdbd2fc";
process.env.MAILBOX_ENCRYPTION_KEY = KEY;
process.env.NODE_ENV = "test";
process.env.SUPABASE_URL = process.env.SUPABASE_URL || "https://mock.supabase.co";
process.env.SUPABASE_SERVICE_KEY =
  process.env.SUPABASE_SERVICE_KEY || "mock-service-key";
process.env.FRONTEND_URL = process.env.FRONTEND_URL || "https://staging.leadthur.com";
process.env.JWT_SECRET =
  process.env.JWT_SECRET || "test-jwt-secret-01234567890123456789012";

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

const useRealDb =
  process.env.USE_REAL_SUPABASE === "1" &&
  process.env.SUPABASE_URL &&
  !process.env.SUPABASE_URL.includes("mock.supabase.co") &&
  process.env.SUPABASE_SERVICE_KEY &&
  process.env.SUPABASE_SERVICE_KEY !== "mock-service-key";

{
  const { encryptMailboxSecret, decryptMailboxSecret } = await import(
    "../dist/utils/mailbox-crypto.js"
  );
  const sample = "abcd1234efgh5678";
  const encrypted = encryptMailboxSecret(sample);
  const decrypted = decryptMailboxSecret(encrypted);
  if (decrypted === sample) {
    pass("crypto roundtrip", `ciphertext length ${encrypted.length}`);
  } else {
    fail("crypto roundtrip", `got ${decrypted}`);
  }
}

if (useRealDb) {
  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY, {
    auth: { persistSession: false },
  });
  await runRealDbChecks(supabase);
  await runRealHttpTests(supabase);
} else {
  skip(
    "staging DB table + seed checks",
    "Set USE_REAL_SUPABASE=1 with SUPABASE_URL + SUPABASE_SERVICE_KEY in backend/.env.staging"
  );
  skip(
    "staging HTTP integration tests",
    "same — create backend/.env.staging from backend/.env.staging.example"
  );
  await runMockHttpTests(false);
  await runMockHttpTests(true);
}

function printSummary() {
  console.log("\n=== Summary ===");
  for (const r of results) {
    console.log(`${r.status}: ${r.label}${r.detail ? ` — ${r.detail}` : ""}`);
  }
}

printSummary();
process.exit(results.some((r) => r.status === "FAIL") ? 1 : 0);

async function runRealDbChecks(supabase) {
  const expectedTables = [
    "outreach_accounts",
    "connected_mailboxes",
    "outreach_credit_transactions",
    "sent_emails",
    "email_suppression",
    "email_templates",
  ];

  const found = [];
  for (const table of expectedTables) {
    const { error } = await supabase.from(table).select("*").limit(0);
    if (error?.code === "42P01") fail(`table ${table}`, "missing");
    else if (error) fail(`table ${table}`, error.message);
    else found.push(table);
  }
  if (found.length === expectedTables.length) {
    pass("all six outreach tables", found.join(", "));
  }

  const { data: templates, error: tplError } = await supabase
    .from("email_templates")
    .select("niche")
    .is("user_id", null);
  if (tplError) fail("four seed templates", tplError.message);
  else {
    const niches = (templates ?? []).map((t) => t.niche).sort();
    const ok = ["copywriting", "seo", "social_media", "web_design"].every((n) =>
      niches.includes(n)
    );
    ok
      ? pass("four seed templates", niches.join(", "))
      : fail("four seed templates", niches.join(", "));
  }
}

async function createStagingTestLicense(supabase, email, licenseKey) {
  const normalized = email.toLowerCase().trim();
  const key = licenseKey.toUpperCase();

  let userId;
  const { data: existingUser } = await supabase
    .from("users")
    .select("id")
    .eq("email", normalized)
    .maybeSingle();
  if (existingUser?.id) {
    userId = existingUser.id;
  } else {
    const { data: createdUser, error: userError } = await supabase
      .from("users")
      .insert({ email: normalized })
      .select("id")
      .single();
    if (userError) throw new Error(`create user: ${userError.message}`);
    userId = createdUser.id;
  }

  const { data: existingLicense } = await supabase
    .from("license_keys")
    .select("id")
    .eq("email", normalized)
    .eq("key", key)
    .maybeSingle();

  if (!existingLicense) {
    const { error: licenseError } = await supabase.from("license_keys").insert({
      email: normalized,
      key,
      activated: true,
      payment_channel: "bank_transfer",
      payment_reference: `mailbox-verify-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      max_devices: 4,
      monthly_search_limit: 100,
      is_suspended: false,
    });
    if (licenseError) throw new Error(`create license: ${licenseError.message}`);
  }

  return userId;
}

async function cleanupStagingTestUser(supabase, userId, email) {
  await supabase.from("connected_mailboxes").delete().eq("user_id", userId);
  await supabase.from("outreach_credit_transactions").delete().eq("user_id", userId);
  await supabase.from("outreach_accounts").delete().eq("user_id", userId);
  await supabase.from("license_keys").delete().eq("email", email.toLowerCase());
  await supabase.from("users").delete().eq("id", userId);
}

async function mailboxCount(supabase, userId) {
  const { count, error } = await supabase
    .from("connected_mailboxes")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);
  if (error) throw new Error(error.message);
  return count ?? 0;
}

async function runRealHttpTests(supabase) {
  clearMailboxModuleCache();
  delete process.env.MOCK_MAILBOX_SMTP;

  const { GMAIL_CONNECT_HELP } = await import("../dist/services/mailbox-smtp.js");
  const { server, base } = await startServer();

  const stamp = Date.now();
  const testEmail = `mailbox-staging-${stamp}@leadthur-verify.local`;
  const testKey = `LP-STAGING-${stamp}`;
  let userId;

  try {
    userId = await createStagingTestLicense(supabase, testEmail, testKey);
  } catch (error) {
    fail("staging test setup", error instanceof Error ? error.message : String(error));
    server.close();
    return;
  }

  const headers = {
    "Content-Type": "application/json",
    "x-license-key": testKey,
    "x-license-email": testEmail,
  };

  async function postConnect(body, customHeaders = headers) {
    const res = await fetch(`${base}/mailboxes/connect`, {
      method: "POST",
      headers: customHeaders,
      body: JSON.stringify(body),
    });
    return { status: res.status, body: await res.json().catch(() => ({})) };
  }

  const before = await mailboxCount(supabase, userId);
  const bad = await postConnect({
    email_address: "fake.tester@gmail.com",
    app_password: "abcd1234efgh5678",
    account_type: "personal",
  });
  const after = await mailboxCount(supabase, userId);
  if (bad.status === 400 && bad.body?.error === GMAIL_CONNECT_HELP && before === after) {
    pass("staging connect wrong password", `mailbox count stayed ${after}`);
  } else {
    fail("staging connect wrong password", JSON.stringify(bad));
  }

  const gmailEmail = process.env.GMAIL_TEST_EMAIL?.trim();
  const gmailPass = process.env.GMAIL_TEST_APP_PASSWORD?.replace(/\s+/g, "");
  if (gmailEmail && gmailPass) {
    const live = await postConnect({
      email_address: gmailEmail,
      app_password: gmailPass,
      account_type: "personal",
    });
    if (live.status === 201) {
      pass("staging connect live Gmail", live.body.mailbox?.email_address);
    } else {
      fail("staging connect live Gmail", JSON.stringify(live.body));
    }
  } else {
    skip("staging connect live Gmail", "GMAIL_TEST_EMAIL / GMAIL_TEST_APP_PASSWORD not set");
  }

  process.env.MOCK_MAILBOX_SMTP = "1";
  clearMailboxModuleCache();
  const { server: server2, base: base2 } = await startServer();

  const trial = await fetch(`${base2}/mailboxes/connect`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      email_address: `trial.${stamp}@gmail.com`,
      app_password: "abcd1234efgh5678",
      account_type: "personal",
    }),
  });
  const trialBody = await trial.json().catch(() => ({}));

  const { data: account } = await supabase
    .from("outreach_accounts")
    .select("free_sends_granted, free_sends_expire_at")
    .eq("user_id", userId)
    .maybeSingle();

  const { data: ledger } = await supabase
    .from("outreach_credit_transactions")
    .select("type, bucket, amount")
    .eq("user_id", userId);

  const trialGrant = (ledger ?? []).find((r) => r.type === "trial_grant");
  const days =
    account?.free_sends_expire_at &&
    (new Date(account.free_sends_expire_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24);

  if (
    trial.status === 201 &&
    account?.free_sends_granted === 200 &&
    trialGrant?.amount === 200 &&
    days > 29
  ) {
    pass("staging first connect trial grant", `expire ~${days.toFixed(1)} days`);
  } else {
    fail("staging first connect trial grant", JSON.stringify({ trialBody, account, trialGrant, days }));
  }

  const ceilingEmail = `mailbox-ceiling-${stamp}@leadthur-verify.local`;
  const ceilingKey = `LP-CEIL-${stamp}`;
  const ceilingUserId = await createStagingTestLicense(supabase, ceilingEmail, ceilingKey);
  await supabase.from("outreach_accounts").upsert({ user_id: ceilingUserId, max_mailboxes: 1 });
  await supabase.from("connected_mailboxes").insert({
    user_id: ceilingUserId,
    email_address: `first.${stamp}@gmail.com`,
    encrypted_app_password: "placeholder",
    status: "active",
    account_type: "personal",
    daily_cap: 300,
  });

  const ceilRes = await fetch(`${base2}/mailboxes/connect`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-license-key": ceilingKey,
      "x-license-email": ceilingEmail,
    },
    body: JSON.stringify({
      email_address: `second.${stamp}@gmail.com`,
      app_password: "abcd1234efgh5678",
      account_type: "personal",
    }),
  });
  const ceilBody = await ceilRes.json().catch(() => ({}));
  if (ceilRes.status === 403 && ceilBody?.code === "MAILBOX_LIMIT") {
    pass("staging mailbox ceiling", ceilBody.error);
  } else {
    fail("staging mailbox ceiling", JSON.stringify(ceilBody));
  }

  const { data: delMailbox } = await supabase
    .from("connected_mailboxes")
    .insert({
      user_id: userId,
      email_address: `delete.${stamp}@gmail.com`,
      encrypted_app_password: "cipher",
      status: "active",
      account_type: "personal",
      daily_cap: 300,
    })
    .select("id")
    .single();

  const delRes = await fetch(`${base2}/mailboxes/${delMailbox.id}`, {
    method: "DELETE",
    headers,
  });
  const { data: afterDel } = await supabase
    .from("connected_mailboxes")
    .select("status, encrypted_app_password")
    .eq("id", delMailbox.id)
    .single();

  if (
    delRes.status === 200 &&
    afterDel?.status === "disconnected" &&
    afterDel?.encrypted_app_password === null
  ) {
    pass("staging DELETE clears password", "disconnected, password null");
  } else {
    fail("staging DELETE clears password", JSON.stringify(afterDel));
  }

  server2.close();
  server.close();

  await cleanupStagingTestUser(supabase, ceilingUserId, ceilingEmail);
  await cleanupStagingTestUser(supabase, userId, testEmail);
}

async function startServer() {
  const { mailboxesRouter } = await import("../dist/routes/mailboxes.js");
  const app = express();
  app.use(express.json());
  app.use("/mailboxes", mailboxesRouter);
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  return { server, base: `http://127.0.0.1:${server.address().port}` };
}

async function runMockHttpTests(mockSmtpVerify) {
  resetMailboxMocks();
  clearMailboxModuleCache();
  if (mockSmtpVerify) {
    process.env.MOCK_MAILBOX_SMTP = "1";
  } else {
    delete process.env.MOCK_MAILBOX_SMTP;
  }
  await registerMailboxMocks({ mockSmtpVerify });

  const suffix = mockSmtpVerify ? " (mock SMTP)" : " (real SMTP)";
  const { GMAIL_CONNECT_HELP } = await import("../dist/services/mailbox-smtp.js");
  const { server, base } = await startServer();

  const testEmail = `verify-${mockSmtpVerify ? "ok" : "bad"}-${Date.now()}@test.local`;
  const testKey = `LP-VERIFY-${Date.now()}`;
  const user = seedUser(testEmail);
  seedLicense(testEmail, testKey);

  const headers = {
    "Content-Type": "application/json",
    "x-license-key": testKey,
    "x-license-email": testEmail,
  };

  async function postConnect(body, customHeaders = headers) {
    const res = await fetch(`${base}/mailboxes/connect`, {
      method: "POST",
      headers: customHeaders,
      body: JSON.stringify(body),
    });
    return { status: res.status, body: await res.json().catch(() => ({})) };
  }

  if (!mockSmtpVerify) {
    const before = mailboxCountForUser(user.id);
    const res = await postConnect({
      email_address: "fake.tester@gmail.com",
      app_password: "abcd1234efgh5678",
      account_type: "personal",
    });
    const after = mailboxCountForUser(user.id);
    if (res.status === 400 && res.body?.error === GMAIL_CONNECT_HELP && before === after) {
      pass(`connect wrong password${suffix}`, `mailbox count stayed ${after}`);
    } else {
      fail(`connect wrong password${suffix}`, JSON.stringify(res));
    }
  }

  if (mockSmtpVerify) {
    const gmailEmail = process.env.GMAIL_TEST_EMAIL?.trim();
    const gmailPass = process.env.GMAIL_TEST_APP_PASSWORD?.replace(/\s+/g, "");
    if (gmailEmail && gmailPass) {
      const res = await postConnect({
        email_address: gmailEmail,
        app_password: gmailPass,
        account_type: "personal",
      });
      if (res.status === 201) pass(`connect live Gmail${suffix}`, res.body.mailbox?.email_address);
      else fail(`connect live Gmail${suffix}`, JSON.stringify(res.body));
    } else {
      skip(`connect live Gmail${suffix}`, "GMAIL_TEST_EMAIL / GMAIL_TEST_APP_PASSWORD not in env");
    }

    const first = await postConnect({
      email_address: "first.mailbox@gmail.com",
      app_password: "abcd1234efgh5678",
      account_type: "personal",
    });
    if (first.status !== 201) {
      fail(`first mailbox connect${suffix}`, JSON.stringify(first.body));
    } else {
      const acct = getOutreachAccount(user.id);
      const trial = getLedgerForUser(user.id).find((r) => r.type === "trial_grant");
      const days =
        acct?.free_sends_expire_at &&
        (new Date(acct.free_sends_expire_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
      if (acct?.free_sends_granted === 200 && trial?.amount === 200 && days > 29) {
        pass(`first connect trial grant${suffix}`, `expire ~${days.toFixed(1)} days, ledger amount 200`);
      } else {
        fail(`first connect trial grant${suffix}`, JSON.stringify({ acct, trial, days }));
      }
    }

    const ceilingEmail = `ceiling-${Date.now()}@test.local`;
    const ceilingKey = `LP-CEIL-${Date.now()}`;
    const ceilingUser = seedUser(ceilingEmail);
    seedLicense(ceilingEmail, ceilingKey);
    setOutreachAccount(ceilingUser.id, { max_mailboxes: 1 });
    insertMailbox({
      user_id: ceilingUser.id,
      email_address: "first@gmail.com",
      encrypted_app_password: "x",
      status: "active",
      account_type: "personal",
      daily_cap: 300,
    });

    const ceilRes = await postConnect(
      {
        email_address: "second@gmail.com",
        app_password: "abcd1234efgh5678",
        account_type: "personal",
      },
      {
        "Content-Type": "application/json",
        "x-license-key": ceilingKey,
        "x-license-email": ceilingEmail,
      }
    );
    if (ceilRes.status === 403 && ceilRes.body?.code === "MAILBOX_LIMIT") {
      pass(`mailbox ceiling${suffix}`, ceilRes.body.error);
    } else {
      fail(`mailbox ceiling${suffix}`, JSON.stringify(ceilRes.body));
    }

    const mb = insertMailbox({
      user_id: user.id,
      email_address: `del-${Date.now()}@gmail.com`,
      encrypted_app_password: "secret",
      status: "active",
      account_type: "personal",
      daily_cap: 300,
    });

    const delRes = await fetch(`${base}/mailboxes/${mb.id}`, { method: "DELETE", headers });
    const afterMb = getMailboxById(mb.id);
    if (delRes.status === 200 && afterMb?.status === "disconnected" && afterMb?.encrypted_app_password === null) {
      pass(`DELETE clears password${suffix}`, "status disconnected, password null");
    } else {
      fail(`DELETE clears password${suffix}`, JSON.stringify(afterMb));
    }
  }

  server.close();
}

function clearMailboxModuleCache() {
  const require = createRequire(import.meta.url);
  for (const key of Object.keys(require.cache)) {
    if (
      key.includes("mailbox") ||
      key.includes("outreach-repository") ||
      key.includes("require-license") ||
      key.includes("database/client")
    ) {
      delete require.cache[key];
    }
  }
}
