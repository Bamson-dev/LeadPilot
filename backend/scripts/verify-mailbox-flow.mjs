#!/usr/bin/env node
/**
 * Mailbox connect flow verification.
 * With USE_REAL_SUPABASE=1 + credentials: runs against live Supabase.
 * Otherwise: in-memory mock DB + real Gmail SMTP for wrong-password test.
 */
import express from "express";
import http from "http";
import { createRequire } from "node:module";
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

const results = [];
const KEY = process.env.MAILBOX_ENCRYPTION_KEY?.trim() || "9bf90eb4be912765783e5c05875295854f59c3dffbb0d3e5efd740089bdbd2fc";
process.env.MAILBOX_ENCRYPTION_KEY = KEY;
process.env.NODE_ENV = "test";
process.env.SUPABASE_URL = process.env.SUPABASE_URL || "https://mock.supabase.co";
process.env.SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || "mock-service-key";
process.env.FRONTEND_URL = process.env.FRONTEND_URL || "https://staging.leadthur.com";
process.env.JWT_SECRET = process.env.JWT_SECRET || "test-jwt-secret-01234567890123456789012";

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
  await runRealDbChecks();
} else {
  skip(
    "migration tables listed from DB",
    "LeadThur staging Supabase MCP times out (linked project wffwhktwessvlubndkmj DNS dead). Run: SUPABASE_PROJECT_REF=<ref> SUPABASE_DB_PASSWORD=<pwd> node backend/scripts/apply-migration-030.mjs"
  );
  skip("four seed templates from DB", "same blocker — SQL ready at supabase/migrations/030_outreach_mailboxes.sql");
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

async function runRealDbChecks() {
  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY, {
    auth: { persistSession: false },
  });

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
    const ok = ["copywriting", "seo", "social_media", "web_design"].every((n) => niches.includes(n));
    ok ? pass("four seed templates", niches.join(", ")) : fail("four seed templates", niches.join(", "));
  }
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
