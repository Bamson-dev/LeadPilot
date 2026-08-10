#!/usr/bin/env node
/**
 * One-time helper: apply migration 021 via direct Postgres when REST DDL is unavailable.
 * Requires SUPABASE_DB_PASSWORD (database password from Supabase dashboard), not service role.
 */
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

const url = `postgresql://postgres.${ref}:${encodeURIComponent(password)}@aws-0-${region}.pooler.supabase.com:6543/postgres`;
const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });

await client.connect();
await client.query(`
  alter table search_jobs add column if not exists license_email text;
  create index if not exists idx_search_jobs_license_email
    on search_jobs (license_email)
    where license_email is not null;
`);
console.log("Migration 021 applied on", ref);
await client.end();
