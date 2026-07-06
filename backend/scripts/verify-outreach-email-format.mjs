#!/usr/bin/env node
/**
 * Outreach email format verification — personal mail, no LeadThur branding.
 * Run after: npm run build (in backend/)
 */
import express from "express";
import http from "http";
import nodemailer from "nodemailer";
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
  getLastSmtpPayloads,
  getSentEmailsForUser,
  getMailboxById,
  isRecipientSuppressedInMock,
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
process.env.SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || "mock-service-key";
process.env.FRONTEND_URL = process.env.FRONTEND_URL || "https://staging.leadthur.com";
process.env.JWT_SECRET = process.env.JWT_SECRET || "test-jwt-secret-01234567890123456789012";
process.env.ADMIN_EMAIL = process.env.ADMIN_EMAIL || "admin@test.local";
process.env.ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "test-admin-password";
delete process.env.REDIS_URL;

const results = [];
let rawEmailSource = "";

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

function bannedBranding(content) {
  const needles = ["LeadThur", "Lead Thur", "Pdigital", "pdigital", "RC 8015428", "leadthur.com/logo"];
  return needles.filter((n) => content.includes(n));
}

async function renderRawMime(payload) {
  const transport = nodemailer.createTransport({
    streamTransport: true,
    newline: "unix",
    buffer: true,
  });
  const info = await transport.sendMail({
    from: payload.from,
    to: payload.to,
    subject: payload.subject,
    text: payload.text,
    html: payload.html,
  });
  return info.message.toString("utf8");
}

async function startTrackingApp() {
  const { outreachTrackingRouter } = await import("../dist/routes/outreach-tracking.js");
  const app = express();
  app.use("/outreach", outreachTrackingRouter);
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  return { server, base: `http://127.0.0.1:${server.address().port}` };
}

