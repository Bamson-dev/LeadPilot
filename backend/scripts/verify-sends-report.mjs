#!/usr/bin/env node
/**
 * GET /sends report verification — run from repo root after backend build:
 *   node backend/scripts/verify-sends-report.mjs
 */
import express from "express";
import http from "http";
import { createRequire } from "node:module";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  registerMailboxMocks,
  resetMailboxMocks,
  seedLicense,
  seedUser,
  setOutreachAccount,
  insertMailbox,
  insertSentEmail,
  getSentEmailsForUser,
} from "./verify-mailbox-mocks.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadEnvFiles() {
  for (const path of [join(__dirname, ".env.staging"), join(__dirname, "../.env.staging")]) {
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

process.env.NODE_ENV = "test";
process.env.SUPABASE_URL = process.env.SUPABASE_URL || "https://mock.supabase.co";
process.env.SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || "mock-service-key";
process.env.JWT_SECRET = process.env.JWT_SECRET || "test-jwt-secret-01234567890123456789012";
delete process.env.REDIS_URL;

const results = [];

function pass(label, detail = "") {
  results.push({ label, status: "PASS", detail });
  console.log(`PASS: ${label}${detail ? ` — ${detail}` : ""}`);
}

function fail(label, detail = "") {
  results.push({ label, status: "FAIL", detail });
  console.error(`FAIL: ${label}${detail ? ` — ${detail}` : ""}`);
}

function clearModuleCache() {
  const require = createRequire(import.meta.url);
  for (const key of Object.keys(require.cache)) {
    if (
      key.includes("/dist/") ||
      key.includes("outreach") ||
      key.includes("database/client") ||
      key.includes("require-license")
    ) {
      delete require.cache[key];
    }
  }
}

function authHeaders(email, key) {
  return {
    "x-license-key": key,
    "x-license-email": email,
  };
}

async function startApp() {
  const { sendsRouter } = await import("../dist/routes/sends.js");
  const app = express();
  app.use(express.json());
  app.use("/sends", sendsRouter);
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  return { server, base: `http://127.0.0.1:${server.address().port}` };
}

async function runTests() {
  resetMailboxMocks();
  clearModuleCache();
  await registerMailboxMocks({ mockSmtpVerify: true });

  const stamp = Date.now();
  const email = `sends-report-${stamp}@test.local`;
  const key = `LP-SR-${stamp}`;
  const user = seedUser(email);
  seedLicense(email, key);
  setOutreachAccount(user.id, { monthly_allowance_remaining: 10 });

  const mailbox = insertMailbox({
    user_id: user.id,
    email_address: `sender.${stamp}@gmail.com`,
    encrypted_app_password: "cipher",
    account_type: "personal",
    status: "active",
    daily_cap: 300,
    daily_send_count: 0,
    daily_count_reset_at: new Date().toISOString(),
  });

  const openedAt = new Date(Date.now() - 3600000).toISOString();
  const sentAt = new Date(Date.now() - 7200000).toISOString();

  for (let i = 0; i < 5; i++) {
    insertSentEmail({
      user_id: user.id,
      recipient_email: `lead${i}@example.com`,
      business_name: `Biz ${i}`,
      subject: `Subject ${i}`,
      body: "Body",
      tracking_token: `tok-${stamp}-${i}`,
      status: i < 3 ? "sent" : "queued",
      mailbox_id: mailbox.id,
      sent_at: i < 3 ? sentAt : null,
      opened_at: i === 0 ? openedAt : null,
      open_count: i === 0 ? 2 : 0,
    });
  }
  insertSentEmail({
    user_id: user.id,
    recipient_email: "failed@example.com",
    business_name: "Failed Co",
    subject: "Failed subject",
    body: "Body",
    tracking_token: `tok-fail-${stamp}`,
    status: "failed",
    mailbox_id: mailbox.id,
    error_message: "SMTP rejected",
  });

  const { server, base } = await startApp();
  const headers = authHeaders(email, key);

  const listRes = await fetch(`${base}/sends?limit=3&offset=0`, { headers });
  const listJson = await listRes.json();

  if (listRes.status !== 200) {
    fail("GET /sends status", String(listRes.status));
  } else {
    pass("GET /sends status", "200");
  }

  const requiredFields = [
    "recipient_email",
    "business_name",
    "subject",
    "status",
    "sent_at",
    "opened_at",
    "open_count",
    "mailbox_email",
  ];
  const first = listJson.sends?.[0];
  const missing = requiredFields.filter((field) => !(field in (first ?? {})));
  if (missing.length === 0 && listJson.sends?.length === 3) {
    pass("GET /sends per-row fields", `mailbox_email=${first.mailbox_email}`);
  } else {
    fail("GET /sends per-row fields", JSON.stringify({ missing, count: listJson.sends?.length }));
  }

  if (
    listJson.summary &&
    typeof listJson.summary.total_sent === "number" &&
    typeof listJson.summary.total_opened === "number" &&
    typeof listJson.summary.open_rate === "number" &&
    typeof listJson.summary.in_progress === "number"
  ) {
    pass(
      "GET /sends summary",
      `sent=${listJson.summary.total_sent}, opened=${listJson.summary.total_opened}, rate=${listJson.summary.open_rate}%`
    );
  } else {
    fail("GET /sends summary", JSON.stringify(listJson.summary));
  }

  if (
    listJson.pagination?.limit === 3 &&
    listJson.pagination?.offset === 0 &&
    listJson.pagination?.total === 6
  ) {
    pass("GET /sends pagination metadata", `total=${listJson.pagination.total}`);
  } else {
    fail("GET /sends pagination metadata", JSON.stringify(listJson.pagination));
  }

  const page2 = await fetch(`${base}/sends?limit=3&offset=3`, { headers });
  const page2Json = await page2.json();
  if (page2Json.sends?.length === 3 && page2Json.pagination?.offset === 3) {
    pass("GET /sends pagination offset", `page2 count=${page2Json.sends.length}`);
  } else {
    fail("GET /sends pagination offset", JSON.stringify({ count: page2Json.sends?.length }));
  }

  const sentOnly = await fetch(`${base}/sends?status=sent`, { headers });
  const sentJson = await sentOnly.json();
  if (
    sentJson.sends?.every((row) => row.status === "sent") &&
    sentJson.sends?.length === 3 &&
    sentJson.pagination?.total === 3
  ) {
    pass("GET /sends status filter", `sent rows=${sentJson.sends.length}`);
  } else {
    fail(
      "GET /sends status filter",
      JSON.stringify({ count: sentJson.sends?.length, total: sentJson.pagination?.total })
    );
  }

  const failedOnly = await fetch(`${base}/sends?status=failed`, { headers });
  const failedJson = await failedOnly.json();
  if (failedJson.sends?.length === 1 && failedJson.sends[0]?.recipient_email === "failed@example.com") {
    pass("GET /sends failed filter", failedJson.sends[0].recipient_email);
  } else {
    fail("GET /sends failed filter", JSON.stringify(failedJson.sends));
  }

  const openedRow = sentJson.sends?.find((row) => row.opened_at);
  const unopenedRow = sentJson.sends?.find((row) => row.status === "sent" && !row.opened_at);
  if (openedRow?.open_count === 2 && openedRow?.opened_at) {
    pass("Open tracking fields on opened row", `open_count=${openedRow.open_count}`);
  } else {
    fail("Open tracking fields on opened row", JSON.stringify(openedRow));
  }
  if (unopenedRow && unopenedRow.opened_at === null && unopenedRow.open_count === 0) {
    pass("Open tracking null on unopened row", unopenedRow.recipient_email);
  } else {
    fail("Open tracking null on unopened row", JSON.stringify(unopenedRow));
  }

  if (listJson.summary?.total_sent === 3 && listJson.summary?.total_opened === 1) {
    pass("Summary open rate calculation", `rate=${listJson.summary.open_rate}% (expected 33.3)`);
  } else {
    fail(
      "Summary open rate calculation",
      JSON.stringify({
        total_sent: listJson.summary?.total_sent,
        total_opened: listJson.summary?.total_opened,
      })
    );
  }

  const anon = await fetch(`${base}/sends`);
  if (anon.status === 401) {
    pass("GET /sends requires auth");
  } else {
    fail("GET /sends requires auth", String(anon.status));
  }

  const dbRows = getSentEmailsForUser(user.id);
  if (dbRows.length === 6) {
    pass("Seed data integrity", `rows=${dbRows.length}`);
  } else {
    fail("Seed data integrity", `rows=${dbRows.length}`);
  }

  server.close();
}

await runTests();

console.log("\n=== Summary ===");
for (const r of results) {
  console.log(`${r.status}: ${r.label}${r.detail ? ` — ${r.detail}` : ""}`);
}
process.exit(results.some((r) => r.status === "FAIL") ? 1 : 0);
