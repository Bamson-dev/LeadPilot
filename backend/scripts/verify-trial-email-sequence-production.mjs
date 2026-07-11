#!/usr/bin/env node
/**
 * Production end-to-end test for trial email sequence v2 + post-search trigger.
 * Requires migration 036 applied on production Supabase.
 */
const API = process.env.PRODUCTION_BACKEND_URL?.trim() || "https://backend.leadthur.com";
const SUPABASE_URL = process.env.SUPABASE_URL?.trim();
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY?.trim();
const stamp = Date.now();
const EMAIL = `trial-seq-v2-${stamp}@leadthur-qa.test`;
const QUERY = "accountants";
const LOCATION = "Leeds UK";

const hdrs = { "Content-Type": "application/json" };

async function post(path, body) {
  const res = await fetch(`${API}${path}`, {
    method: "POST",
    headers: hdrs,
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json };
}

async function get(path) {
  const res = await fetch(`${API}${path}`, { headers: hdrs });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchSignup() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) return null;
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/free_trial_signups?email=eq.${encodeURIComponent(EMAIL)}&select=*`,
    {
      headers: {
        apikey: SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      },
    }
  );
  const rows = await res.json();
  return Array.isArray(rows) ? rows[0] : null;
}

async function acceleratePostSearch() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) return false;
  const past = new Date(Date.now() - 60_000).toISOString();
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/free_trial_signups?email=eq.${encodeURIComponent(EMAIL)}`,
    {
      method: "PATCH",
      headers: {
        apikey: SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
        "Content-Type": "application/json",
        Prefer: "return=representation",
      },
      body: JSON.stringify({ post_search_email_scheduled_at: past }),
    }
  );
  return res.ok;
}

async function runPostSearchProcessor() {
  process.env.SUPABASE_URL = process.env.SUPABASE_URL || SUPABASE_URL;
  process.env.SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || SUPABASE_SERVICE_KEY;
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) return false;
  const { processTrialPostSearchEmails } = await import("../dist/services/trial-sequence.js");
  await processTrialPostSearchEmails();
  return true;
}

const health = await get("/health");
const signup = await post("/trial/signup", { email: EMAIL });
const search = await post("/freetrial", { email: EMAIL, query: QUERY, location: LOCATION });
const searchId = search.json.searchId;

let signupRow = null;
let polls = 0;
let lastProgress = null;

if (searchId) {
  for (let i = 0; i < 90; i++) {
    polls += 1;
    await sleep(5000);
    lastProgress = await get(
      `/search/results/${searchId}?limit=15&trialEmail=${encodeURIComponent(EMAIL)}`
    );
    signupRow = await fetchSignup();
    const leads = lastProgress.json.leads?.length ?? 0;
    const ready =
      lastProgress.json.status === "completed" &&
      lastProgress.json.emailScrapingComplete &&
      leads > 0;
    if (ready && signupRow?.post_search_query) break;
  }
}

if (!signupRow) signupRow = await fetchSignup();

const accelerated = signupRow?.post_search_query
  ? await acceleratePostSearch()
  : false;

let tick = null;
if (accelerated) {
  await sleep(2000);
  tick = await runPostSearchProcessor();
  await sleep(3000);
  signupRow = await fetchSignup();
}

const secondSearch = signupRow?.post_search_email_sent_at
  ? null
  : await post("/freetrial", { email: EMAIL, query: "lawyers", location: "Bristol UK" });

if (secondSearch && !signupRow?.post_search_email_sent_at) {
  await sleep(5000);
  signupRow = await fetchSignup();
}

console.log(
  JSON.stringify(
    {
      api: API,
      email: EMAIL,
      healthGitCommit: health.json.gitCommitSha,
      signup,
      search,
      searchId,
      polls,
      query: QUERY,
      location: LOCATION,
      signupRow: signupRow
        ? {
            sequence_version: signupRow.sequence_version,
            sequence_step: signupRow.sequence_step,
            post_search_query: signupRow.post_search_query,
            post_search_location: signupRow.post_search_location,
            post_search_email_scheduled_at: signupRow.post_search_email_scheduled_at,
            post_search_email_sent_at: signupRow.post_search_email_sent_at,
          }
        : null,
      accelerated,
      schedulerTick: tick,
      secondSearchStatus: secondSearch?.status ?? null,
      pass:
        signup.status === 200 &&
        signup.json.existing === false &&
        signupRow?.sequence_version === 2 &&
        signupRow?.sequence_step === 1 &&
        signupRow?.post_search_query === QUERY &&
        signupRow?.post_search_location === LOCATION &&
        Boolean(signupRow?.post_search_email_scheduled_at),
    },
    null,
    2
  )
);

process.exit(
  signup.status === 200 &&
    signupRow?.sequence_version === 2 &&
    signupRow?.post_search_query === QUERY
    ? 0
    : 1
);
