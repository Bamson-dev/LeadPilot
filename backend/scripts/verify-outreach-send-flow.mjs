#!/usr/bin/env node
/**
 * Outreach send queue + worker verification (MOCK_OUTREACH_SEND=1).
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
  getOutreachAccount,
  getLedgerForUser,
  getSentEmailsForUser,
  getSentEmailById,
  insertSentEmail,
  insertSuppression,
} from "./verify-mailbox-mocks.mjs";
import { SEARCH_QUEUE_NAME } from "../dist/queue/search-queue-types.js";
import { OUTREACH_SEND_QUEUE_NAME } from "../dist/queue/outreach-send-queue-types.js";

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
      key.includes("require-license")
    ) {
      delete require.cache[key];
    }
  }
}

async function startApp() {
  const { sendRouter } = await import("../dist/routes/send.js");
  const { outreachTrackingRouter } = await import("../dist/routes/outreach-tracking.js");
  const app = express();
  app.use(express.json());
  app.use("/send", sendRouter);
  app.use("/outreach", outreachTrackingRouter);
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  return { server, base: `http://127.0.0.1:${server.address().port}` };
}

async function postSend(base, headers, body) {
  const res = await fetch(`${base}/send`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
  return { status: res.status, body: await res.json().catch(() => ({})) };
}

async function flushQueue() {
  const { flushInlineOutreachSendQueue } = await import("../dist/queue/outreach-send-queue.js");
  await flushInlineOutreachSendQueue();
}

function authHeaders(email, key) {
  return {
    "x-license-key": key,
    "x-license-email": email,
  };
}

async function seedSendUser({
  email,
  key,
  account = {},
  mailbox,
  mailboxes,
}) {
  const user = seedUser(email);
  seedLicense(email, key);
  setOutreachAccount(user.id, account);
  const { encryptMailboxSecret } = await import("../dist/utils/mailbox-crypto.js");
  const cipher = encryptMailboxSecret("abcd1234efgh5678");
  const created = [];
  const list = mailboxes ?? (mailbox ? [mailbox] : [{ email: `sender.${Date.now()}@gmail.com` }]);
  for (const mb of list) {
    created.push(
      insertMailbox({
        user_id: user.id,
        email_address: mb.email,
        encrypted_app_password: cipher,
        account_type: mb.account_type || "personal",
        status: "active",
        daily_cap: mb.daily_cap ?? 300,
        daily_send_count: mb.daily_send_count ?? 0,
        daily_count_reset_at: mb.daily_count_reset_at ?? new Date().toISOString(),
      })
    );
  }
  return { user, mailboxes: created };
}

async function runTests() {
  resetMailboxMocks();
  clearModuleCache();
  await registerMailboxMocks({ mockSmtpVerify: true });

  if (SEARCH_QUEUE_NAME === OUTREACH_SEND_QUEUE_NAME) {
    fail("queue names distinct", `${SEARCH_QUEUE_NAME} === ${OUTREACH_SEND_QUEUE_NAME}`);
  } else {
    pass("queue names distinct", `search=${SEARCH_QUEUE_NAME}, outreach=${OUTREACH_SEND_QUEUE_NAME}`);
  }

  const searchQueueSrc = readFileSync(join(__dirname, "../src/queue/search-queue.ts"), "utf8");
  const searchWorkerSrc = readFileSync(join(__dirname, "../src/workers/search-worker.ts"), "utf8");
  if (searchQueueSrc.includes("OUTREACH_SEND") || searchWorkerSrc.includes("outreach")) {
    fail("search queue untouched", "search files reference outreach");
  } else {
    pass("search queue untouched", "no outreach references in search queue/worker");
  }

  const { server, base } = await startApp();
  const stamp = Date.now();
  const email = `send-test-${stamp}@test.local`;
  const key = `LP-SEND-${stamp}`;

  const { user, mailboxes } = await seedSendUser({
    email,
    key,
    account: {
      max_mailboxes: 1,
      monthly_allowance_remaining: 5,
      purchased_credits_balance: 3,
      free_sends_granted: 10,
      free_sends_used: 10,
    },
  });

  const headers = authHeaders(email, key);
  const targets = Array.from({ length: 6 }, (_, i) => ({
    recipient_email: `lead${i}@example.com`,
    business_name: `Biz ${i}`,
  }));

  const batchRes = await postSend(base, headers, {
    targets,
    subject: "Hello [Business Name]",
    body: "Hi [Business Name]",
    send_mode: "auto",
  });

  if (batchRes.status !== 202 || batchRes.body?.queued !== 6) {
    fail("bucket order batch queue", JSON.stringify(batchRes.body));
  } else {
    pass("bucket order batch queue", `queued=${batchRes.body.queued}`);
  }

  await flushQueue();

  const sentRows = getSentEmailsForUser(user.id).filter((r) => r.status === "sent");
  const spendRows = getLedgerForUser(user.id).filter((r) => r.type === "spend");
  const monthlySpends = spendRows.filter((r) => r.bucket === "monthly_allowance");
  const purchasedSpends = spendRows.filter((r) => r.bucket === "purchased_credits");
  const freeSpends = spendRows.filter((r) => r.bucket === "free_trial");

  if (
    sentRows.length === 6 &&
    monthlySpends.length === 5 &&
    purchasedSpends.length === 1 &&
    freeSpends.length === 0
  ) {
    pass(
      "bucket spend order (6 sends)",
      `monthly=${monthlySpends.length}, purchased=${purchasedSpends.length}, ledger=${JSON.stringify(
        spendRows.map((r) => ({ bucket: r.bucket, amount: r.amount, ref: r.reference }))
      )}`
    );
  } else {
    fail(
      "bucket spend order (6 sends)",
      JSON.stringify({
        sent: sentRows.length,
        monthly: monthlySpends.length,
        purchased: purchasedSpends.length,
        free: freeSpends.length,
        spendRows,
      })
    );
  }

  const acctAfter = getOutreachAccount(user.id);
  if (acctAfter?.monthly_allowance_remaining === 0 && acctAfter?.purchased_credits_balance === 2) {
    pass("bucket balances after 6 sends", "monthly=0, purchased=2");
  } else {
    fail("bucket balances after 6 sends", JSON.stringify(acctAfter));
  }

  resetMailboxMocks();
  clearModuleCache();
  await registerMailboxMocks({ mockSmtpVerify: true });
  const { server: s2, base: b2 } = await startApp();
  const supEmail = `sup-${stamp}@test.local`;
  const supKey = `LP-SUP-${stamp}`;
  const { user: supUser } = await seedSendUser({
    email: supEmail,
    key: supKey,
    account: { monthly_allowance_remaining: 5, purchased_credits_balance: 0 },
  });
  insertSuppression(supUser.id, "blocked@example.com");
  const supRes = await postSend(b2, authHeaders(supEmail, supKey), {
    targets: [
      { recipient_email: "blocked@example.com", business_name: "Blocked" },
      { recipient_email: "ok@example.com", business_name: "OK" },
    ],
    subject: "Hi",
    body: "Body",
    send_mode: "auto",
  });
  const supRows = getSentEmailsForUser(supUser.id);
  if (supRes.body?.skipped_suppression === 1 && supRes.body?.queued === 1 && supRows.length === 1) {
    pass("suppression skip", `skipped=1, queued=1, rows=${supRows.length}`);
  } else {
    fail("suppression skip", JSON.stringify({ supRes: supRes.body, supRows: supRows.length }));
  }
  s2.close();

  resetMailboxMocks();
  clearModuleCache();
  await registerMailboxMocks({ mockSmtpVerify: true });
  const { server: s3, base: b3 } = await startApp();
  const balEmail = `bal-${stamp}@test.local`;
  const balKey = `LP-BAL-${stamp}`;
  await seedSendUser({
    email: balEmail,
    key: balKey,
    account: { monthly_allowance_remaining: 2, purchased_credits_balance: 0, free_sends_used: 10, free_sends_granted: 10 },
  });
  const balRes = await postSend(b3, authHeaders(balEmail, balKey), {
    targets: Array.from({ length: 5 }, (_, i) => ({
      recipient_email: `b${i}@example.com`,
      business_name: `B${i}`,
    })),
    subject: "Hi",
    body: "Body",
    send_mode: "auto",
  });
  if (balRes.body?.queued === 2 && balRes.body?.short_credits === 3) {
    pass("balance ceiling", `queued=2, short=3`);
  } else {
    fail("balance ceiling", JSON.stringify(balRes.body));
  }
  s3.close();

  resetMailboxMocks();
  clearModuleCache();
  await registerMailboxMocks({ mockSmtpVerify: true });
  const capEmail = `cap-${stamp}@test.local`;
  const capKey = `LP-CAP-${stamp}`;
  const { user: capUser } = await seedSendUser({
    email: capEmail,
    key: capKey,
    account: { monthly_allowance_remaining: 10, purchased_credits_balance: 0 },
    mailbox: {
      email: `capbox.${stamp}@gmail.com`,
      daily_cap: 2,
      daily_send_count: 2,
      daily_count_reset_at: new Date(Date.now() + 60_000).toISOString(),
    },
  });
  const { processOutreachSendJob } = await import("../dist/services/outreach-send-service.js");
  const capRow = insertSentEmail({
    user_id: capUser.id,
    recipient_email: "cap@example.com",
    subject: "Cap",
    body: "Cap",
    tracking_token: "cap-token",
    status: "queued",
  });
  const capOutcome = await processOutreachSendJob({
    sentEmailId: capRow.id,
    userId: capUser.id,
    sendMode: "auto",
  });
  const capLedger = getLedgerForUser(capUser.id).filter((r) => r.type === "spend");
  const capSent = getSentEmailById(capRow.id);
  if (capOutcome.action === "requeue" && capLedger.length === 0 && capSent?.status === "queued") {
    pass("daily cap requeue", `action=${capOutcome.action}, spends=0, status=${capSent.status}`);
  } else {
    fail("daily cap requeue", JSON.stringify({ capOutcome, capLedger, capSent }));
  }

  resetMailboxMocks();
  clearModuleCache();
  await registerMailboxMocks({ mockSmtpVerify: true });
  const rstEmail = `rst2-${stamp}@test.local`;
  const rstKey = `LP-RST2-${stamp}`;
  const { user: rstUser, mailboxes: rstMboxes } = await seedSendUser({
    email: rstEmail,
    key: rstKey,
    account: { monthly_allowance_remaining: 5, purchased_credits_balance: 0 },
    mailbox: {
      email: `rstbox.${stamp}@gmail.com`,
      daily_cap: 2,
      daily_send_count: 2,
      daily_count_reset_at: new Date(Date.now() - 60_000).toISOString(),
    },
  });
  const rstRow = insertSentEmail({
    user_id: rstUser.id,
    recipient_email: "rst@example.com",
    subject: "R",
    body: "R",
    tracking_token: "rst",
    status: "queued",
  });
  const rstOutcome = await processOutreachSendJob({
    sentEmailId: rstRow.id,
    userId: rstUser.id,
    sendMode: "auto",
  });
  const rstSent = getSentEmailById(rstRow.id);
  const { getMailboxById } = await import("./verify-mailbox-mocks.mjs");
  const rstMb = getMailboxById(rstMboxes[0].id);
  if (
    rstOutcome.action === "sent" &&
    rstSent?.status === "sent" &&
    rstMb?.daily_send_count === 1
  ) {
    pass("daily reset then send", `count=${rstMb.daily_send_count}, status=${rstSent.status}`);
  } else {
    fail("daily reset then send", JSON.stringify({ rstOutcome, rstSent, rstMb }));
  }

  resetMailboxMocks();
  clearModuleCache();
  await registerMailboxMocks({ mockSmtpVerify: true });
  const spreadEmail = `spread-${stamp}@test.local`;
  const spreadKey = `LP-SPR-${stamp}`;
  const { user: spreadUser } = await seedSendUser({
    email: spreadEmail,
    key: spreadKey,
    account: { monthly_allowance_remaining: 10, purchased_credits_balance: 0 },
    mailboxes: [
      { email: `spread1.${stamp}@gmail.com`, daily_cap: 2, daily_send_count: 0 },
      { email: `spread2.${stamp}@gmail.com`, daily_cap: 2, daily_send_count: 0 },
    ],
  });
  const { server: sSpread, base: bSpread } = await startApp();
  const spreadRes = await postSend(bSpread, authHeaders(spreadEmail, spreadKey), {
    targets: Array.from({ length: 4 }, (_, i) => ({
      recipient_email: `spr${i}@example.com`,
      business_name: `S${i}`,
    })),
    subject: "Hi",
    body: "Body",
    send_mode: "auto",
  });
  await flushQueue();
  const spreadSent = getSentEmailsForUser(spreadUser.id).filter((r) => r.status === "sent");
  const counts = {};
  for (const row of spreadSent) {
    counts[row.mailbox_id] = (counts[row.mailbox_id] || 0) + 1;
  }
  const vals = Object.values(counts);
  if (spreadRes.body?.queued === 4 && vals.length === 2 && vals.every((n) => n === 2)) {
    pass("auto spread across mailboxes", `counts=${JSON.stringify(counts)}`);
  } else {
    fail("auto spread across mailboxes", JSON.stringify({ spreadRes: spreadRes.body, counts, spreadSent }));
  }
  sSpread.close();

  resetMailboxMocks();
  clearModuleCache();
  await registerMailboxMocks({ mockSmtpVerify: true });
  const manEmail = `manual-${stamp}@test.local`;
  const manKey = `LP-MAN-${stamp}`;
  const { user: manUser, mailboxes: manMboxes } = await seedSendUser({
    email: manEmail,
    key: manKey,
    account: { monthly_allowance_remaining: 5, purchased_credits_balance: 0 },
    mailboxes: [
      { email: `man1.${stamp}@gmail.com`, daily_cap: 10 },
      { email: `man2.${stamp}@gmail.com`, daily_cap: 10 },
    ],
  });
  const { server: sMan, base: bMan } = await startApp();
  await postSend(bMan, authHeaders(manEmail, manKey), {
    targets: [{ recipient_email: "manual@example.com", business_name: "M" }],
    subject: "Hi",
    body: "Body",
    send_mode: "manual",
    mailbox_id: manMboxes[1].id,
  });
  await flushQueue();
  const manSent = getSentEmailsForUser(manUser.id)[0];
  if (manSent?.mailbox_id === manMboxes[1].id && manSent?.status === "sent") {
    pass("manual mailbox override", `mailbox_id=${manSent.mailbox_id}`);
  } else {
    fail("manual mailbox override", JSON.stringify(manSent));
  }
  sMan.close();

  resetMailboxMocks();
  clearModuleCache();
  await registerMailboxMocks({ mockSmtpVerify: true });
  const refEmail = `refund-${stamp}@test.local`;
  const refKey = `LP-REF-${stamp}`;
  const { user: refUser } = await seedSendUser({
    email: refEmail,
    key: refKey,
    account: { monthly_allowance_remaining: 5, purchased_credits_balance: 0 },
  });
  process.env.MOCK_OUTREACH_SEND_FAIL_FOR = "fail-refund@example.com";
  const { server: sRef, base: bRef } = await startApp();
  await postSend(bRef, authHeaders(refEmail, refKey), {
    targets: [{ recipient_email: "fail-refund@example.com", business_name: "F" }],
    subject: "Hi",
    body: "Body",
    send_mode: "auto",
  });
  await flushQueue();
  delete process.env.MOCK_OUTREACH_SEND_FAIL_FOR;
  const refSent = getSentEmailsForUser(refUser.id)[0];
  const refAcct = getOutreachAccount(refUser.id);
  const refunds = getLedgerForUser(refUser.id).filter((r) => r.type === "refund");
  const spends = getLedgerForUser(refUser.id).filter((r) => r.type === "spend");
  if (
    refSent?.status === "failed" &&
    refAcct?.monthly_allowance_remaining === 5 &&
    refunds.length === 1 &&
    spends.length === 1
  ) {
    pass("refund on send failure", `allowance=${refAcct.monthly_allowance_remaining}, refunds=${refunds.length}`);
  } else {
    fail("refund on send failure", JSON.stringify({ refSent, refAcct, refunds, spends }));
  }
  sRef.close();

  resetMailboxMocks();
  clearModuleCache();
  await registerMailboxMocks({ mockSmtpVerify: true });
  const trEmail = `track-${stamp}@test.local`;
  const trKey = `LP-TRK-${stamp}`;
  const { user: trUser } = await seedSendUser({ email: trEmail, key: trKey });
  const token = `track-token-${stamp}`;
  insertSentEmail({
    user_id: trUser.id,
    recipient_email: "track@example.com",
    subject: "T",
    body: "T",
    tracking_token: token,
    status: "sent",
  });
  const { server: sTr, base: bTr } = await startApp();
  const hit1 = await fetch(`${bTr}/outreach/open/${token}`);
  const hit2 = await fetch(`${bTr}/outreach/open/${token}`);
  const tracked = getSentEmailsForUser(trUser.id).find((r) => r.tracking_token === token);
  if (
    hit1.status === 200 &&
    hit2.status === 200 &&
    tracked?.open_count === 2 &&
    tracked?.opened_at
  ) {
    pass("tracking pixel", `open_count=${tracked.open_count}, opened_at set`);
  } else {
    fail("tracking pixel", JSON.stringify({ hit1: hit1.status, tracked }));
  }
  sTr.close();

  server.close();
}

await runTests();

console.log("\n=== Summary ===");
for (const r of results) {
  console.log(`${r.status}: ${r.label}${r.detail ? ` — ${r.detail}` : ""}`);
}
process.exit(results.some((r) => r.status === "FAIL") ? 1 : 0);
