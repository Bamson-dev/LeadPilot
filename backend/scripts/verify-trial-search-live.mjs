#!/usr/bin/env node
/**
 * Live staging trial search: signup, one search, poll until leads or timeout.
 * Usage: node backend/scripts/verify-trial-search-live.mjs
 */
const BASE = process.env.STAGING_BACKEND_URL?.trim() || "https://staging-backend.leadthur.com";
const IP = process.env.TRIAL_TEST_IP?.trim() || "162.120.188.117";
const stamp = Date.now();
const EMAIL = `trial-live-${stamp}@example.com`;

const hdrs = (extra = {}) => ({
  "Content-Type": "application/json",
  "X-Forwarded-For": IP,
  ...extra,
});

async function post(path, body) {
  const started = Date.now();
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: hdrs(),
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json, ms: Date.now() - started };
}

async function get(path) {
  const res = await fetch(`${BASE}${path}`, { headers: hdrs() });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const health = await get("/health");
const signup = await post("/trial/signup", { email: EMAIL });
const searchStart = Date.now();
const search1 = await post("/freetrial", {
  email: EMAIL,
  query: "restaurants",
  location: "Lagos Nigeria",
});

const searchId = search1.json.searchId;
let last = null;
let polls = 0;
const maxPolls = 72;

if (searchId) {
  for (let i = 0; i < maxPolls; i++) {
    polls += 1;
    await sleep(5000);
    last = await get(
      `/search/results/${searchId}?limit=15&trialEmail=${encodeURIComponent(EMAIL)}`
    );
    const leads = last.json.leads ?? [];
    const verified = leads.filter((l) => (l.verifiedEmails?.length ?? 0) > 0).length;
    const done =
      last.json.status === "completed" &&
      (leads.length > 0 || last.json.totalFound > 0);
    const failed = last.json.status === "failed";
    if (done || failed) break;
    if (leads.length >= 5 && last.json.emailScrapingComplete) break;
  }
}

const elapsedSec = ((Date.now() - searchStart) / 1000).toFixed(1);
const leads = last?.json?.leads ?? [];
const verified = leads.filter((l) => (l.verifiedEmails?.length ?? 0) > 0).length;

console.log(
  JSON.stringify(
    {
      base: BASE,
      testIp: IP,
      email: EMAIL,
      health: health.json,
      signup,
      search1,
      searchId,
      polls,
      elapsedSec: Number(elapsedSec),
      finalStatus: last?.json?.status,
      totalFound: last?.json?.totalFound ?? last?.json?.total,
      visibleLeads: leads.length,
      verifiedInVisible: verified,
      emailScrapingComplete: last?.json?.emailScrapingComplete,
      pass: search1.status === 201 && leads.length > 0,
    },
    null,
    2
  )
);

process.exit(search1.status === 201 && leads.length > 0 ? 0 : 1);
