#!/usr/bin/env node
/**
 * One-time backfill: populate search_jobs.license_email from user_searches / search_history.
 *
 * Usage:
 *   SUPABASE_URL=... SUPABASE_SERVICE_KEY=... node backend/scripts/backfill-license-email.mjs
 *   SUPABASE_URL=... SUPABASE_SERVICE_KEY=... node backend/scripts/backfill-license-email.mjs --apply
 *
 * Without --apply, runs in dry-run mode (no updates).
 */

import { createClient } from "@supabase/supabase-js";

const APPLY = process.argv.includes("--apply");
const EMIT_SQL = process.argv.includes("--emit-sql");
const ALLOW_MISSING_COLUMN =
  process.argv.includes("--allow-missing-column") && !APPLY;
const TARGET =
  process.argv.find((arg) => arg.startsWith("--target="))?.split("=")[1] ?? "unknown";
const TIME_WINDOW_MS = 5_000;

const url = process.env.SUPABASE_URL?.trim();
const serviceKey = process.env.SUPABASE_SERVICE_KEY?.trim();

if (!url || !serviceKey) {
  console.error(
    "Missing SUPABASE_URL or SUPABASE_SERVICE_KEY. Export both before running."
  );
  process.exit(1);
}

const supabase = createClient(url, serviceKey, {
  auth: { persistSession: false },
});

function normalizeText(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

function parseTime(value) {
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : null;
}

async function fetchAllRows(table, select, pageSize = 1000) {
  const rows = [];
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from(table)
      .select(select)
      .range(from, from + pageSize - 1);

    if (error) throw new Error(`${table} fetch failed: ${error.message}`);
    if (!data?.length) break;
    rows.push(...data);
    if (data.length < pageSize) break;
    from += pageSize;
  }

  return rows;
}

async function ensureLicenseEmailColumn() {
  const { error } = await supabase
    .from("search_jobs")
    .select("license_email")
    .limit(1);

  if (error?.message?.includes("license_email")) {
    if (ALLOW_MISSING_COLUMN) {
      console.warn(
        "license_email column missing; continuing dry-run (--allow-missing-column). Apply migration 021 before --apply."
      );
      return { hasColumn: false };
    }
    throw new Error(
      "search_jobs.license_email column is missing. Apply migration 021_search_jobs_license_email.sql first."
    );
  }
  if (error) throw new Error(`search_jobs probe failed: ${error.message}`);
  return { hasColumn: true };
}

async function loadLicenseEmailByKey() {
  const { data, error } = await supabase
    .from("license_keys")
    .select("key, email");

  if (error) throw new Error(`license_keys fetch failed: ${error.message}`);

  const map = new Map();
  for (const row of data ?? []) {
    const key = String(row.key ?? "").trim().toUpperCase();
    const email = String(row.email ?? "").trim().toLowerCase();
    if (key && email) map.set(key, email);
  }
  return map;
}

function matchViaUserSearches(job, userSearchRows, emailByKey) {
  const rows = userSearchRows.filter((row) => row.search_id === job.id);
  if (rows.length === 0) return { kind: "none" };

  const keys = [...new Set(rows.map((row) => String(row.license_key ?? "").trim().toUpperCase()))];
  if (keys.length > 1) {
    return { kind: "ambiguous", reason: "multiple license keys for same search_id in user_searches" };
  }

  const email = emailByKey.get(keys[0]);
  if (!email) {
    return { kind: "none", reason: "user_searches license_key not found in license_keys" };
  }

  return { kind: "matched", method: "user_searches.search_id", email, licenseKey: keys[0] };
}

function matchViaSearchHistory(job, historyRows) {
  const jobQuery = normalizeText(job.query);
  const jobLocation = normalizeText(job.location);
  const jobCreated = parseTime(job.created_at);
  if (!jobQuery || !jobLocation || jobCreated === null) {
    return { kind: "none", reason: "missing query/location/created_at on search_jobs row" };
  }

  const candidates = historyRows.filter((row) => {
    if (normalizeText(row.business_type) !== jobQuery) return false;
    if (normalizeText(row.city) !== jobLocation) return false;
    const rowCreated = parseTime(row.created_at);
    if (rowCreated === null) return false;
    return Math.abs(rowCreated - jobCreated) <= TIME_WINDOW_MS;
  });

  if (candidates.length === 0) return { kind: "none" };

  const emails = [...new Set(candidates.map((row) => normalizeText(row.email)).filter(Boolean))];
  if (emails.length === 1) {
    return {
      kind: "matched",
      method: "search_history fuzzy (business_type+city+time)",
      email: emails[0],
    };
  }

  return {
    kind: "ambiguous",
    reason: `search_history found ${candidates.length} rows / ${emails.length} distinct emails in ±${TIME_WINDOW_MS}ms window`,
  };
}

