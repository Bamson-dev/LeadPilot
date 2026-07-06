#!/usr/bin/env node
/**
 * Live staging outreach integration (MOCK_OUTREACH_SEND on server must be 1).
 * Seeds predictable test users in ptuarufjtjybedmnlyqb, hits staging-backend.leadthur.com,
 * cleans up all test rows at the end.
 */
import { createClient } from "@supabase/supabase-js";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Queue } from "bullmq";
import { OUTREACH_SEND_QUEUE_NAME } from "../dist/queue/outreach-send-queue-types.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const STAGING_API = process.env.STAGING_API_URL?.trim() || "https://staging-backend.leadthur.com";
const STAMP = Date.now();
const TAG = `olta-${STAMP}`;

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

const results = [];
const testUserIds = [];
const testEmails = [];

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

const supabaseUrl = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_KEY;
if (!supabaseUrl || !serviceKey) {
  console.error("Need SUPABASE_URL + SUPABASE_SERVICE_KEY in backend/.env.staging");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
const { encryptMailboxSecret } = await import("../dist/utils/mailbox-crypto.js");

process.env.MAILBOX_ENCRYPTION_KEY =
  process.env.MAILBOX_ENCRYPTION_KEY?.trim() ||
  "9bf90eb4be912765783e5c05875295854f59c3dffbb0d3e5efd740089bdbd2fc";

const FAKE_CIPHER = encryptMailboxSecret("abcd1234efgh5678");

function authHeaders(email, key) {
  return {
    "Content-Type": "application/json",
    "x-license-email": email,
    "x-license-key": key,
  };
}

async function postSend(email, key, body) {
  const res = await fetch(`${STAGING_API}/send`, {
    method: "POST",
    headers: authHeaders(email, key),
    body: JSON.stringify(body),
  });
  return { status: res.status, body: await res.json().catch(() => ({})) };
}

async function getBalance(email, key) {
  const res = await fetch(`${STAGING_API}/balance`, {
    headers: authHeaders(email, key),
  });
  return { status: res.status, body: await res.json().catch(() => ({})) };
}

async function createUserWithLicense(email, licenseKey) {
  const normalized = email.toLowerCase();
  const key = licenseKey.toUpperCase();
  testEmails.push(normalized);

  let userId;
  const { data: existing } = await supabase.from("users").select("id").eq("email", normalized).maybeSingle();
  if (existing?.id) userId = existing.id;
  else {
    const { data, error } = await supabase.from("users").insert({ email: normalized }).select("id").single();
    if (error) throw new Error(`user: ${error.message}`);
    userId = data.id;
  }
  testUserIds.push(userId);

  const { data: lic } = await supabase
    .from("license_keys")
    .select("id")
    .eq("email", normalized)
    .eq("key", key)
    .maybeSingle();
  if (!lic) {
    const { error } = await supabase.from("license_keys").insert({
      email: normalized,
      key,
      activated: true,
      payment_channel: "bank_transfer",
      payment_reference: `${TAG}-${Math.random().toString(36).slice(2, 8)}`,
      max_devices: 4,
      monthly_search_limit: 100,
      is_suspended: false,
    });
    if (error) throw new Error(`license: ${error.message}`);
  }
  return userId;
}

async function seedOutreachAccount(userId, patch) {
  await supabase.from("outreach_accounts").delete().eq("user_id", userId);
  const { error } = await supabase.from("outreach_accounts").insert({
    user_id: userId,
    subscription_status: patch.subscription_status ?? "active",
    subscription_tier: patch.subscription_tier ?? "starter",
    max_mailboxes: patch.max_mailboxes ?? 2,
    monthly_allowance: patch.monthly_allowance ?? 100,
    monthly_allowance_remaining: patch.monthly_allowance_remaining ?? 0,
    purchased_credits_balance: patch.purchased_credits_balance ?? 0,
    free_sends_granted: patch.free_sends_granted ?? 0,
    free_sends_used: patch.free_sends_used ?? 0,
    free_sends_expire_at:
      patch.free_sends_expire_at ?? new Date(Date.now() + 30 * 86400000).toISOString(),
    monthly_allowance_reset_at: patch.monthly_allowance_reset_at ?? null,
    subscription_renews_at: patch.subscription_renews_at ?? null,
  });
  if (error) throw new Error(`outreach_accounts: ${error.message}`);
}

async function insertMailbox(userId, opts = {}) {
  const email = opts.email_address ?? `sender.${TAG}@gmail.com`;
  const { data, error } = await supabase
    .from("connected_mailboxes")
    .insert({
      user_id: userId,
      email_address: email,
      encrypted_app_password: FAKE_CIPHER,
      account_type: opts.account_type ?? "personal",
      status: "active",
      daily_cap: opts.daily_cap ?? 300,
      daily_send_count: opts.daily_send_count ?? 0,
      daily_count_reset_at: opts.daily_count_reset_at ?? new Date(Date.now() + 86400000).toISOString(),
      last_verified_at: new Date().toISOString(),
    })
    .select("*")
    .single();
  if (error) throw new Error(`mailbox: ${error.message}`);
  return data;
}

async function getSentRows(userId, ids) {
  const q = supabase.from("sent_emails").select("*").eq("user_id", userId);
  if (ids?.length) q.in("id", ids);
  const { data, error } = await q.order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
}

async function getLedger(userId) {
  const { data, error } = await supabase
    .from("outreach_credit_transactions")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
}

async function waitForSent(userId, ids, { timeoutMs = 90000, expectStatus = "sent" } = {}) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const rows = await getSentRows(userId, ids);
    const allDone = ids.every((id) => {
      const row = rows.find((r) => r.id === id);
      return row && (row.status === expectStatus || row.status === "failed");
    });
    if (allDone) return rows.filter((r) => ids.includes(r.id));
    await new Promise((r) => setTimeout(r, 2000));
  }
  return getSentRows(userId, ids);
}

