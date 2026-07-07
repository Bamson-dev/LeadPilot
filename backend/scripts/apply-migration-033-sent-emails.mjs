#!/usr/bin/env node
/**
 * Apply the sent_emails ALTER portion of migration 033 when follow-up tables already exist.
 * Requires SUPABASE_PROJECT_REF and SUPABASE_DB_PASSWORD (database password from Supabase dashboard).
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

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

const ref =
  process.env.SUPABASE_PROJECT_REF?.trim() ||
  process.env.SUPABASE_URL?.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1];
const password = process.env.SUPABASE_DB_PASSWORD?.trim();
const region = process.env.SUPABASE_DB_REGION?.trim() || "eu-west-1";

if (!ref || !password) {
  console.error(
    "Set SUPABASE_DB_PASSWORD and optionally SUPABASE_PROJECT_REF (or SUPABASE_URL) in env."
  );
  process.exit(1);
}

const sql = `
alter table sent_emails
  add column if not exists followup_batch_id uuid references outreach_followup_batches(id) on delete set null,
  add column if not exists root_sent_email_id uuid references sent_emails(id) on delete set null,
  add column if not exists send_kind text not null default 'initial'
    check (send_kind in ('initial', 'followup')),
  add column if not exists followup_step_number integer,
  add column if not exists followup_due_at timestamptz,
  add column if not exists followup_stopped_at timestamptz,
  add column if not exists followup_stop_reason text
    check (followup_stop_reason is null or followup_stop_reason in ('replied', 'bounced', 'unsubscribed', 'suppressed', 'paused', 'cancelled', 'completed')),
  add column if not exists replied_at timestamptz;

create index if not exists idx_sent_emails_followup_batch
  on sent_emails (followup_batch_id);

create index if not exists idx_sent_emails_root_step
  on sent_emails (root_sent_email_id, followup_step_number);
`;

const url = `postgresql://postgres.${ref}:${encodeURIComponent(password)}@aws-0-${region}.pooler.supabase.com:6543/postgres`;
const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });

await client.connect();
await client.query(sql);
console.log("Migration 033 sent_emails columns applied on", ref);
await client.end();