async function runTests() {
  const {
    buildOutreachEmailContent,
    outreachEmailMustNotContainBranding,
    buildOutreachOptOutLine,
  } = await import("../dist/services/outreach-email-template.js");

  const templateHits = outreachEmailMustNotContainBranding(
    buildOutreachEmailContent({
      body: "Hi Acme Corp,\n\nQuick question about your site.",
      trackingPixelUrl: "https://staging-backend.leadthur.com/outreach/open/tok",
      unsubscribeUrl: "https://staging-backend.leadthur.com/outreach/unsubscribe?token=tok",
    }).html
  );
  if (templateHits.length === 0) {
    pass("template has no LeadThur/Pdigital branding");
  } else {
    fail("template has no LeadThur/Pdigital branding", templateHits.join(", "));
  }

  const optOut = buildOutreachOptOutLine("https://example.com/outreach/unsubscribe?token=abc");
  if (!optOut.includes("LeadThur") && !optOut.includes("Pdigital")) {
    pass("opt-out line is neutral", optOut);
  } else {
    fail("opt-out line is neutral", optOut);
  }

  resetMailboxMocks();
  clearModuleCache();
  await registerMailboxMocks({ mockSmtpVerify: true });

  const stamp = Date.now();
  const licenseEmail = `fmt-${stamp}@test.local`;
  const licenseKey = `LP-FMT-${stamp}`;
  const user = seedUser(licenseEmail);
  seedLicense(licenseEmail, licenseKey);
  setOutreachAccount(user.id, { monthly_allowance_remaining: 5, purchased_credits_balance: 0 });

  const senderGmail = `sender.fmt.${stamp}@gmail.com`;
  const recipient = `recipient.fmt.${stamp}@example.com`;
  const businessName = "Sunrise Bakery";
  const { encryptMailboxSecret } = await import("../dist/utils/mailbox-crypto.js");
  insertMailbox({
    user_id: user.id,
    email_address: senderGmail,
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

  const sendRes = await fetch(`${base}/send`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-license-email": licenseEmail,
      "x-license-key": licenseKey,
    },
    body: JSON.stringify({
      targets: [{ recipient_email: recipient, business_name: businessName, email_kind: "verified" }],
      subject: "Question for [Business Name]",
      body: "Hi [Business Name],\n\nI noticed your shop on Google Maps and wanted to reach out.",
      send_mode: "auto",
    }),
  });
  const sendBody = await sendRes.json().catch(() => ({}));

  if (sendRes.status !== 202 || sendBody.queued !== 1) {
    fail("queue outreach send", JSON.stringify({ status: sendRes.status, sendBody }));
    server.close();
    return;
  }
  pass("queue outreach send", `queued=${sendBody.queued}`);

  const { flushInlineOutreachSendQueue } = await import("../dist/queue/outreach-send-queue.js");
  await flushInlineOutreachSendQueue();

  const sentRow = getSentEmailsForUser(user.id).find((r) => r.recipient_email === recipient);
  if (!sentRow || sentRow.status !== "sent") {
    fail("outreach send completed", JSON.stringify(sentRow));
    server.close();
    return;
  }
  pass("outreach send completed", `status=${sentRow.status}`);

  const mailbox = sentRow.mailbox_id ? getMailboxById(sentRow.mailbox_id) : null;
  const {
    getOutreachOpenTrackingUrl,
    getOutreachUnsubscribeUrl,
  } = await import("../dist/services/outreach-send-service.js");
  const { html, text } = buildOutreachEmailContent({
    body: sentRow.body,
    trackingPixelUrl: getOutreachOpenTrackingUrl(sentRow.tracking_token),
    unsubscribeUrl: getOutreachUnsubscribeUrl(sentRow.tracking_token),
  });
  const payload = {
    from: mailbox?.email_address ?? senderGmail,
    to: sentRow.recipient_email,
    subject: sentRow.subject,
    html,
    text,
  };

  const captured = getLastSmtpPayloads();
  if (captured.length === 1) {
    pass("smtp payload captured from mock hook", `count=${captured.length}`);
  }
  if (payload.from === senderGmail) {
    pass("from address is connected Gmail", payload.from);
  } else {
    fail("from address is connected Gmail", `from=${payload.from}, expected=${senderGmail}`);
  }

  if (payload.subject === `Question for ${businessName}`) {
    pass("subject merge field filled", payload.subject);
  } else {
    fail("subject merge field filled", payload.subject);
  }

  const expectedBodyLine = `Hi ${businessName},`;
  if (payload.text.includes(expectedBodyLine) && payload.html.includes(expectedBodyLine)) {
    pass("body merge field filled", expectedBodyLine);
  } else {
    fail("body merge field filled", JSON.stringify({ text: payload.text.slice(0, 200) }));
  }

  const brandingInHtml = bannedBranding(payload.html);
  const brandingInText = bannedBranding(payload.text);
  if (brandingInHtml.length === 0 && brandingInText.length === 0) {
    pass("smtp html/text have no LeadThur branding");
  } else {
    fail("smtp html/text have no LeadThur branding", [...brandingInHtml, ...brandingInText].join(", "));
  }

  if (
    payload.text.includes("opt out here") &&
    !payload.text.includes("LeadThur") &&
    !payload.text.includes("Pdigital")
  ) {
    pass("text includes neutral opt-out line");
  } else {
    fail("text includes neutral opt-out line", payload.text.slice(-200));
  }

  rawEmailSource = await renderRawMime(payload);
  const rawBranding = bannedBranding(rawEmailSource);
  if (rawBranding.length === 0) {
    pass("raw MIME has no LeadThur branding");
  } else {
    fail("raw MIME has no LeadThur branding", rawBranding.join(", "));
  }

  console.log("\n--- Raw email source (MIME) ---\n");
  console.log(rawEmailSource);
  console.log("\n--- End raw email source ---\n");

  if (!sentRow?.tracking_token) {
    fail("tracking token on sent row");
    server.close();
    return;
  }

  const { server: trackServer, base: trackBase } = await startTrackingApp();
  const unsubRes = await fetch(
    `${trackBase}/outreach/unsubscribe?token=${encodeURIComponent(sentRow.tracking_token)}`
  );
  const unsubHtml = await unsubRes.text();

  if (unsubRes.status === 200 && unsubHtml.includes("opted out")) {
    pass("unsubscribe endpoint succeeds", `status=${unsubRes.status}`);
  } else {
    fail("unsubscribe endpoint succeeds", `status=${unsubRes.status}`);
  }

  if (!unsubHtml.includes("LeadThur") && !unsubHtml.includes("Pdigital")) {
    pass("unsubscribe page has no LeadThur branding");
  } else {
    fail("unsubscribe page has no LeadThur branding");
  }

  if (isRecipientSuppressedInMock(user.id, recipient)) {
    pass("recipient added to sender suppression list");
  } else {
    fail("recipient added to sender suppression list");
  }

  const blockedRes = await fetch(`${base}/send`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-license-email": licenseEmail,
      "x-license-key": licenseKey,
    },
    body: JSON.stringify({
      targets: [{ recipient_email: recipient, business_name: businessName, email_kind: "verified" }],
      subject: "Follow up",
      body: "Second try",
      send_mode: "auto",
    }),
  });
  const blockedBody = await blockedRes.json().catch(() => ({}));
  if (blockedBody.skipped_suppression === 1 && blockedBody.queued === 0) {
    pass("suppressed recipient skipped on resend");
  } else {
    fail("suppressed recipient skipped on resend", JSON.stringify(blockedBody));
  }

  trackServer.close();
  server.close();

  const gmailFrom = process.env.GMAIL_TEST_EMAIL?.trim();
  const gmailPass = process.env.GMAIL_TEST_APP_PASSWORD?.trim();
  const liveTo = process.env.OUTREACH_TEST_RECIPIENT?.trim() || gmailFrom;

  if (!gmailFrom || !gmailPass || !liveTo) {
    skip(
      "live Gmail send via real SMTP",
      "Set GMAIL_TEST_EMAIL, GMAIL_TEST_APP_PASSWORD, and optionally OUTREACH_TEST_RECIPIENT"
    );
    return;
  }

  const { sendOutreachEmail } = await import("../dist/services/outreach-send-smtp.js");
  const token = `live-${stamp}`;
  const trackingUrl = `https://staging-backend.leadthur.com/outreach/open/${token}`;
  const unsubscribeUrl = `https://staging-backend.leadthur.com/outreach/unsubscribe?token=${token}`;
  const liveContent = buildOutreachEmailContent({
    body: `Hi ${businessName},\n\nLive outreach format test ${stamp}.`,
    trackingPixelUrl: trackingUrl,
    unsubscribeUrl,
  });

  const prevMock = process.env.MOCK_OUTREACH_SEND;
  delete process.env.MOCK_OUTREACH_SEND;
  try {
    await sendOutreachEmail({
      from: gmailFrom,
      to: liveTo,
      subject: `Outreach format test ${stamp}`,
      html: liveContent.html,
      text: liveContent.text,
      appPassword: gmailPass,
    });
    pass("live Gmail send via real SMTP", `to=${liveTo}`);
  } catch (err) {
    fail("live Gmail send via real SMTP", err instanceof Error ? err.message : String(err));
  } finally {
    if (prevMock) process.env.MOCK_OUTREACH_SEND = prevMock;
  }
}

await runTests();

console.log("\n=== Summary ===");
for (const r of results) {
  console.log(`${r.status}: ${r.label}${r.detail ? ` — ${r.detail}` : ""}`);
}

process.exit(results.some((r) => r.status === "FAIL") ? 1 : 0);