async function cleanupAll() {
  const uniqueUserIds = [...new Set(testUserIds)];
  const uniqueEmails = [...new Set(testEmails)];
  for (const userId of uniqueUserIds) {
    await supabase.from("sent_emails").delete().eq("user_id", userId);
    await supabase.from("email_suppression").delete().eq("user_id", userId);
    await supabase.from("connected_mailboxes").delete().eq("user_id", userId);
    await supabase.from("outreach_credit_transactions").delete().eq("user_id", userId);
    await supabase.from("outreach_accounts").delete().eq("user_id", userId);
  }
  for (const email of uniqueEmails) {
    await supabase.from("license_keys").delete().eq("email", email);
    await supabase.from("users").delete().eq("email", email);
  }
}

async function verifyZeroTestRows() {
  let remaining = 0;
  for (const email of [...new Set(testEmails)]) {
    const { count: u } = await supabase
      .from("users")
      .select("*", { head: true, count: "exact" })
      .eq("email", email);
    const { count: l } = await supabase
      .from("license_keys")
      .select("*", { head: true, count: "exact" })
      .eq("email", email);
    remaining += (u ?? 0) + (l ?? 0);
  }
  for (const userId of [...new Set(testUserIds)]) {
    for (const table of [
      "sent_emails",
      "email_suppression",
      "connected_mailboxes",
      "outreach_credit_transactions",
      "outreach_accounts",
    ]) {
      const { count } = await supabase
        .from(table)
        .select("*", { head: true, count: "exact" })
        .eq("user_id", userId);
      remaining += count ?? 0;
    }
  }
  return remaining;
}

async function checkRedisOutreachQueue() {
  const health = await fetch(`${STAGING_API}/health`).then((r) => r.json());
  if (health?.queue?.mode !== "bullmq") {
    fail("redis enabled on staging (via /health)", JSON.stringify(health?.queue));
    return { redisOk: false, outreachQueue: null };
  }
  pass("redis enabled on staging (via /health)", `search queue mode=${health.queue.mode}`);

  const redisUrl = process.env.REDIS_URL?.trim();
  if (!redisUrl) {
    skip(
      "outreach queue redis key inspection",
      "REDIS_URL not in local env — inferred BullMQ from shared Redis probe on server"
    );
    return { redisOk: true, outreachQueue: "inferred" };
  }

  const queue = new Queue(OUTREACH_SEND_QUEUE_NAME, {
    connection: { url: redisUrl, maxRetriesPerRequest: null },
  });
  const counts = await queue.getJobCounts("active", "waiting", "delayed", "completed", "failed");
  await queue.close();
  pass(
    "outreach queue exists in redis",
    `${OUTREACH_SEND_QUEUE_NAME} counts=${JSON.stringify(counts)}`
  );
  return { redisOk: true, outreachQueue: counts };
}