function sqlEscape(value) {
  return String(value).replace(/'/g, "''");
}

async function main() {
  console.log(`Target: ${TARGET}`);
  console.log(`Mode: ${APPLY ? "APPLY (will update rows)" : EMIT_SQL ? "EMIT SQL" : "DRY RUN (no updates)"}`);
  console.log(`Supabase: ${url}`);

  let columnState = { hasColumn: true };
  if (!EMIT_SQL) {
    columnState = await ensureLicenseEmailColumn();
  }

  const jobSelect =
    columnState.hasColumn === false || EMIT_SQL
      ? "id, query, location, created_at, is_trial, status"
      : "id, query, location, created_at, is_trial, license_email, status";

  const [jobs, userSearches, searchHistory, emailByKey] = await Promise.all([
    fetchAllRows("search_jobs", jobSelect),
    fetchAllRows("user_searches", "id, search_id, license_key, query, location, created_at"),
    fetchAllRows(
      "search_history",
      "id, email, business_type, city, created_at, results_count"
    ),
    loadLicenseEmailByKey(),
  ]);

  const targets =
    columnState.hasColumn === false || EMIT_SQL
      ? jobs.filter((job) => !job.is_trial)
      : jobs.filter((job) => !job.license_email && !job.is_trial);

  const summary = {
    totalJobs: jobs.length,
    targets: targets.length,
    matched: 0,
    updated: 0,
    ambiguous: 0,
    unmatched: 0,
    skippedTrial: jobs.filter((job) => job.is_trial).length,
    alreadySet: EMIT_SQL ? 0 : jobs.filter((job) => job.license_email).length,
  };

  const unmatched = [];
  const ambiguous = [];
  const matchedSamples = [];
  const matchedAll = [];
  const sqlStatements = [];

  for (const job of targets) {
    const direct = matchViaUserSearches(job, userSearches, emailByKey);
    let result = direct;

    if (direct.kind === "none") {
      result = matchViaSearchHistory(job, searchHistory);
    }

    if (result.kind === "matched") {
      summary.matched += 1;
      const matchRecord = {
        searchJobId: job.id,
        query: job.query,
        location: job.location,
        created_at: job.created_at,
        email: result.email,
        method: result.method,
        licenseKey: result.licenseKey ?? null,
      };
      matchedAll.push(matchRecord);
      if (matchedSamples.length < 10) {
        matchedSamples.push(matchRecord);
      }
      sqlStatements.push(
        `update search_jobs set license_email = '${sqlEscape(result.email)}' where id = '${sqlEscape(job.id)}' and license_email is null;`
      );

      if (APPLY) {
        const { error } = await supabase
          .from("search_jobs")
          .update({ license_email: result.email })
          .eq("id", job.id)
          .is("license_email", null);

        if (error) {
          console.error(`Update failed for ${job.id}: ${error.message}`);
        } else {
          summary.updated += 1;
        }
      }
      continue;
    }

    if (result.kind === "ambiguous") {
      summary.ambiguous += 1;
      ambiguous.push({
        searchJobId: job.id,
        business_type: job.query,
        city: job.location,
        created_at: job.created_at,
        reason: result.reason,
      });
      continue;
    }

    summary.unmatched += 1;
    unmatched.push({
      searchJobId: job.id,
      business_type: job.query,
      city: job.location,
      created_at: job.created_at,
      reason: result.reason ?? "no matching user_searches or search_history row",
    });
  }

  console.log("\n=== SUMMARY ===");
  console.log(JSON.stringify(summary, null, 2));

  if (matchedSamples.length > 0) {
    console.log("\n=== SAMPLE MATCHES (for manual sanity check) ===");
    console.log(JSON.stringify(matchedSamples, null, 2));
  }

  if (ambiguous.length > 0) {
    console.log("\n=== AMBIGUOUS ===");
    console.log(JSON.stringify(ambiguous, null, 2));
  }

  if (unmatched.length > 0) {
    console.log("\n=== UNMATCHED ===");
    console.log(JSON.stringify(unmatched, null, 2));
  }

  if (EMIT_SQL) {
    const header = [
      "-- One-time backfill SQL",
      `-- target: ${TARGET}`,
      "alter table search_jobs add column if not exists license_email text;",
      "create index if not exists idx_search_jobs_license_email on search_jobs (license_email) where license_email is not null;",
      "",
    ];
    console.log("\n=== SQL ===");
    console.log([...header, ...sqlStatements].join("\n"));
  }

  return { summary, matchedAll, unmatched, ambiguous };
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
