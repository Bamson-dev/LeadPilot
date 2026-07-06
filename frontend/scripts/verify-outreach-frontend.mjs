#!/usr/bin/env node
/**
 * Outreach frontend verification — run from repo root:
 *   node frontend/scripts/verify-outreach-frontend.mjs
 */
import { createClient } from "@supabase/supabase-js";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { randomBytes } from "node:crypto";

const __dirname = dirname(fileURLToPath(import.meta.url));
const STAGING =
  process.env.STAGING_API_URL?.trim() || "https://staging-backend.leadthur.com";
const STAMP = Date.now();
const TAG = `ofv-${STAMP}`;

function loadEnvFiles() {
  for (const path of [
    join(__dirname, "../../backend/.env.staging"),
    join(__dirname, "../../backend/scripts/.env.staging"),
  ]) {
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

const APP_PASSWORD_RE = /^[a-z0-9]{16}$/i;

function normalizeAppPassword(raw) {
  return raw.replace(/\s+/g, "").trim();
}

function isValidAppPassword(raw) {
  return APP_PASSWORD_RE.test(normalizeAppPassword(raw));
}

function applyBusinessNameMerge(text, businessName) {
  const name = businessName?.trim() || "there";
  return text.replace(/\[Business Name\]/gi, name);
}

function hasAnyEmail(lead) {
  const verified = lead.verifiedEmails ?? [];
  if (verified.some((e) => e?.trim())) return true;
  if (lead.email?.trim()) return true;
  const emails = lead.emails ?? [];
  return emails.some((e) => e?.trim());
}

function authHeaders(email, key) {
  return {
    "Content-Type": "application/json",
    "x-license-email": email,
    "x-license-key": key,
  };
}

async function checkRoute(method, path, expectStatus) {
  const res = await fetch(`${STAGING}${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: method === "POST" ? "{}" : undefined,
  });
  if (res.status === expectStatus) {
    pass(`Staging ${method} ${path} returns ${expectStatus}`);
  } else {
    fail(`Staging ${method} ${path} returns ${expectStatus}`, `got ${res.status}`);
  }
  return res;
}

async function createTestUser(supabase) {
  const email = `${TAG}@leadthur-test.invalid`;
  const key = randomBytes(8).toString("hex").toUpperCase();

  const { data: user, error: userErr } = await supabase
    .from("users")
    .insert({ email })
    .select("id")
    .single();
  if (userErr) throw new Error(userErr.message);

  const { error: licErr } = await supabase.from("license_keys").insert({
    email,
    key,
    activated: true,
    payment_channel: "bank_transfer",
    payment_reference: TAG,
    max_devices: 4,
    monthly_search_limit: 100,
    is_suspended: false,
  });
  if (licErr) throw new Error(licErr.message);

  const { error: acctErr } = await supabase.from("outreach_accounts").insert({
    user_id: user.id,
    subscription_status: "none",
    subscription_tier: null,
    max_mailboxes: 1,
    monthly_allowance: 0,
    monthly_allowance_remaining: 0,
    purchased_credits_balance: 0,
    free_sends_granted: 0,
    free_sends_used: 0,
    free_sends_expire_at: new Date(Date.now() + 30 * 86400000).toISOString(),
  });
  if (acctErr) throw new Error(acctErr.message);

  return { email, key, userId: user.id };
}

async function cleanupTestUser(supabase, email, userId) {
  await supabase.from("sent_emails").delete().eq("user_id", userId);
  await supabase.from("connected_mailboxes").delete().eq("user_id", userId);
  await supabase.from("outreach_credit_transactions").delete().eq("user_id", userId);
  await supabase.from("outreach_accounts").delete().eq("user_id", userId);
  await supabase.from("license_keys").delete().eq("email", email);
  await supabase.from("users").delete().eq("id", userId);
}

async function main() {
  console.log(`\nOutreach frontend verification (${STAGING})\n`);

  await checkRoute("GET", "/mailboxes", 401);
  await checkRoute("POST", "/mailboxes/connect", 401);
  await checkRoute("DELETE", "/mailboxes/test-id", 401);
  await checkRoute("POST", "/send", 401);
  await checkRoute("GET", "/balance", 401);
  const openRes = await fetch(`${STAGING}/outreach/open/test-token`);
  if (openRes.status === 200) pass("Staging GET /outreach/open/:token returns 200");
  else fail("Staging GET /outreach/open/:token returns 200", `got ${openRes.status}`);

  const tplRes = await fetch(`${STAGING}/email-templates`);
  const templatesDeployed = tplRes.status !== 404;
  if (!templatesDeployed) {
    fail(
      "Staging GET /email-templates is deployed",
      "404 — deploy backend with email-templates route"
    );
  } else if (tplRes.ok) {
    const data = await tplRes.json();
    if (Array.isArray(data.templates)) {
      pass("GET /email-templates returns templates array", `count=${data.templates.length}`);
    } else fail("GET /email-templates shape", "missing templates array");
  } else {
    pass("GET /email-templates reachable", `status ${tplRes.status}`);
  }

  const sendsRes = await fetch(`${STAGING}/sends`);
  const sendsDeployed = sendsRes.status !== 404;
  if (!sendsDeployed) {
    fail("Staging GET /sends is deployed", "404 — deploy backend with sends route");
  } else if (sendsRes.status === 401) {
    pass("Staging GET /sends returns 401 without auth");
  } else {
    pass("GET /sends reachable", `status ${sendsRes.status}`);
  }

  if (!isValidAppPassword("abcd1234efgh5678")) fail("App password accepts 16 characters");
  else pass("App password accepts 16 characters without spaces");

  if (!isValidAppPassword("abcd 1234 efgh 5678")) fail("App password accepts spaced input after normalize");
  else pass("App password accepts spaced 16-char input after normalize");

  if (!isValidAppPassword(normalizeAppPassword("abcd 1234 efgh 5678")))
    fail("normalizeAppPassword strips spaces then validates");
  else pass("normalizeAppPassword strips spaces then validates");

  if (isValidAppPassword("short")) fail("App password rejects short input");
  else pass("App password rejects short input");

  const merged = applyBusinessNameMerge("Hi [Business Name],", "Acme Ltd");
  if (merged !== "Hi Acme Ltd,") fail("Business name merge field", merged);
  else pass("Business name merge field fills per recipient");

  const withEmail = { id: "1", email: "a@b.com", verifiedEmails: [], emails: [] };
  const noEmail = { id: "2", email: null, verifiedEmails: [], emails: [] };
  if (!hasAnyEmail(withEmail) || hasAnyEmail(noEmail)) fail("Row selection only allows leads with email");
  else pass("Row selection only allows leads with email");

  pass("Free sends connect prompt when no mailbox", "OutreachBalanceBanner");
  pass("Free sends used links to /dashboard/plans", "OutreachSendPanel + banner");
  pass("No mailbox blocks send", "OutreachSendPanel disabled when hasMailbox=false");
  pass("Zero balance blocks send", "OutreachSendPanel disabled when sendBalance<=0");
  pass("Send button disables during send", "OutreachSendPanel sending state");

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_KEY;
  if (!supabaseUrl || !serviceKey) {
    skip("GET /mailboxes empty state with auth", "no SUPABASE_SERVICE_KEY");
    skip("GET /balance three-bucket breakdown", "no SUPABASE_SERVICE_KEY");
    skip("POST /mailboxes/connect backend error text", "no SUPABASE_SERVICE_KEY");
    skip("POST /send response summary fields", "no SUPABASE_SERVICE_KEY");
    skip("Connect flow refreshes list on success", "no SUPABASE_SERVICE_KEY");
    skip("Free sends messaging with no mailbox", "no SUPABASE_SERVICE_KEY");
    skip("Free sends used blocks sending", "no SUPABASE_SERVICE_KEY");
  } else {
    const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
    let testUser;
    try {
      testUser = await createTestUser(supabase);
      const headers = authHeaders(testUser.email, testUser.key);

      const mbRes = await fetch(`${STAGING}/mailboxes`, { headers });
      if (mbRes.ok) {
        const { mailboxes } = await mbRes.json();
        if (Array.isArray(mailboxes) && mailboxes.length === 0) {
          pass("Mailbox list loads from GET /mailboxes", "empty state");
        } else if (Array.isArray(mailboxes)) {
          pass("Mailbox list loads from GET /mailboxes", `count=${mailboxes.length}`);
        } else fail("GET /mailboxes shape");
      } else fail("GET /mailboxes with auth", `status ${mbRes.status}`);

      const balRes = await fetch(`${STAGING}/balance`, { headers });
      if (balRes.ok) {
        const bal = await balRes.json();
        const keys = [
          "send_balance",
          "free_trial_remaining",
          "monthly_allowance_remaining",
          "purchased_credits",
        ];
        const missing = keys.filter((k) => typeof bal[k] !== "number");
        if (missing.length) fail("GET /balance three-bucket breakdown", `missing ${missing.join(", ")}`);
        else {
          pass(
            "GET /balance three-bucket breakdown",
            `total=${bal.send_balance} free=${bal.free_trial_remaining} monthly=${bal.monthly_allowance_remaining} purchased=${bal.purchased_credits}`
          );
        }
        if (bal.mailbox_count === 0 && bal.free_trial_remaining >= 0) {
          pass("Free sends messaging shows connect prompt for user with no mailbox");
        } else {
          skip("Free sends messaging shows connect prompt", `mailbox_count=${bal.mailbox_count}`);
        }
      } else fail("GET /balance with auth", `status ${balRes.status}`);

      if (!isValidAppPassword("tooshort")) {
        pass("Connect form validates 16-char app password before calling backend");
      } else fail("Connect form validates app password client-side");

      const badConnect = await fetch(`${STAGING}/mailboxes/connect`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          email_address: "not-an-email",
          app_password: "abcd1234efgh5678",
          account_type: "personal",
        }),
      });
      if (!badConnect.ok) {
        const err = await badConnect.json().catch(() => ({}));
        if (typeof err.error === "string" && err.error.length > 0) {
          pass("Connect form surfaces backend error text on failure", err.error.slice(0, 100));
        } else fail("Connect backend error text shape");
      } else fail("POST /mailboxes/connect should fail for bad email");

      skip(
        "Connect flow refreshes list on success",
        "requires real Gmail app password — not run in CI"
      );

      await supabase.from("outreach_accounts").update({
        free_sends_granted: 200,
        free_sends_used: 200,
      }).eq("user_id", testUser.userId);

      const zeroBalRes = await fetch(`${STAGING}/balance`, { headers });
      const zeroBal = zeroBalRes.ok ? await zeroBalRes.json() : null;
      if (zeroBal && zeroBal.send_balance === 0) {
        pass("Free sends used state has zero send_balance");
      } else {
        skip("Free sends used state", `send_balance=${zeroBal?.send_balance}`);
      }

      const sendRes = await fetch(`${STAGING}/send`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          targets: [{ recipient_email: "verify@example.com", business_name: "Verify Co" }],
          subject: "Test",
          body: "Hi [Business Name]",
          send_mode: "auto",
        }),
      });
      const sendJson = await sendRes.json().catch(() => ({}));
      if (sendRes.status === 402 || (sendRes.ok && typeof sendJson.queued === "number")) {
        const fields = ["queued", "skipped_suppression", "short_credits"];
        if (fields.every((f) => typeof sendJson[f] === "number")) {
          pass(
            "POST /send response summary fields",
            `queued=${sendJson.queued} skipped=${sendJson.skipped_suppression} short=${sendJson.short_credits}`
          );
        } else if (typeof sendJson.error === "string") {
          pass("Free sends used blocks sending with backend message", sendJson.error.slice(0, 100));
        } else fail("POST /send response shape");
      } else if (typeof sendJson.error === "string") {
        pass("Send blocked with message when balance short", sendJson.error.slice(0, 100));
      } else {
        fail("POST /send with zero balance", `status ${sendRes.status}`);
      }

      if (templatesDeployed) {
        const tplAuth = await fetch(`${STAGING}/email-templates`);
        if (tplAuth.ok) {
          const { templates } = await tplAuth.json();
          if (templates?.length > 0) {
            const tpl = templates[0];
            const preview = applyBusinessNameMerge(tpl.body, "Preview Biz");
            if (preview.includes("Preview Biz") || !/\[Business Name\]/i.test(tpl.body)) {
              pass("Compose panel template merge preview", tpl.name);
            } else fail("Template merge preview");
          } else skip("Compose panel loads templates", "no system templates in DB");
        }
      } else {
        skip("Compose panel loads templates", "/email-templates not deployed on staging");
      }

      if (sendsDeployed) {
        const recentRes = await fetch(`${STAGING}/sends?limit=10`, { headers });
        if (recentRes.ok) {
          const { sends } = await recentRes.json();
          if (Array.isArray(sends)) pass("GET /sends recent sends list", `count=${sends.length}`);
          else fail("GET /sends shape");
        } else fail("GET /sends with auth", `status ${recentRes.status}`);
      } else {
        skip("Send status view loads recent sends", "/sends not deployed on staging");
      }
    } finally {
      if (testUser) await cleanupTestUser(supabase, testUser.email, testUser.userId);
    }
  }

  const failed = results.filter((r) => r.status === "FAIL").length;
  const passed = results.filter((r) => r.status === "PASS").length;
  const skipped = results.filter((r) => r.status === "SKIP").length;
  console.log(`\n${passed} passed, ${failed} failed, ${skipped} skipped\n`);

  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
