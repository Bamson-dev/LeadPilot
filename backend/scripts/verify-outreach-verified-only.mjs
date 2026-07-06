#!/usr/bin/env node
/**
 * Verified-email-only outreach send verification.
 * Run after: npm run build (shared + backend)
 */
import express from "express";
import http from "http";
import { createRequire } from "node:module";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildOutreachSendTargetFromLead,
  buildOutreachSendTargetsFromLeads,
} from "@leadthur/shared";
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
  insertSuppression,
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
process.env.MOCK_OUTREACH_SEND = "1";
process.env.OUTREACH_SEND_SKIP_SPACING = "1";
process.env.MAILBOX_ENCRYPTION_KEY =
  process.env.MAILBOX_ENCRYPTION_KEY?.trim() ||
  "9bf90eb4be912765783e5c05875295854f59c3dffbb0d3e5efd740089bdbd2fc";
process.env.SUPABASE_URL = process.env.SUPABASE_URL || "https://mock.supabase.co";
process.env.SUPABASE_SERVICE_KEY =
  process.env.SUPABASE_SERVICE_KEY || "mock-service-key-0123456789";
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
    if (key.includes("/dist/") || key.includes("outreach") || key.includes("database/client")) {
      delete require.cache[key];
    }
  }
}

async function postSend(base, headers, body) {
  const res = await fetch(`${base}/send`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
  return { status: res.status, body: await res.json().catch(() => ({})) };
}

async function runTests() {
  const verifiedLead = {
    id: "lead-verified",
    business_name: "Sunrise Bakery",
    verifiedEmails: ["hello@sunrisebakery.com"],
    predictedEmails: [
      {
        email: "reservations@sunrisebakery.com",
        confidence: 0.7,
        label: "medium",
        source: "business_pattern",
      },
    ],
  };
  const predictedOnlyLead = {
    id: "lead-predicted",
    business_name: "Grey Dot Cafe",
    verifiedEmails: [],
    predictedEmails: [
      { email: "info@greydotcafe.com", confidence: 0.6, label: "low", source: "category_pattern" },
    ],
  };

  const verifiedTarget = buildOutreachSendTargetFromLead(verifiedLead);
  if (
    verifiedTarget.sendable?.email_kind === "verified" &&
    verifiedTarget.sendable.recipient_email === "hello@sunrisebakery.com" &&
    !verifiedTarget.skippedPredictedOnly
  ) {
    pass(
      "lead with verified + predicted picks verified only",
      verifiedTarget.sendable.recipient_email
    );
  } else {
    fail("lead with verified + predicted picks verified only", JSON.stringify(verifiedTarget));
  }

  const predictedTarget = buildOutreachSendTargetFromLead(predictedOnlyLead);
  if (
    !predictedTarget.sendable &&
    predictedTarget.skippedPredictedOnly?.email_kind === "predicted" &&
    predictedTarget.skippedPredictedOnly.recipient_email === "info@greydotcafe.com"
  ) {
    pass(
      "predicted-only lead marked for skip",
      predictedTarget.skippedPredictedOnly.recipient_email
    );
  } else {
    fail("predicted-only lead marked for skip", JSON.stringify(predictedTarget));
  }

  const batch = buildOutreachSendTargetsFromLeads([verifiedLead, predictedOnlyLead]);
  if (batch.targets.length === 2 && batch.skippedNoVerifiedPreview === 1) {
    pass("batch builds verified send + predicted skip", `targets=${batch.targets.length}`);
  } else {
    fail("batch builds verified send + predicted skip", JSON.stringify(batch));
  }

  const emailCellSrc = readFileSync(
    join(__dirname, "../../frontend/components/dashboard/email-cell.tsx"),
    "utf8"
  );
  if (emailCellSrc.includes("getPredictedEmails") && emailCellSrc.includes("predictedUnique")) {
    pass("results table still renders predicted emails");
  } else {
    fail("results table still renders predicted emails");
  }

  resetMailboxMocks();
  clearModuleCache();
  await registerMailboxMocks({ mockSmtpVerify: true });

  const stamp = Date.now();
  const licenseEmail = `vonly-${stamp}@test.local`;
  const licenseKey = `LP-VONLY-${stamp}`;
  const user = seedUser(licenseEmail);
  seedLicense(licenseEmail, licenseKey);
  setOutreachAccount(user.id, {
    monthly_allowance_remaining: 5,
    purchased_credits_balance: 0,
  });

  const { encryptMailboxSecret } = await import("../dist/utils/mailbox-crypto.js");
  insertMailbox({
    user_id: user.id,
    email_address: `sender.vonly.${stamp}@gmail.com`,
    encrypted_app_password: encryptMailboxSecret("abcd1234efgh5678"),
    account_type: "personal",
    status: "active",
    daily_cap: 300,
    daily_send_count: 0,
    daily_count_reset_at: new Date().toISOString(),
  });

  const { sendRouter } = await import("../dist/routes/send.js");
  const app = express();
  app.use(express.json());
  app.use("/send", sendRouter);
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const headers = {
    "x-license-email": licenseEmail,
    "x-license-key": licenseKey,
  };

  const verifiedSend = await postSend(base, headers, {
    targets: [
      {
        recipient_email: "hello@sunrisebakery.com",
        business_name: "Sunrise Bakery",
        email_kind: "verified",
      },
    ],
    subject: "Hi [Business Name]",
    body: "Hello [Business Name]",
    send_mode: "auto",
  });

  const { flushInlineOutreachSendQueue } = await import("../dist/queue/outreach-send-queue.js");
  await flushInlineOutreachSendQueue();

  const verifiedRows = getSentEmailsForUser(user.id);
  const acctAfterVerified = getOutreachAccount(user.id);
  if (
    verifiedSend.status === 202 &&
    verifiedSend.body.queued === 1 &&
    verifiedSend.body.skipped_no_verified_email === 0 &&
    verifiedRows.length === 1 &&
    verifiedRows[0].recipient_email === "hello@sunrisebakery.com" &&
    acctAfterVerified?.monthly_allowance_remaining === 4
  ) {
    pass(
      "verified email sends normally",
      `queued=1, to=${verifiedRows[0].recipient_email}, allowance=4`
    );
  } else {
    fail("verified email sends normally", JSON.stringify({ verifiedSend, verifiedRows, acctAfterVerified }));
  }

  const predictedSend = await postSend(base, headers, {
    targets: [
      {
        recipient_email: "info@greydotcafe.com",
        business_name: "Grey Dot Cafe",
        email_kind: "predicted",
      },
    ],
    subject: "Hi",
    body: "Hello",
    send_mode: "auto",
  });

  const acctAfterPredicted = getOutreachAccount(user.id);
  const ledgerAfterPredicted = getLedgerForUser(user.id).filter((r) => r.type === "spend");
  if (
    predictedSend.status === 202 &&
    predictedSend.body.queued === 0 &&
    predictedSend.body.skipped_no_verified_email === 1 &&
    predictedSend.body.skipped_suppression === 0 &&
    predictedSend.body.short_credits === 0 &&
    verifiedRows.length === 1 &&
    acctAfterPredicted?.monthly_allowance_remaining === 4 &&
    ledgerAfterPredicted.length === 1
  ) {
    pass(
      "predicted-only skipped with separate counter, no credit charged",
      `skipped_no_verified_email=1, allowance=4, spends=${ledgerAfterPredicted.length}`
    );
  } else {
    fail(
      "predicted-only skipped with separate counter, no credit charged",
      JSON.stringify({ predictedSend: predictedSend.body, acctAfterPredicted, ledgerAfterPredicted })
    );
  }

  insertSuppression(user.id, "blocked@example.com");

  const mixedSend = await postSend(base, headers, {
    targets: [
      {
        recipient_email: "hello2@sunrisebakery.com",
        business_name: "Sunrise Bakery 2",
        email_kind: "verified",
      },
      {
        recipient_email: "info@greydotcafe.com",
        business_name: "Grey Dot Cafe",
        email_kind: "predicted",
      },
      {
        recipient_email: "blocked@example.com",
        business_name: "Blocked",
        email_kind: "verified",
      },
    ],
    subject: "Mixed",
    body: "Body",
    send_mode: "auto",
  });

  if (
    mixedSend.body.skipped_no_verified_email === 1 &&
    mixedSend.body.skipped_suppression === 1 &&
    mixedSend.body.queued === 1
  ) {
    pass(
      "summary separates no-verified, suppression, and queued",
      `queued=${mixedSend.body.queued}, no_verified=${mixedSend.body.skipped_no_verified_email}, suppressed=${mixedSend.body.skipped_suppression}`
    );
  } else {
    fail(
      "summary separates no-verified, suppression, and queued",
      JSON.stringify(mixedSend.body)
    );
  }

  server.close();
}

await runTests();

console.log("\n=== Summary ===");
for (const r of results) {
  console.log(`${r.status}: ${r.label}${r.detail ? ` — ${r.detail}` : ""}`);
}
process.exit(results.some((r) => r.status === "FAIL") ? 1 : 0);
