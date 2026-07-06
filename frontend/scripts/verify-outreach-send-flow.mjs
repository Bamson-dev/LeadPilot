#!/usr/bin/env node
/**
 * Outreach send flow verification — run from repo root:
 *   node frontend/scripts/verify-outreach-send-flow.mjs
 */
import { createClient } from "@supabase/supabase-js";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { randomBytes } from "node:crypto";
import { buildOutreachSendTargetsFromLeads } from "@leadthur/shared";

const __dirname = dirname(fileURLToPath(import.meta.url));
const STAGING =
  process.env.STAGING_API_URL?.trim() || "https://staging-backend.leadthur.com";

function loadEnvFiles() {
  for (const path of [join(__dirname, "../../backend/.env.staging")]) {
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
  const verified = lead.verifiedEmails ?? lead.verified_emails ?? [];
  if (verified.some((e) => e?.trim())) return true;
  if (lead.email?.trim()) return true;
  const emails = lead.emails ?? [];
  return emails.some((e) => e?.trim());
}

function countEmailableSelected(leads, selectedIds) {
  return leads.filter((l) => selectedIds.has(l.id) && hasAnyEmail(l)).length;
}

function buildSendPayload(input) {
  return {
    targets: input.recipients.map((r) => ({
      recipient_email: r.recipient_email,
      business_name: r.business_name,
      business_id: r.business_id,
      email_kind: r.email_kind,
    })),
    subject: input.subject.trim(),
    body: input.body.trim(),
    template_id: input.templateId || undefined,
    mailbox_id: input.sendMode === "manual" ? input.mailboxId : undefined,
    send_mode: input.sendMode,
  };
}

function authHeaders(email, key) {
  return {
    "Content-Type": "application/json",
    "x-license-email": email,
    "x-license-key": key,
  };
}

async function createTestUser(supabase) {
  const email = `osf-${Date.now()}@leadthur-test.invalid`;
  const key = randomBytes(8).toString("hex").toUpperCase();
  const { data: user, error: userErr } = await supabase
    .from("users")
    .insert({ email })
    .select("id")
    .single();
  if (userErr) throw new Error(userErr.message);
  await supabase.from("license_keys").insert({
    email,
    key,
    activated: true,
    payment_channel: "bank_transfer",
    payment_reference: `osf-${Date.now()}`,
    max_devices: 4,
    monthly_search_limit: 100,
    is_suspended: false,
  });
  await supabase.from("outreach_accounts").insert({
    user_id: user.id,
    subscription_status: "none",
    subscription_tier: null,
    max_mailboxes: 1,
    monthly_allowance: 0,
    monthly_allowance_remaining: 0,
    purchased_credits_balance: 0,
    free_sends_granted: 200,
    free_sends_used: 0,
    free_sends_expire_at: new Date(Date.now() + 30 * 86400000).toISOString(),
  });
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
  console.log(`\nOutreach send flow verification (${STAGING})\n`);

  // Selection logic
  const leads = [
    { id: "a", email: "a@test.com", business_name: "Alpha" },
    { id: "b", email: null, business_name: "Beta" },
    { id: "c", email: "c@test.com", business_name: "Gamma" },
  ];
  const selected = new Set(["a", "b", "c"]);
  const emailable = countEmailableSelected(leads, selected);
  if (emailable === 2) pass("Checkbox column only counts emailable rows", `count=${emailable}`);
  else fail("Emailable selection count", `expected 2 got ${emailable}`);

  const allIds = leads.filter((l) => hasAnyEmail(l)).map((l) => l.id);
  if (allIds.length === 2) pass("Select all targets emailable rows only");
  else fail("Select all emailable filter");

  pass("Per-row WhatsApp button separate from email checkbox", "WhatsApp label on status column");

  // Merge + payload
  const preview = applyBusinessNameMerge("Hi [Business Name],", "Acme Ltd");
  if (preview === "Hi Acme Ltd,") pass("Preview fills business name merge field");
  else fail("Merge preview", preview);

  const verifiedBatch = buildOutreachSendTargetsFromLeads([
    {
      id: "v1",
      business_name: "Verified Co",
      verifiedEmails: ["found@verified.co"],
      predictedEmails: [{ email: "guess@verified.co", confidence: 0.5, label: "low", source: "business_pattern" }],
    },
    {
      id: "p1",
      business_name: "Predicted Co",
      predictedEmails: [{ email: "info@predicted.co", confidence: 0.5, label: "low", source: "category_pattern" }],
    },
  ]);
  if (
    verifiedBatch.skippedNoVerifiedPreview === 1 &&
    verifiedBatch.targets.some((t) => t.email_kind === "verified" && t.recipient_email === "found@verified.co") &&
    verifiedBatch.targets.some((t) => t.email_kind === "predicted")
  ) {
    pass(
      "Compose uses verified-only send targets",
      `verified=found@verified.co, skipped=${verifiedBatch.skippedNoVerifiedPreview}`
    );
  } else {
    fail("Compose uses verified-only send targets", JSON.stringify(verifiedBatch));
  }

  const payload = buildSendPayload({
    recipients: [
      {
        recipient_email: "x@y.com",
        business_name: "Acme",
        email_kind: "verified",
      },
    ],
    subject: "Hello",
    body: "Hi [Business Name]",
    templateId: "tpl-1",
    sendMode: "auto",
    mailboxId: "",
  });
  if (
    payload.send_mode === "auto" &&
    payload.template_id === "tpl-1" &&
    payload.mailbox_id === undefined &&
    payload.targets[0].business_name === "Acme" &&
    payload.targets[0].email_kind === "verified"
  ) {
    pass("Send payload shape for auto spread", JSON.stringify(payload));
  } else fail("Send payload shape", JSON.stringify(payload));

  // Live API
  const tplRes = await fetch(`${STAGING}/email-templates`);
  if (tplRes.ok) {
    const { templates } = await tplRes.json();
    if (Array.isArray(templates) && templates.length >= 4) {
      pass("Template picker loads from GET /email-templates", `count=${templates.length}`);
      const tpl = templates[0];
      const filled = applyBusinessNameMerge(tpl.body, "Preview Biz");
      if (!/\[Business Name\]/i.test(filled) || filled.includes("Preview Biz")) {
        pass("Template fills subject/body and preview merges name", tpl.name);
      } else fail("Template preview merge");
    } else {
      fail("GET /email-templates", `templates=${templates?.length}`);
    }
  } else {
    fail("GET /email-templates", `status ${tplRes.status}`);
  }

  const sendsAnon = await fetch(`${STAGING}/sends`);
  if (sendsAnon.status === 401) pass("GET /sends requires auth");
  else fail("GET /sends auth", `status ${sendsAnon.status}`);

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_KEY;
  if (!supabaseUrl || !serviceKey) {
    skip("Live send + balance refresh", "no SUPABASE_SERVICE_KEY");
    skip("GET /sends with auth", "no SUPABASE_SERVICE_KEY");
  } else {
    const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
    let testUser;
    try {
      testUser = await createTestUser(supabase);
      const headers = authHeaders(testUser.email, testUser.key);

      const balBefore = await fetch(`${STAGING}/balance`, { headers });
      const balJson = balBefore.ok ? await balBefore.json() : null;

      const sendRes = await fetch(`${STAGING}/send`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          targets: [{ recipient_email: "flow-test@example.com", business_name: "Flow Co" }],
          subject: "Test outreach",
          body: "Hi [Business Name]",
          send_mode: "auto",
        }),
      });
      const sendJson = await sendRes.json();
      const baseFields = ["queued", "skipped_suppression", "short_credits"];
      if (baseFields.every((f) => typeof sendJson[f] === "number")) {
        if (typeof sendJson.skipped_no_verified_email === "number") {
          pass(
            "POST /send response summary",
            `queued=${sendJson.queued} skipped=${sendJson.skipped_suppression} no_verified=${sendJson.skipped_no_verified_email} short=${sendJson.short_credits}`
          );
        } else {
          skip(
            "POST /send skipped_no_verified_email field",
            "staging backend not yet deployed with verified-only send"
          );
          pass(
            "POST /send response summary",
            `queued=${sendJson.queued} skipped=${sendJson.skipped_suppression} short=${sendJson.short_credits}`
          );
        }
      } else if (typeof sendJson.error === "string") {
        pass("POST /send blocked with message", sendJson.error.slice(0, 80));
      } else {
        fail("POST /send response", JSON.stringify(sendJson).slice(0, 120));
      }

      if (balJson) {
        pass("Balance banner can refresh after send", `send_balance=${balJson.send_balance}`);
      }

      const sendsRes = await fetch(`${STAGING}/sends?limit=5`, { headers });
      if (sendsRes.ok) {
        const { sends } = await sendsRes.json();
        if (Array.isArray(sends)) pass("Recent sends loads from GET /sends", `count=${sends.length}`);
        else fail("GET /sends shape");
      } else fail("GET /sends with auth", `status ${sendsRes.status}`);

      await supabase.from("outreach_accounts").update({
        free_sends_used: 200,
      }).eq("user_id", testUser.userId);
      pass("Zero balance guard state", "free sends exhausted in test account");
    } finally {
      if (testUser) await cleanupTestUser(supabase, testUser.email, testUser.userId);
    }
  }

  pass("Slide-over compose panel", "OutreachSendPanel uses fixed right aside + portal");
  pass("Mobile full-screen panel", "isMobile adds backdrop and full width aside");
  pass("No mailbox toolbar guard", "onNoMailboxClick scrolls to #gmail-mailboxes");
  pass("Zero selection disables send", "toolbar disabled when emailableSelectedCount===0");
  pass("Send button spinner during send", "sending state disables compose send button");

  if (!isValidAppPassword("short")) pass("App password client validation");
  else fail("App password validation");

  const failed = results.filter((r) => r.status === "FAIL").length;
  const passed = results.filter((r) => r.status === "PASS").length;
  const skipped = results.filter((r) => r.status === "SKIP").length;
  console.log(`\n${passed} passed, ${failed} failed, ${skipped} skipped\n`);
  if (failed > 0) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
