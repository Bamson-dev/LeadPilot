#!/usr/bin/env node
/**
 * Outreach bounce handling verification (MOCK_OUTREACH_SEND=1).
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
  getGlobalInvalidEmails,
  getDomainEmailCacheEntries,
  seedDomainEmailCache,
  mailboxes,
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
process.env.OUTREACH_BOUNCE_RATE_THRESHOLD = "2";
process.env.MAILBOX_ENCRYPTION_KEY =
  process.env.MAILBOX_ENCRYPTION_KEY?.trim() ||
  "9bf90eb4be912765783e5c05875295854f59c3dffbb0d3e5efd740089bdbd2fc";
process.env.SUPABASE_URL = "https://mock.supabase.co";
process.env.SUPABASE_SERVICE_KEY = "mock-service-key-012345678901234567890";
process.env.FRONTEND_URL = "https://staging.leadthur.com";
process.env.JWT_SECRET = "test-jwt-secret-01234567890123456789012";
process.env.ADMIN_EMAIL = "admin@test.local";
process.env.ADMIN_PASSWORD = "test-admin-password";
delete process.env.REDIS_URL;
delete process.env.SUPABASE_ANON_KEY;

const HARD_BOUNCE_ADDRESS = "dead-lead@doesnotexist.example";
const SOFT_FAIL_ADDRESS = "timeout-lead@maybe.example";
const HARD_BOUNCE_SMTP =
  "550 5.1.1 The email account that you tried to reach does not exist. Please try double-checking the recipient's email address for typos or unnecessary spaces.";
const SOFT_FAIL_SMTP = "421 4.7.0 Temporary system problem. Try again later.";

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
  const { sendsRouter } = await import("../dist/routes/sends.js");
  const app = express();
  app.use(express.json());
  app.use("/send", sendRouter);
  app.use("/sends", sendsRouter);
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

async function seedSendUser({ email, key, account = {}, mailboxEmail }) {
  const user = seedUser(email);
  seedLicense(email, key);
  setOutreachAccount(user.id, account);
  const { encryptMailboxSecret } = await import("../dist/utils/mailbox-crypto.js");
  const cipher = encryptMailboxSecret("abcd1234efgh5678");
  const mailbox = insertMailbox({
    user_id: user.id,
    email_address: mailboxEmail ?? `sender.${Date.now()}@gmail.com`,
    encrypted_app_password: cipher,
    account_type: "personal",
    status: "active",
    daily_cap: 300,
    daily_send_count: 0,
    daily_count_reset_at: new Date().toISOString(),
  });
  return { user, mailbox };
}

async function runTests() {
  resetMailboxMocks();
  clearModuleCache();
  await registerMailboxMocks({ mockSmtpVerify: true });

  const { classifySmtpSendError } = await import("../dist/utils/outreach-smtp-error.js");
  const hard = classifySmtpSendError({
    responseCode: 550,
    response: HARD_BOUNCE_SMTP,
  });
  const soft421 = classifySmtpSendError({
    responseCode: 421,
    response: SOFT_FAIL_SMTP,
  });
  const softTimeout = classifySmtpSendError({ code: "ETIMEDOUT", message: "Connection timeout" });

  if (hard.kind === "hard_bounce" && hard.smtpCode === 550) {
    pass("classify 550 as hard bounce", hard.smtpResponse);
  } else {
    fail("classify 550 as hard bounce", hard.kind);
  }

  if (soft421.kind === "soft_failure" && soft421.smtpCode === 421) {
    pass("classify 421 as soft failure", soft421.smtpResponse);
  } else {
    fail("classify 421 as soft failure", soft421.kind);
  }

  if (softTimeout.kind === "soft_failure") {
    pass("classify timeout as soft failure", softTimeout.message);
  } else {
    fail("classify timeout as soft failure", softTimeout.kind);
  }

  const { server, base } = await startApp();
  const stamp = Date.now();
  const email = `bounce-test-${stamp}@test.local`;
  const key = `LP-BOUNCE-${stamp}`;
  const otherEmail = `other-user-${stamp}@test.local`;
  const otherKey = `LP-BOUNCE-OTHER-${stamp}`;

  const { user, mailbox } = await seedSendUser({
    email,
    key,
    mailboxEmail: `sender.${stamp}@gmail.com`,
    account: {
      monthly_allowance_remaining: 10,
      purchased_credits_balance: 0,
      free_sends_granted: 0,
      free_sends_used: 0,
    },
  });

  const headers = authHeaders(email, key);
  const creditsBefore = getOutreachAccount(user.id).monthly_allowance_remaining;

  delete process.env.MOCK_OUTREACH_SEND_HARD_BOUNCE_FOR;
  delete process.env.MOCK_OUTREACH_SEND_SOFT_FAIL_FOR;
  delete process.env.MOCK_OUTREACH_SEND_SOFT_FAIL_CODE;

  process.env.MOCK_OUTREACH_SEND_HARD_BOUNCE_FOR = HARD_BOUNCE_ADDRESS;
  const hardRes = await postSend(base, headers, {
    subject: "Test hard bounce",
    body: "Hello [Business Name]",
    targets: [
      {
        recipient_email: HARD_BOUNCE_ADDRESS,
        business_name: "Dead Co",
        email_kind: "verified",
      },
    ],
  });

  if (hardRes.status !== 202 || hardRes.body.queued !== 1) {
    fail("queue hard bounce send", JSON.stringify(hardRes.body));
  } else {
    pass("queue hard bounce send", `queued=${hardRes.body.queued}`);
  }

  await flushQueue();

  const { getSentEmailsForUser } = await import("./verify-mailbox-mocks.mjs");
  const hardRows = getSentEmailsForUser(user.id);
  const hardRow = hardRows.find((r) => r.recipient_email === HARD_BOUNCE_ADDRESS);
  if (hardRow?.status === "bounced" && hardRow.error_message?.includes("550")) {
    pass("hard bounce row marked bounced", hardRow.error_message);
  } else {
    fail("hard bounce row marked bounced", `${hardRow?.status} ${hardRow?.error_message}`);
  }

  const creditsAfterHard = getOutreachAccount(user.id).monthly_allowance_remaining;
  if (creditsAfterHard === creditsBefore) {
    pass("hard bounce credit refunded", `balance=${creditsAfterHard}`);
  } else {
    fail("hard bounce credit refunded", `before=${creditsBefore} after=${creditsAfterHard}`);
  }

  const invalidList = getGlobalInvalidEmails();
  const invalidRow = invalidList.find((r) => r.email === HARD_BOUNCE_ADDRESS);
  if (invalidRow && invalidRow.smtp_code === 550) {
    pass("global invalid list after hard bounce", invalidRow.reason);
  } else {
    fail("global invalid list after hard bounce", JSON.stringify(invalidList));
  }

  const cacheEntries = getDomainEmailCacheEntries();
  const deadCache = cacheEntries.find((r) => r.domain === "doesnotexist.example");
  if (deadCache?.dead_emails?.includes(HARD_BOUNCE_ADDRESS)) {
    pass("domain cache stores dead address", deadCache.dead_emails.join(", "));
  } else {
    fail("domain cache stores dead address", JSON.stringify(cacheEntries));
  }

  const secondRes = await postSend(base, headers, {
    subject: "Retry dead address",
    body: "Hello [Business Name]",
    targets: [
      {
        recipient_email: HARD_BOUNCE_ADDRESS,
        business_name: "Dead Co",
        email_kind: "verified",
      },
    ],
  });

  if (secondRes.body.skipped_invalid_email === 1 && secondRes.body.queued === 0) {
    pass("second send skipped via invalid list", `skipped_invalid=${secondRes.body.skipped_invalid_email}`);
  } else {
    fail("second send skipped via invalid list", JSON.stringify(secondRes.body));
  }

  const { domainCacheToEnrichment } = await import("../dist/database/domain-email-cache-repository.js");
  const deadDomainEntry = getDomainEmailCacheEntries().find(
    (r) => r.domain === "doesnotexist.example"
  );
  if (!deadDomainEntry) {
    fail("different user skips dead cached address", "cache entry missing");
  } else {
    const enrichment = domainCacheToEnrichment(deadDomainEntry);
    if (enrichment.verifiedEmails.length === 0) {
      pass("different user skips dead cached address", "verifiedEmails empty");
    } else {
      fail("different user skips dead cached address", enrichment.verifiedEmails.join(", "));
    }
  }

  await seedSendUser({
    email: otherEmail,
    key: otherKey,
    mailboxEmail: `other.sender.${stamp}@gmail.com`,
    account: { monthly_allowance_remaining: 5, purchased_credits_balance: 0 },
  });
  const otherHeaders = authHeaders(otherEmail, otherKey);
  const otherRes = await postSend(base, otherHeaders, {
    subject: "Other user dead address",
    body: "Hello [Business Name]",
    targets: [
      {
        recipient_email: HARD_BOUNCE_ADDRESS,
        business_name: "Dead Co",
        email_kind: "verified",
      },
    ],
  });
  if (otherRes.body.skipped_invalid_email === 1) {
    pass("cross-user skip before send", `skipped_invalid=${otherRes.body.skipped_invalid_email}`);
  } else {
    fail("cross-user skip before send", JSON.stringify(otherRes.body));
  }

  delete process.env.MOCK_OUTREACH_SEND_HARD_BOUNCE_FOR;
  process.env.MOCK_OUTREACH_SEND_SOFT_FAIL_FOR = SOFT_FAIL_ADDRESS;
  process.env.MOCK_OUTREACH_SEND_SOFT_FAIL_CODE = "421";

  const softRes = await postSend(base, headers, {
    subject: "Soft fail",
    body: "Hello [Business Name]",
    targets: [
      {
        recipient_email: SOFT_FAIL_ADDRESS,
        business_name: "Maybe Co",
        email_kind: "verified",
      },
    ],
  });
  if (softRes.status !== 202 || softRes.body.queued !== 1) {
    fail("queue soft failure send", JSON.stringify(softRes.body));
  }
  await flushQueue();

  const softRow = getSentEmailsForUser(user.id).find((r) => r.recipient_email === SOFT_FAIL_ADDRESS);
  if (softRow?.status === "failed" && softRow.error_message?.includes("421")) {
    pass("soft failure marked failed not bounced", softRow.error_message);
  } else {
    fail("soft failure marked failed not bounced", `${softRow?.status} ${softRow?.error_message}`);
  }

  const softInvalid = getGlobalInvalidEmails().find((r) => r.email === SOFT_FAIL_ADDRESS);
  if (!softInvalid) {
    pass("soft failure not on global invalid list");
  } else {
    fail("soft failure not on global invalid list", softInvalid.reason);
  }

  delete process.env.MOCK_OUTREACH_SEND_SOFT_FAIL_CODE;

  const { resetMailboxBounceCountersForTests } = await import(
    "../dist/services/outreach-bounce-rate-guard.js"
  );
  const { resetOutreachSendSpacingForTests } = await import(
    "../dist/services/outreach-send-service.js"
  );
  resetMailboxBounceCountersForTests();
  resetOutreachSendSpacingForTests();

  const bounceRateAddresses = [
    `bounce-rate-1-${stamp}@dead.example`,
    `bounce-rate-2-${stamp}@dead.example`,
  ];
  for (let i = 0; i < bounceRateAddresses.length; i++) {
    process.env.MOCK_OUTREACH_SEND_HARD_BOUNCE_FOR = bounceRateAddresses[i];
    const bounceRes = await postSend(base, headers, {
      subject: "Bounce rate",
      body: "Hello [Business Name]",
      targets: [
        {
          recipient_email: bounceRateAddresses[i],
          business_name: "Bad List",
          email_kind: "verified",
        },
      ],
    });
    if (bounceRes.body.queued !== 1) {
      fail(`bounce rate queue ${i + 1}`, JSON.stringify(bounceRes.body));
    } else {
      pass(`bounce rate queue ${i + 1}`, bounceRateAddresses[i]);
    }
    await flushQueue();
  }

  const paused = mailboxes.find((m) => m.id === mailbox.id);
  if (paused?.status === "paused_bounce" && paused.last_error?.includes("high bounce rate")) {
    pass("mailbox paused after bounce threshold", paused.last_error);
  } else {
    fail("mailbox paused after bounce threshold", `${paused?.status} ${paused?.last_error}`);
  }

  const sendsRes = await fetch(`${base}/sends?status=bounced`, { headers });
  const sendsBody = await sendsRes.json();
  const bouncedInReport = (sendsBody.sends ?? []).some((row) => row.status === "bounced");
  if (bouncedInReport) {
    pass("sends report includes bounced status", `count=${sendsBody.sends?.length ?? 0}`);
  } else {
    fail("sends report includes bounced status", JSON.stringify(sendsBody));
  }

  server.close();

  const failed = results.filter((r) => r.status === "FAIL");
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
  if (failed.length) process.exit(1);
}

runTests().catch((err) => {
  console.error(err);
  process.exit(1);
});
