#!/usr/bin/env node
/**
 * Apply migration 030_outreach_mailboxes.sql via direct Postgres.
 * Requires SUPABASE_PROJECT_REF and SUPABASE_DB_PASSWORD (database password from Supabase dashboard).
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import pg from "pg";

const ref = process.env.SUPABASE_PROJECT_REF?.trim();
const password = process.env.SUPABASE_DB_PASSWORD?.trim();
const region = process.env.SUPABASE_DB_REGION?.trim() || "eu-west-1";

if (!ref || !password) {
  console.error(
    "Set SUPABASE_PROJECT_REF and SUPABASE_DB_PASSWORD (database password from project settings)."
  );
  process.exit(1);
}

const sqlPath = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../supabase/migrations/030_outreach_mailboxes.sql"
);
const sql = readFileSync(sqlPath, "utf8");

const url = `postgresql://postgres.${ref}:${encodeURIComponent(password)}@aws-0-${region}.pooler.supabase.com:6543/postgres`;
const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });

await client.connect();
await client.query(sql);
console.log("Migration 030_outreach_mailboxes applied on", ref);
await client.end();