console.log(`Branch check: run from staging git branch (tag=${TAG})`);
console.log(`Staging API: ${STAGING_API}`);
console.log(`Supabase: ${supabaseUrl}`);

try {
  await checkRedisOutreachQueue();

  // --- 1. Send flow end-to-end ---
  const e2eEmail = `${TAG}-e2e@leadthur-verify.local`;
  const e2eKey = `LP-${STAMP}-E2E`;
  const e2eUserId = await createUserWithLicense(e2eEmail, e2eKey);
  await seedOutreachAccount(e2eUserId, {
    monthly_allowance_remaining: 10,
    purchased_credits_balance: 0,
    free_sends_granted: 0,
    free_sends_used: 0,
  });
  await insertMailbox(e2eUserId, { email_address: `e2e.${TAG}@gmail.com` });

  const e2eTargets = [
    { recipient_email: `e2e-a.${TAG}@example.com`, business_name: "Alpha" },
    { recipient_email: `e2e-b.${TAG}@example.com`, business_name: "Beta" },
    { recipient_email: `e2e-c.${TAG}@example.com`, business_name: "Gamma" },
  ];
  const e2eSend = await postSend(e2eEmail, e2eKey, {
    targets: e2eTargets,
    subject: "Hello [Business Name]",
    body: "Hi [Business Name]",
    send_mode: "auto",
  });
  if (e2eSend.status !== 202 || e2eSend.body?.queued !== 3) {
    fail("send e2e queue response", JSON.stringify(e2eSend));
  } else {
    pass("send e2e queue response", `status=${e2eSend.status}, queued=${e2eSend.body.queued}`);
  }

  const e2eRows = await waitForSent(e2eUserId, e2eSend.body.sent_email_ids ?? []);
  const allSent = e2eRows.length === 3 && e2eRows.every((r) => r.status === "sent");
  const allMockIds = e2eRows.every((r) => r.provider_message_id?.startsWith("mock-"));
  if (allSent && allMockIds) {
    pass(
      "send e2e mock provider ids",
      e2eRows.map((r) => ({ id: r.id, status: r.status, provider_message_id: r.provider_message_id })).slice(0, 2)
    );
    pass("MOCK_OUTREACH_SEND inferred on server", "provider_message_id starts with mock-");
  } else {
    fail("send e2e mock provider ids", JSON.stringify(e2eRows));
  }

  // --- 2. Bucket spend order ---
  const bucketEmail = `${TAG}-bucket@leadthur-verify.local`;
  const bucketKey = `LP-${STAMP}-BKT`;
  const bucketUserId = await createUserWithLicense(bucketEmail, bucketKey);
  await seedOutreachAccount(bucketUserId, {
    free_sends_granted: 2,
    free_sends_used: 0,
    monthly_allowance_remaining: 3,
    purchased_credits_balance: 2,
  });
  await insertMailbox(bucketUserId, { email_address: `bucket.${TAG}@gmail.com` });

  const bucketTargets = Array.from({ length: 6 }, (_, i) => ({
    recipient_email: `bucket${i}.${TAG}@example.com`,
    business_name: `B${i}`,
  }));
  const bucketSend = await postSend(bucketEmail, bucketKey, {
    targets: bucketTargets,
    subject: "Hi",
    body: "Body",
    send_mode: "auto",
  });
  if (bucketSend.status !== 202 || bucketSend.body?.queued !== 6) {
    fail("bucket spend queue", JSON.stringify(bucketSend));
  } else {
    pass("bucket spend queue", `queued=${bucketSend.body.queued}`);
  }

  await waitForSent(bucketUserId, bucketSend.body.sent_email_ids ?? []);
  const spendLedger = (await getLedger(bucketUserId)).filter((r) => r.type === "spend");
  const freeSpends = spendLedger.filter((r) => r.bucket === "free_trial");
  const monthlySpends = spendLedger.filter((r) => r.bucket === "monthly_allowance");
  const purchasedSpends = spendLedger.filter((r) => r.bucket === "purchased_credits");
  const ledgerSummary = spendLedger.map((r) => ({
    bucket: r.bucket,
    amount: r.amount,
    reference: r.reference,
  }));

  if (freeSpends.length === 2 && monthlySpends.length === 3 && purchasedSpends.length === 1) {
    pass(
      "bucket spend order",
      `free=${freeSpends.length}, monthly=${monthlySpends.length}, purchased=${purchasedSpends.length}`
    );
    pass("bucket spend ledger rows", JSON.stringify(ledgerSummary));
  } else {
    fail(
      "bucket spend order",
      JSON.stringify({ freeSpends: freeSpends.length, monthlySpends: monthlySpends.length, purchasedSpends: purchasedSpends.length, ledgerSummary })
    );
  }

  const { data: bucketAcct } = await supabase
    .from("outreach_accounts")
    .select("free_sends_used, monthly_allowance_remaining, purchased_credits_balance")
    .eq("user_id", bucketUserId)
    .single();
  if (
    bucketAcct?.free_sends_used === 2 &&
    bucketAcct?.monthly_allowance_remaining === 0 &&
    bucketAcct?.purchased_credits_balance === 1
  ) {
    pass("bucket balances after 6 sends", JSON.stringify(bucketAcct));
  } else {
    fail("bucket balances after 6 sends", JSON.stringify(bucketAcct));
  }

  // --- 3. Open tracking ---
  const trackRow = e2eRows[0];
  const token = trackRow.tracking_token;
  const beforeOpen = { open_count: trackRow.open_count ?? 0, opened_at: trackRow.opened_at };
  const hit1 = await fetch(`${STAGING_API}/outreach/open/${token}`);
  const gif = Buffer.from(await hit1.arrayBuffer());
  const isGif = hit1.status === 200 && hit1.headers.get("content-type")?.includes("image/gif");
  await new Promise((r) => setTimeout(r, 500));
  const hit2 = await fetch(`${STAGING_API}/outreach/open/${token}`);
  const after1 = (await getSentRows(e2eUserId, [trackRow.id]))[0];
  const after2 = (await (async () => {
    await fetch(`${STAGING_API}/outreach/open/${token}`);
    await new Promise((r) => setTimeout(r, 500));
    return (await getSentRows(e2eUserId, [trackRow.id]))[0];
  })());

  if (
    isGif &&
    gif.length > 0 &&
    after1?.opened_at &&
    (after1.open_count ?? 0) >= beforeOpen.open_count + 1 &&
    after2?.opened_at === after1.opened_at &&
    (after2.open_count ?? 0) >= (after1.open_count ?? 0) + 1
  ) {
    pass(
      "open tracking live",
      `before open_count=${beforeOpen.open_count}, after1=${after1.open_count}, after2=${after2.open_count}, opened_at fixed`
    );
  } else {
    fail(
      "open tracking live",
      JSON.stringify({ isGif, beforeOpen, after1, after2, hit1: hit1.status, hit2: hit2.status })
    );
  }

  // --- 4. Suppression skip ---
  const supEmail = `${TAG}-sup@leadthur-verify.local`;
  const supKey = `LP-${STAMP}-SUP`;
  const supUserId = await createUserWithLicense(supEmail, supKey);
  await seedOutreachAccount(supUserId, { monthly_allowance_remaining: 5 });
  await insertMailbox(supUserId, { email_address: `sup.${TAG}@gmail.com` });
  const blocked = `blocked.${TAG}@example.com`;
  await supabase.from("email_suppression").insert({
    user_id: supUserId,
    recipient_email: blocked,
  });
  const supSend = await postSend(supEmail, supKey, {
    targets: [
      { recipient_email: blocked, business_name: "Blocked" },
      { recipient_email: `ok.${TAG}@example.com`, business_name: "OK" },
    ],
    subject: "Hi",
    body: "Body",
    send_mode: "auto",
  });
  const supRows = await getSentRows(supUserId);
  if (
    supSend.body?.skipped_suppression === 1 &&
    supSend.body?.queued === 1 &&
    supRows.length === 1 &&
    (await getLedger(supUserId)).filter((r) => r.type === "spend").length <= 1
  ) {
    pass(
      "suppression skip",
      `skipped_suppression=${supSend.body.skipped_suppression}, queued=${supSend.body.queued}, rows=${supRows.length}`
    );
  } else {
    fail("suppression skip", JSON.stringify({ supSend: supSend.body, supRows: supRows.length }));
  }

  // --- 5. Daily cap requeue ---
  const capEmail = `${TAG}-cap@leadthur-verify.local`;
  const capKey = `LP-${STAMP}-CAP`;
  const capUserId = await createUserWithLicense(capEmail, capKey);
  await seedOutreachAccount(capUserId, { monthly_allowance_remaining: 10 });
  await insertMailbox(capUserId, {
    email_address: `cap.${TAG}@gmail.com`,
    daily_cap: 2,
    daily_send_count: 2,
    daily_count_reset_at: new Date(Date.now() + 120_000).toISOString(),
  });
  const capSend = await postSend(capEmail, capKey, {
    targets: [{ recipient_email: `cap.${TAG}@example.com`, business_name: "Cap" }],
    subject: "Cap",
    body: "Cap",
    send_mode: "auto",
  });
  await new Promise((r) => setTimeout(r, 8000));
  const capRow = (await getSentRows(capUserId, capSend.body?.sent_email_ids ?? []))[0];
  const capLedger = (await getLedger(capUserId)).filter((r) => r.type === "spend");
  if (capRow?.status === "queued" && capLedger.length === 0) {
    pass("daily cap requeue", `status=${capRow.status}, spend rows=${capLedger.length}`);
  } else {
    fail("daily cap requeue", JSON.stringify({ capRow, capLedger }));
  }

  // --- 6. Daily reset ---
  const rstEmail = `${TAG}-rst@leadthur-verify.local`;
  const rstKey = `LP-${STAMP}-RST`;
  const rstUserId = await createUserWithLicense(rstEmail, rstKey);
  await seedOutreachAccount(rstUserId, { monthly_allowance_remaining: 5 });
  const rstMb = await insertMailbox(rstUserId, {
    email_address: `rst.${TAG}@gmail.com`,
    daily_cap: 2,
    daily_send_count: 2,
    daily_count_reset_at: new Date(Date.now() - 60_000).toISOString(),
  });
  const rstSend = await postSend(rstEmail, rstKey, {
    targets: [{ recipient_email: `rst.${TAG}@example.com`, business_name: "Rst" }],
    subject: "R",
    body: "R",
    send_mode: "auto",
  });
  const rstRows = await waitForSent(rstUserId, rstSend.body?.sent_email_ids ?? [], { timeoutMs: 60000 });
  const { data: rstMbAfter } = await supabase
    .from("connected_mailboxes")
    .select("daily_send_count, daily_cap")
    .eq("id", rstMb.id)
    .single();
  if (rstRows[0]?.status === "sent" && (rstMbAfter?.daily_send_count ?? 0) === 1) {
    pass("daily reset then send", `status=sent, daily_send_count=${rstMbAfter.daily_send_count}`);
  } else {
    fail("daily reset then send", JSON.stringify({ rstRows, rstMbAfter }));
  }

  // --- 7. Auto spread + manual ---
  const spreadEmail = `${TAG}-spread@leadthur-verify.local`;
  const spreadKey = `LP-${STAMP}-SPR`;
  const spreadUserId = await createUserWithLicense(spreadEmail, spreadKey);
  await seedOutreachAccount(spreadUserId, { monthly_allowance_remaining: 10, max_mailboxes: 2 });
  const mb1 = await insertMailbox(spreadUserId, {
    email_address: `spread1.${TAG}@gmail.com`,
    daily_cap: 2,
    daily_send_count: 0,
  });
  const mb2 = await insertMailbox(spreadUserId, {
    email_address: `spread2.${TAG}@gmail.com`,
    daily_cap: 2,
    daily_send_count: 0,
  });
  const spreadSend = await postSend(spreadEmail, spreadKey, {
    targets: Array.from({ length: 4 }, (_, i) => ({
      recipient_email: `spread${i}.${TAG}@example.com`,
      business_name: `S${i}`,
    })),
    subject: "Hi",
    body: "Body",
    send_mode: "auto",
  });
  await waitForSent(spreadUserId, spreadSend.body?.sent_email_ids ?? [], { timeoutMs: 120000 });
  const spreadRows = await getSentRows(spreadUserId, spreadSend.body?.sent_email_ids ?? []);
  const usedMailboxes = new Set(spreadRows.map((r) => r.mailbox_id).filter(Boolean));
  if (spreadRows.length === 4 && usedMailboxes.size === 2) {
    pass("auto spread across mailboxes", `mailboxes used=${[...usedMailboxes].join(",")}`);
  } else {
    fail("auto spread across mailboxes", JSON.stringify({ count: spreadRows.length, used: [...usedMailboxes] }));
  }

  const manSend = await postSend(spreadEmail, spreadKey, {
    targets: [{ recipient_email: `manual.${TAG}@example.com`, business_name: "Man" }],
    subject: "Hi",
    body: "Body",
    send_mode: "manual",
    mailbox_id: mb2.id,
  });
  const manRows = await waitForSent(spreadUserId, manSend.body?.sent_email_ids ?? []);
  if (manRows[0]?.mailbox_id === mb2.id && manRows[0]?.status === "sent") {
    pass("manual mailbox override", `mailbox_id=${manRows[0].mailbox_id}`);
  } else {
    fail("manual mailbox override", JSON.stringify(manRows[0]));
  }

  // --- 8. Refund on failure (needs MOCK_OUTREACH_SEND_FAIL_FOR on staging server) ---
  const refEmail = `${TAG}-ref@leadthur-verify.local`;
  const refKey = `LP-${STAMP}-REF`;
  const refUserId = await createUserWithLicense(refEmail, refKey);
  await seedOutreachAccount(refUserId, { monthly_allowance_remaining: 5 });
  await insertMailbox(refUserId, { email_address: `ref.${TAG}@gmail.com` });
  const failRecipient = "fail-refund@example.com";
  const refSend = await postSend(refEmail, refKey, {
    targets: [{ recipient_email: failRecipient, business_name: "Fail" }],
    subject: "Hi",
    body: "Body",
    send_mode: "auto",
  });
  const refRows = await waitForSent(refUserId, refSend.body?.sent_email_ids ?? [], {
    timeoutMs: 60000,
    expectStatus: "failed",
  });
  const refAcct = (
    await supabase
      .from("outreach_accounts")
      .select("monthly_allowance_remaining")
      .eq("user_id", refUserId)
      .single()
  ).data;
  const refLedger = await getLedger(refUserId);
  const refunds = refLedger.filter((r) => r.type === "refund");
  const spends = refLedger.filter((r) => r.type === "spend");
  if (refRows[0]?.status === "failed" && refAcct?.monthly_allowance_remaining === 5 && refunds.length === 1) {
    pass("refund on mock failure", `allowance=${refAcct.monthly_allowance_remaining}, refunds=${refunds.length}`);
  } else if (refRows[0]?.status === "sent") {
    skip(
      "refund on mock failure",
      "send succeeded — staging server likely lacks MOCK_OUTREACH_SEND_FAIL_FOR=fail-refund@example.com"
    );
  } else {
    fail("refund on mock failure", JSON.stringify({ refRows, refAcct, refunds, spends }));
  }

  // --- 9. Balance endpoint ---
  const balEmail = bucketEmail;
  const balKey = bucketKey;
  const balRes = await getBalance(balEmail, balKey);
  const { count: mbCount } = await supabase
    .from("connected_mailboxes")
    .select("*", { head: true, count: "exact" })
    .eq("user_id", bucketUserId)
    .eq("status", "active");
  const expectedFree = 0;
  const expectedMonthly = 0;
  const expectedPurchased = 1;
  if (
    balRes.status === 200 &&
    balRes.body?.free_trial_remaining === expectedFree &&
    balRes.body?.monthly_allowance_remaining === expectedMonthly &&
    balRes.body?.purchased_credits === expectedPurchased &&
    balRes.body?.subscription_tier === "starter" &&
    balRes.body?.subscription_status === "active" &&
    balRes.body?.mailbox_count === mbCount
  ) {
    pass("GET /balance breakdown", JSON.stringify(balRes.body));
  } else {
    fail("GET /balance breakdown", JSON.stringify({ status: balRes.status, body: balRes.body, mbCount }));
  }
} catch (err) {
  fail("unexpected error", err instanceof Error ? err.message : String(err));
} finally {
  console.log("\n--- cleanup ---");
  await cleanupAll();
  const remaining = await verifyZeroTestRows();
  if (remaining === 0) {
    pass("cleanup zero test rows", "all seeded outreach test data removed");
  } else {
    fail("cleanup zero test rows", `${remaining} rows remain`);
  }
}

console.log("\n=== Summary ===");
for (const r of results) {
  console.log(`${r.status}: ${r.label}${r.detail ? ` — ${r.detail}` : ""}`);
}

const failed = results.some((r) => r.status === "FAIL");
console.log(`\nMOCK_OUTREACH_SEND on staging server: inferred from mock-* provider ids (local script does not set server env)`);
console.log(`Leave MOCK_OUTREACH_SEND=1 on staging Coolify env (not changed by this script)`);
process.exit(failed ? 1 : 0);
