#!/usr/bin/env node
/**
 * Sends report status + guided Gmail connect verification.
 * Run from repo root after backend build:
 *   npm run build --workspace=@leadthur/shared
 *   npm run build --workspace=@leadthur/backend
 *   node backend/scripts/verify-sends-report-status.mjs
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
const repoRoot = join(__dirname, "../..");

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
process.env.MOCK_OUTREACH_SEND = "1";
process.env.OUTREACH_SEND_SKIP_SPACING = "1";
process.env.MAILBOX_ENCRYPTION_KEY =
  process.env.MAILBOX_ENCRYPTION_KEY?.trim() ||
  "9bf90eb4be912765783e5c05875295854f59c3dffbb0d3e5efd740089bdbd2fc";
process.env.SUPABASE_URL = process.env.SUPABASE_URL || "https://mock.supabase.co";
process.env.SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || "mock-service-key";
process.env.FRONTEND_URL = process.env.FRONTEND_URL || "https://staging.leadthur.com";
process.env.JWT_SECRET = process.env.JWT_SECRET || "test-jwt-secret-01234567890123456789012";
process.env.ADMIN_EMAIL = process.env.ADMIN_EMAIL || "admin@test.local";
process.env.ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "test-admin-password";
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
      key.includes("require-license") ||
      key.includes("mailbox")
    ) {
      delete require.cache[key];
    }
  }
}

function authHeaders(email, key) {
  return {
    "Content-Type": "application/json",
    "x-license-key": key,
    "x-license-email": email,
  };
}

async function startApp() {
  const { sendsRouter } = await import("../dist/routes/sends.js");
  const { sendRouter } = await import("../dist/routes/send.js");
  const { outreachTrackingRouter } = await import("../dist/routes/outreach-tracking.js");
  const { mailboxesRouter } = await import("../dist/routes/mailboxes.js");
  const { flushInlineOutreachSendQueue } = await import("../dist/queue/outreach-send-queue.js");

  const app = express();
  app.use(express.json());
  app.use("/sends", sendsRouter);
  app.use("/send", sendRouter);
  app.use("/outreach", outreachTrackingRouter);
  app.use("/mailboxes", mailboxesRouter);

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  return {
    server,
    base: `http://127.0.0.1:${server.address().port}`,
    flushInlineOutreachSendQueue,
  };
}

function readFrontend(relPath) {
  return readFileSync(join(repoRoot, "frontend", relPath), "utf8");
}

async function runTests() {
  resetMailboxMocks();
  clearModuleCache();
  await registerMailboxMocks({ mockSmtpVerify: true });

  const email = "report-status@example.com";
  const key = "TEST-REPORT-STATUS-KEY";
  const user = seedUser(email);
  const license = seedLicense(email, key);
  const headers = authHeaders(email, key);

  await setOutreachAccount(user.id, {
    free_sends_granted: 10,
    free_sends_used: 0,
    monthly_allowance_remaining: 0,
    purchased_credits_balance: 0,
    max_mailboxes: 1,
  });

  const mailbox = await insertMailbox({
    user_id: user.id,
    email_address: "sender@gmail.com",
    encrypted_app_password: "cipher",
    account_type: "personal",
    status: "active",
    daily_cap: 300,
    daily_send_count: 0,
  });

  const { server, base, flushInlineOutreachSendQueue } = await startApp();

  const queuedOnly = await fetch(`${base}/sends`, { headers });
  const queuedJson = await queuedOnly.json();
  if (queuedJson.summary?.total_sent === 0 && queuedJson.summary?.in_progress === 0) {
    pass("Empty report baseline", `sent=0, in_progress=0`);
  } else {
    fail("Empty report baseline", JSON.stringify(queuedJson.summary));
  }

  const sendRes = await fetch(`${base}/send`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      targets: [
        {
          recipient_email: "lead1@example.com",
          business_name: "Lead One",
          email_kind: "verified",
        },
        {
          recipient_email: "lead2@example.com",
          business_name: "Lead Two",
          email_kind: "verified",
        },
      ],
      subject: "Hello [Business Name]",
      body: "Quick note for [Business Name].",
      send_mode: "manual",
      mailbox_id: mailbox.id,
    }),
  });
  const sendJson = await sendRes.json();
  if (sendRes.status === 202 && sendJson.queued === 2) {
    pass("POST /send queues rows", `queued=${sendJson.queued}`);
  } else {
    fail("POST /send queues rows", JSON.stringify(sendJson));
  }

  await flushInlineOutreachSendQueue();

  await insertSentEmail({
    user_id: user.id,
    recipient_email: "queued-a@example.com",
    business_name: "Queued A",
    subject: "Queued",
    body: "Queued body",
    status: "queued",
    tracking_token: `queued-a-${Date.now()}`,
  });
  await insertSentEmail({
    user_id: user.id,
    recipient_email: "queued-b@example.com",
    business_name: "Queued B",
    subject: "Queued",
    body: "Queued body",
    status: "sending",
    tracking_token: `queued-b-${Date.now()}`,
  });

  const midRes = await fetch(`${base}/sends`, { headers });
  const midJson = await midRes.json();
  if (midJson.summary?.in_progress >= 2 && midJson.summary?.total_sent >= 2) {
    pass(
      "Queued/sending rows show in_progress in summary",
      `in_progress=${midJson.summary.in_progress}, sent=${midJson.summary.total_sent}`
    );
  } else {
    fail("Queued in_progress summary", JSON.stringify(midJson.summary));
  }

  const rows = getSentEmailsForUser(user.id);
  const sentFromWorker = rows.filter((r) => r.status === "sent");
  if (sentFromWorker.length >= 2) {
    pass("Worker marked queued sends as sent", `sent_rows=${sentFromWorker.length}`);
  } else {
    fail("Worker marked queued sends as sent", JSON.stringify(rows.map((r) => r.status)));
  }

  const token = sentFromWorker[0]?.tracking_token;
  const openRes = await fetch(`${base}/outreach/open/${token}`);
  if (openRes.status === 200) {
    pass("Open pixel records", `status=${openRes.status}`);
  } else {
    fail("Open pixel records", String(openRes.status));
  }

  const openedRes = await fetch(`${base}/sends?status=sent`, { headers });
  const openedJson = await openedRes.json();
  if (openedJson.summary?.total_opened === 1 && openedJson.summary?.open_rate === 50) {
    pass(
      "Open shows in report",
      `opened=${openedJson.summary.total_opened}, rate=${openedJson.summary.open_rate}%`
    );
  } else {
    fail("Open in report", JSON.stringify(openedJson.summary));
  }

  const badPassRes = await fetch(`${base}/mailboxes/connect`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      email_address: "sender@gmail.com",
      app_password: "short",
      account_type: "personal",
    }),
  });
  const badPassJson = await badPassRes.json();
  if (badPassRes.status === 400 && badPassJson.code === "INVALID_APP_PASSWORD_LENGTH") {
    pass("Short password error code", badPassJson.code);
  } else {
    fail("Short password error code", JSON.stringify(badPassJson));
  }

  const guided = readFrontend("components/dashboard/outreach-guided-mailbox-connect.tsx");
  const checks = [
    ["step 1 link", guided.includes("https://myaccount.google.com/signinoptions/twosv")],
    ["step 2 link", guided.includes("https://myaccount.google.com/apppasswords")],
    ["step gating", guided.includes("step === 1") && guided.includes("step === 2")],
    ["login rejected", guided.includes("login_rejected")],
    ["short password", guided.includes("short_password")],
    ["blocked account", guided.includes("app_passwords_blocked")],
    ["why line", guided.includes("replies land in")],
  ];
  for (const [label, ok] of checks) {
    if (ok) pass(`Guided connect UI: ${label}`);
    else fail(`Guided connect UI: ${label}`);
  }

  const mailboxSection = readFrontend("components/dashboard/outreach-mailbox-section.tsx");
  if (mailboxSection.includes("OutreachGuidedMailboxConnect")) {
    pass("Mailbox section uses guided connect");
  } else {
    fail("Mailbox section uses guided connect");
  }

  const workspace = readFrontend("components/dashboard/outreach-workspace.tsx");
  if (workspace.includes('setActiveTab("sends")')) {
    pass("Workspace switches to sends tab after queue");
  } else {
    fail("Workspace switches to sends tab after queue");
  }

  const reportUi = readFrontend("components/dashboard/outreach-sends-report.tsx");
  if (reportUi.includes("in_progress") && reportUi.includes("setInterval")) {
    pass("Sends report polls while delivering");
  } else {
    fail("Sends report polls while delivering");
  }

  server.close();
}

await runTests();

console.log("\n=== Summary ===");
for (const r of results) {
  console.log(`${r.status}: ${r.label}${r.detail ? ` — ${r.detail}` : ""}`);
}
process.exit(results.some((r) => r.status === "FAIL") ? 1 : 0);
