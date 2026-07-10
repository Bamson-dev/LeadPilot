#!/usr/bin/env node
/**
 * Apply migration 034 (claim_trial_search RPC) via direct Postgres.
 * Requires SUPABASE_PROJECT_REF and SUPABASE_DB_PASSWORD.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import pg from "pg";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const sqlPath = path.resolve(__dirname, "../../supabase/migrations/034_claim_trial_search.sql");
const sql = fs.readFileSync(sqlPath, "utf8");

const ref = process.env.SUPABASE_PROJECT_REF?.trim() || "wffwhktwessvlubndkmj";
const password = process.env.SUPABASE_DB_PASSWORD?.trim();
const region = process.env.SUPABASE_DB_REGION?.trim() || "eu-west-1";

if (!password) {
  console.error(
    "Set SUPABASE_DB_PASSWORD (database password from project settings) to apply migration 034."
  );
  process.exit(1);
}

const url = `postgresql://postgres.${ref}:${encodeURIComponent(password)}@aws-0-${region}.pooler.supabase.com:6543/postgres`;
const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });

await client.connect();
await client.query(sql);
console.log("Migration 034 applied on", ref);
await client.end();
