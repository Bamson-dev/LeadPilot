#!/usr/bin/env node
import { createRequire } from "node:module";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  registerMailboxMocks,
  resetMailboxMocks,
  seedUser,
  seedLicense,
  setOutreachAccount,
  insertMailbox,
  getSentEmailsForUser,
  getOutreachAccount,
  insertSuppression,
} from "./verify-mailbox-mocks.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
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
    if (key.includes("/dist/") || key.includes("outreach")) delete require.cache[key];
  }
}

function loadEnvFiles() {
  for (const path of [join(__dirname, ".env.staging"), join(__dirname, "../.env.staging")]) {
    if (!existsSync(path)) continue;
    for (const line of readFileSync(path, "utf8").split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq <= 0) continue;
      const key = trimmed.slice(0, eq).trim();
      const value = trimmed.slice(eq + 1).trim().replace(/^['"]|['"]$/g, "");
      if (!process.env[key]) process.env[key] = value;
    }
  }
}

async function run() {
  loadEnvFiles();
  process.env.NODE_ENV = "test";
  process.env.MOCK_OUTREACH_SEND = "1";
  process.env.OUTREACH_SEND_SKIP_SPACING = "1";
  process.env.MAILBOX_ENCRYPTION_KEY =
    process.env.MAILBOX_ENCRYPTION_KEY ||
    "9bf90eb4be912765783e5c05875295854f59c3dffbb0d3e5efd740089bdbd2fc";
  process.env.JWT_SECRET = process.env.JWT_SECRET || "test-jwt-secret-01234567890123456789012";
  process.env.ADMIN_EMAIL = process.env.ADMIN_EMAIL || "admin@test.local";
  process.env.ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "test-admin-password";
  process.env.SUPABASE_URL = process.env.SUPABASE_URL || "https://mock.supabase.co";
  process.env.SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || "mock-service-key";
  process.env.FRONTEND_URL = process.env.FRONTEND_URL || "https://staging.leadthur.com";
  delete process.env.REDIS_URL;

  resetMailboxMocks();
  clearModuleCache();
  await registerMailboxMocks({ mockSmtpVerify: true });

  const { encryptMailboxSecret } = await import("../dist/utils/mailbox-crypto.js");
  const { queueSendBatch, processOutreachSendJob } = await import("../dist/services/outreach-send-service.js");

  const stamp = Date.now();
  const email = `fu-${stamp}@test.local`;
  const key = `LP-FU-${stamp}`;
  const user = seedUser(email);
  seedLicense(email, key);
  setOutreachAccount(user.id, {
    monthly_allowance_remaining: 10,
    purchased_credits_balance: 10,
    free_sends_granted: 10,
    free_sends_used: 0,
  });
  const mailbox = insertMailbox({
    user_id: user.id,
    email_address: `sender.${stamp}@gmail.com`,
    encrypted_app_password: encryptMailboxSecret("abcd1234efgh5678"),
    account_type: "personal",
    status: "active",
    daily_cap: 300,
    daily_send_count: 0,
    daily_count_reset_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  });

  function seedScenarioUser(tag, accountOverrides, mailboxOverrides = {}) {
    const scEmail = `${tag}-${Date.now()}@test.local`;
    const scKey = `LP-${tag}-${Date.now()}`;
    const scUser = seedUser(scEmail);
    seedLicense(scEmail, scKey);
    setOutreachAccount(scUser.id, {
      free_sends_granted: 0,
      free_sends_used: 0,
      monthly_allowance_remaining: 0,
      purchased_credits_balance: 0,
      ...accountOverrides,
    });
    const scMailbox = insertMailbox({
      user_id: scUser.id,
      email_address: `${tag}.${Date.now()}@gmail.com`,
      encrypted_app_password: encryptMailboxSecret("abcd1234efgh5678"),
      account_type: "personal",
      status: "active",
      daily_cap: 300,
      daily_send_count: 0,
      daily_count_reset_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      ...mailboxOverrides,
    });
    return { scUser, scMailbox };
  }

  const queued = await queueSendBatch({
    userId: user.id,
    sendMode: "manual",
    mailboxId: mailbox.id,
    subject: "Hello [Business Name]",
    body: "Hi [Business Name]",
    targets: [{ recipient_email: "lead@example.com", business_name: "Acme", email_kind: "verified" }],
    followups: {
      enabled: true,
      steps: [
        { stepNumber: 1, gapDays: 3, subject: "FU1 [Business Name]", body: "Body1" },
        { stepNumber: 2, gapDays: 3, subject: "FU2 [Business Name]", body: "Body2" },
        { stepNumber: 3, gapDays: 4, subject: "FU3 [Business Name]", body: "Body3" },
      ],
    },
  });
  if (queued.queued === 1) pass("enroll batch with followups", "queued initial=1");
  else fail("enroll batch with followups", JSON.stringify(queued));

  const initialOutcome = await processOutreachSendJob({
    sentEmailId: queued.sent_email_ids[0],
    userId: user.id,
    sendMode: "manual",
    mailboxId: mailbox.id,
  });
  if (initialOutcome.action === "sent") {
    pass("initial send processed", `mailbox=${initialOutcome.mailboxId}`);
  } else {
    fail("initial send processed", JSON.stringify(initialOutcome));
  }
  const rowsAfterInitial = getSentEmailsForUser(user.id);
  const firstFu = rowsAfterInitial.find((r) => r.send_kind === "followup" && r.followup_step_number === 1);
  if (firstFu?.followup_due_at) pass("followup step 1 scheduled", `due=${firstFu.followup_due_at}`);
  else fail("followup step 1 scheduled");

  const panelSrc = readFileSync(join(__dirname, "../../frontend/components/dashboard/outreach-send-panel.tsx"), "utf8");
  if (panelSrc.includes("gap_days: 3") && panelSrc.includes("gap_days: 4")) {
    pass("default gaps configured", "3,3,4 found");
  } else {
    fail("default gaps configured");
  }
  if (panelSrc.includes("Math.max(2")) pass("min gap clamp", "UI clamps below 2 days");
  else fail("min gap clamp");
  if (panelSrc.includes("Math.min(3")) pass("max followups capped", "UI cap at 3 followups");
  else fail("max followups capped");

  if (firstFu) {
    firstFu.replied_at = new Date().toISOString();
    const outcomeAfterReply = await processOutreachSendJob({
      sentEmailId: firstFu.id,
      userId: user.id,
      sendMode: "manual",
      mailboxId: mailbox.id,
    });
    if (outcomeAfterReply.action === "failed") pass("mark replied stops followups");
    else fail("mark replied stops followups", JSON.stringify(outcomeAfterReply));
  } else {
    fail("mark replied stops followups", "no followup row created");
  }

  const bounceQueued = await queueSendBatch({
    userId: user.id,
    sendMode: "manual",
    mailboxId: mailbox.id,
    subject: "Initial",
    body: "Initial",
    targets: [{ recipient_email: "bounce@example.com", business_name: "Bounce", email_kind: "verified" }],
    followups: { enabled: true, steps: [{ stepNumber: 1, gapDays: 3, subject: "FU", body: "B" }] },
  });
  await processOutreachSendJob({
    sentEmailId: bounceQueued.sent_email_ids[0],
    userId: user.id,
    sendMode: "manual",
    mailboxId: mailbox.id,
  });
  const bounceRows = getSentEmailsForUser(user.id);
  const bounceFu = bounceRows.find((r) => r.recipient_email === "bounce@example.com" && r.send_kind === "followup");
  if (!bounceFu) {
    fail("hard bounce setup", "no followup row created for bounce scenario");
  } else {
    process.env.MOCK_OUTREACH_SEND_HARD_BOUNCE_FOR = "bounce@example.com";
    const bounceOutcome = await processOutreachSendJob({
      sentEmailId: bounceFu.id,
      userId: user.id,
      sendMode: "manual",
      mailboxId: mailbox.id,
    });
    if (bounceOutcome.action === "bounced") pass("hard bounce stops thread", bounceOutcome.error);
    else fail("hard bounce stops thread", JSON.stringify(bounceOutcome));
  }

  const supQueued = await queueSendBatch({
    userId: user.id,
    sendMode: "manual",
    mailboxId: mailbox.id,
    subject: "Initial",
    body: "Initial",
    targets: [{ recipient_email: "unsub@example.com", business_name: "Unsub", email_kind: "verified" }],
    followups: { enabled: true, steps: [{ stepNumber: 1, gapDays: 3, subject: "FU", body: "B" }] },
  });
  await processOutreachSendJob({
    sentEmailId: supQueued.sent_email_ids[0],
    userId: user.id,
    sendMode: "manual",
    mailboxId: mailbox.id,
  });
  insertSuppression(user.id, "unsub@example.com");
  const supRows = getSentEmailsForUser(user.id);
  const supFu = supRows.find((r) => r.recipient_email === "unsub@example.com" && r.send_kind === "followup");
  if (!supFu) {
    fail("suppression setup", "no followup row created for suppression scenario");
  } else {
    const supOutcome = await processOutreachSendJob({
      sentEmailId: supFu.id,
      userId: user.id,
      sendMode: "manual",
      mailboxId: mailbox.id,
    });
    if (supOutcome.action === "failed") pass("suppression stops followups");
    else fail("suppression stops followups", JSON.stringify(supOutcome));
  }

  const reportSrc = readFileSync(
    join(__dirname, "../../frontend/components/dashboard/outreach-sends-report.tsx"),
    "utf8"
  );
  if (
    reportSrc.includes("followup_step_number") &&
    reportSrc.includes("followup_due_at") &&
    reportSrc.includes("followup_stop_reason")
  ) {
    pass("sends report includes followup status columns");
  } else {
    fail("sends report includes followup status columns");
  }

  // Follow-ups disabled should schedule none.
  const noFuQueued = await queueSendBatch({
    userId: user.id,
    sendMode: "manual",
    mailboxId: mailbox.id,
    subject: "No FU",
    body: "No FU",
    targets: [{ recipient_email: "nofu@example.com", business_name: "NoFu", email_kind: "verified" }],
    followups: { enabled: false, steps: [] },
  });
  await processOutreachSendJob({
    sentEmailId: noFuQueued.sent_email_ids[0],
    userId: user.id,
    sendMode: "manual",
    mailboxId: mailbox.id,
  });
  const noFuRows = getSentEmailsForUser(user.id).filter((r) => r.recipient_email === "nofu@example.com");
  const noFuFollowupRows = noFuRows.filter((r) => r.send_kind === "followup");
  if (noFuRows.length === 1 && noFuFollowupRows.length === 0) {
    pass("followups off schedules zero followups", `initial_rows=1, followup_rows=0`);
  } else {
    fail(
      "followups off schedules zero followups",
      `initial_rows=${noFuRows.length}, followup_rows=${noFuFollowupRows.length}`
    );
  }

  // Same mailbox continuity + follow-up credit order.
  const { scUser: bucketUser, scMailbox: bucketMailbox } = seedScenarioUser(
    "bucket",
    {
      free_sends_granted: 1,
      free_sends_used: 0,
      monthly_allowance_remaining: 1,
      purchased_credits_balance: 1,
    }
  );
  const spendQueued = await queueSendBatch({
    userId: bucketUser.id,
    sendMode: "manual",
    mailboxId: bucketMailbox.id,
    subject: "Spend",
    body: "Spend",
    targets: [{ recipient_email: "bucket@example.com", business_name: "Bucket", email_kind: "verified" }],
    followups: {
      enabled: true,
      steps: [{ stepNumber: 1, gapDays: 3, subject: "s1", body: "b1" }],
    },
  });
  await processOutreachSendJob({
    sentEmailId: spendQueued.sent_email_ids[0],
    userId: bucketUser.id,
    sendMode: "manual",
    mailboxId: bucketMailbox.id,
  });
  const spendRows1 = getSentEmailsForUser(bucketUser.id).filter((r) => r.recipient_email === "bucket@example.com");
  const fu1 = spendRows1.find((r) => r.send_kind === "followup" && r.followup_step_number === 1);
  if (fu1) {
    await processOutreachSendJob({
      sentEmailId: fu1.id,
      userId: bucketUser.id,
      sendMode: "manual",
      mailboxId: bucketMailbox.id,
    });
    const sentRows = getSentEmailsForUser(bucketUser.id)
      .filter((r) => r.recipient_email === "bucket@example.com" && r.status === "sent")
      .sort((a, b) => new Date(a.sent_at || 0).getTime() - new Date(b.sent_at || 0).getTime());
    const buckets = sentRows.map((r) => r.credit_bucket).filter(Boolean);
    if (sentRows.length >= 2 && buckets.every((b) => b !== "none")) {
      pass("followup spends one credit per send", buckets.join(" -> "));
    } else {
      const allRows = getSentEmailsForUser(bucketUser.id)
        .filter((r) => r.recipient_email === "bucket@example.com")
        .map((r) => `${r.send_kind}:${r.followup_step_number ?? 0}:${r.status}:${r.credit_bucket ?? "none"}`)
        .join(" | ");
      fail("followup spends one credit per send", `rows=${allRows}`);
    }
    const threadRows = getSentEmailsForUser(bucketUser.id).filter(
      (r) => r.recipient_email === "bucket@example.com"
    );
    const mailboxIds = [...new Set(threadRows.map((r) => r.mailbox_id).filter(Boolean))];
    if (mailboxIds.length === 1 && threadRows.every((r) => !r.mailbox_id || r.mailbox_id === mailboxIds[0])) {
      pass(
        "every followup uses initial mailbox",
        `mailbox=${mailboxIds[0]}, thread_rows=${threadRows.length}`
      );
    } else {
      fail("every followup uses initial mailbox", `mailbox_ids=${mailboxIds.join(",")}`);
    }
  } else {
    fail("followup spends one credit per send", "missing scheduled followup rows");
    fail("followup uses same mailbox", "missing scheduled followup rows");
  }

  // Daily-cap requeue for follow-up.
  const { scUser: capUser, scMailbox: capMailbox } = seedScenarioUser(
    "cap",
    {
      free_sends_granted: 2,
      free_sends_used: 0,
      monthly_allowance_remaining: 0,
      purchased_credits_balance: 0,
    },
    {
      daily_cap: 1,
      daily_send_count: 0,
      daily_count_reset_at: new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString(),
    }
  );
  const capQueued = await queueSendBatch({
    userId: capUser.id,
    sendMode: "manual",
    mailboxId: capMailbox.id,
    subject: "cap",
    body: "cap",
    targets: [{ recipient_email: "cap@example.com", business_name: "Cap", email_kind: "verified" }],
    followups: { enabled: true, steps: [{ stepNumber: 1, gapDays: 3, subject: "capfu", body: "capfu" }] },
  });
  await processOutreachSendJob({
    sentEmailId: capQueued.sent_email_ids[0],
    userId: capUser.id,
    sendMode: "manual",
    mailboxId: capMailbox.id,
  });
  const capRows = getSentEmailsForUser(capUser.id).filter((r) => r.recipient_email === "cap@example.com");
  const capFu = capRows.find((r) => r.send_kind === "followup");
  if (capFu) {
    const beforeAccount = { ...getOutreachAccount(capUser.id) };
    const capOutcome = await processOutreachSendJob({
      sentEmailId: capFu.id,
      userId: capUser.id,
      sendMode: "manual",
      mailboxId: capMailbox.id,
    });
    const afterAccount = getOutreachAccount(capUser.id);
    const capFuAfter = getSentEmailsForUser(capUser.id).find((r) => r.id === capFu.id);
    const creditsUnchanged =
      beforeAccount.free_sends_used === afterAccount?.free_sends_used &&
      beforeAccount.monthly_allowance_remaining === afterAccount?.monthly_allowance_remaining &&
      beforeAccount.purchased_credits_balance === afterAccount?.purchased_credits_balance;
    if (capOutcome.action === "requeue") {
      pass("followup daily cap requeue", `${capOutcome.reason}; delayMs=${capOutcome.delayMs}`);
    } else {
      fail("followup daily cap requeue", JSON.stringify(capOutcome));
    }
    if (capFuAfter?.status === "queued" && !capFuAfter?.credit_bucket && creditsUnchanged) {
      pass(
        "followup cap requeue charges no credit",
        `status=${capFuAfter.status}, free_used=${afterAccount?.free_sends_used}, monthly=${afterAccount?.monthly_allowance_remaining}, purchased=${afterAccount?.purchased_credits_balance}`
      );
    } else {
      fail(
        "followup cap requeue charges no credit",
        JSON.stringify({
          status: capFuAfter?.status,
          credit_bucket: capFuAfter?.credit_bucket,
          before: {
            free_used: beforeAccount.free_sends_used,
            monthly: beforeAccount.monthly_allowance_remaining,
            purchased: beforeAccount.purchased_credits_balance,
          },
          after: {
            free_used: afterAccount?.free_sends_used,
            monthly: afterAccount?.monthly_allowance_remaining,
            purchased: afterAccount?.purchased_credits_balance,
          },
        })
      );
    }
  } else {
    fail("followup daily cap requeue", "missing followup row");
    fail("followup cap requeue charges no credit", "missing followup row");
  }

  const failed = results.filter((r) => r.status === "FAIL");
  if (failed.length) {
    console.error(`\n${failed.length} checks failed`);
    process.exit(1);
  }
  console.log(`\nAll ${results.length} checks passed`);
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
