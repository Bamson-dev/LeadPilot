#!/usr/bin/env node
/**
 * Apply migration 035 (free_trial_ip_usage) via direct Postgres.
 * Requires SUPABASE_DB_PASSWORD. Defaults to production ref oytbynwogudfqqaxxrjq.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import pg from "pg";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const sqlPath = path.resolve(__dirname, "../../supabase/migrations/035_free_trial_ip_usage.sql");
const sql = fs.readFileSync(sqlPath, "utf8");

const ref = process.env.SUPABASE_PROJECT_REF?.trim() || "oytbynwogudfqqaxxrjq";
const password = process.env.SUPABASE_DB_PASSWORD?.trim();
const region = process.env.SUPABASE_DB_REGION?.trim() || "eu-west-1";

if (!password) {
  console.error(
    "Set SUPABASE_DB_PASSWORD (database password from project settings) to apply migration 035."
  );
  process.exit(1);
}

const url = `postgresql://postgres.${ref}:${encodeURIComponent(password)}@aws-0-${region}.pooler.supabase.com:6543/postgres`;
const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });

await client.connect();
await client.query(sql);
console.log("Migration 035 applied on", ref);
await client.end();
