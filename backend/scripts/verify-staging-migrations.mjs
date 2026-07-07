#!/usr/bin/env node
/**
 * Confirm staging DB artifacts for migrations 030–033 (uses backend/.env.staging).
 */
import { createClient } from "@supabase/supabase-js";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

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

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_KEY;
if (!url || !key) {
  console.error("Need SUPABASE_URL + SUPABASE_SERVICE_KEY in backend/.env.staging");
  process.exit(1);
}

const ref = url.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1] ?? "unknown";
const sb = createClient(url, key, { auth: { persistSession: false } });

const checks = [
  { id: "030", label: "connected_mailboxes", run: () => sb.from("connected_mailboxes").select("id", { head: true, count: "exact" }) },
  { id: "030", label: "outreach_accounts", run: () => sb.from("outreach_accounts").select("user_id", { head: true, count: "exact" }) },
  { id: "031", label: "outreach_paystack_plans", run: () => sb.from("outreach_paystack_plans").select("tier", { head: true, count: "exact" }) },
  { id: "031", label: "outreach_payments", run: () => sb.from("outreach_payments").select("id", { head: true, count: "exact" }) },
  { id: "032", label: "global_invalid_emails", run: () => sb.from("global_invalid_emails").select("email", { head: true, count: "exact" }) },
  { id: "033", label: "outreach_followup_batches", run: () => sb.from("outreach_followup_batches").select("id", { head: true, count: "exact" }) },
  { id: "033", label: "outreach_followup_steps", run: () => sb.from("outreach_followup_steps").select("id", { head: true, count: "exact" }) },
];

const followupCols = [
  "followup_batch_id",
  "root_sent_email_id",
  "send_kind",
  "followup_step_number",
  "followup_due_at",
  "followup_stopped_at",
  "followup_stop_reason",
  "replied_at",
];

const results = [];
for (const check of checks) {
  const { error } = await check.run();
  const status = error ? "FAIL" : "PASS";
  const detail = error ? error.message : "ok";
  results.push({ migration: check.id, label: check.label, status, detail });
  console.log(`${status}: migration ${check.id} ${check.label} — ${detail}`);
}

let colOk = 0;
for (const col of followupCols) {
  const { error } = await sb.from("sent_emails").select(col).limit(1);
  if (!error) colOk += 1;
  else console.log(`FAIL: migration 033 sent_emails.${col} — ${error.message}`);
}
if (colOk === followupCols.length) {
  results.push({ migration: "033", label: "sent_emails followup columns", status: "PASS", detail: `${colOk}/8` });
  console.log(`PASS: migration 033 sent_emails followup columns — ${colOk}/8`);
} else {
  results.push({
    migration: "033",
    label: "sent_emails followup columns",
    status: "FAIL",
    detail: `${colOk}/${followupCols.length}`,
  });
  console.log(`FAIL: migration 033 sent_emails followup columns — ${colOk}/${followupCols.length}`);
}

console.log(`\nStaging project ref: ${ref}`);
const failed = results.filter((r) => r.status === "FAIL");
if (failed.length) {
  console.error(`\n${failed.length} migration checks failed`);
  process.exit(1);
}
console.log(`\nAll ${results.length} migration checks passed`);
