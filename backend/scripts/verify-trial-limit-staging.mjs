#!/usr/bin/env node
/**
 * Live staging verification for shared free trial search limits.
 * Usage: node backend/scripts/verify-trial-limit-staging.mjs
 */
const BASE = process.env.STAGING_BACKEND_URL?.trim() || "https://staging-backend.leadthur.com";
const stamp = Date.now();
const EMAIL = `trial-limit-${stamp}@example.com`;

async function post(path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json };
}

async function get(path) {
  const res = await fetch(`${BASE}${path}`);
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json };
}

const signup = await post("/trial/signup", { email: EMAIL });
const noEmail = await post("/freetrial", {
  query: "cafes",
  location: "Lagos Nigeria",
});

const search1 = await post("/freetrial", {
  email: EMAIL,
  query: "cafes",
  location: "Lagos Nigeria",
});
const status1 = await get(`/trial/status?email=${encodeURIComponent(EMAIL)}`);

const search2 = await post("/freetrial", {
  email: EMAIL,
  query: "salons",
  location: "Abuja Nigeria",
});
const status2 = await get(`/trial/status?email=${encodeURIComponent(EMAIL)}`);

const search3 = await post("/freetrial", {
  email: EMAIL,
  query: "gyms",
  location: "London UK",
});
const status3 = await get(`/trial/status?email=${encodeURIComponent(EMAIL)}`);

const mailbox = await post("/mailboxes/connect", {
  email_address: "trial@example.com",
  app_password: "fake",
});

const report = {
  base: BASE,
  email: EMAIL,
  signup: { status: signup.status, body: signup.json },
  noEmailSearch: { status: noEmail.status, code: noEmail.json.code },
  search1: { status: search1.status, searchesUsed: search1.json.searchesUsed },
  statusAfter1: status1.json,
  search2: { status: search2.status, searchesUsed: search2.json.searchesUsed },
  statusAfter2: status2.json,
  search3: { status: search3.status, code: search3.json.code },
  statusAfter3: status3.json,
  mailboxWithoutLicense: { status: mailbox.status },
  pass:
    signup.status === 200 &&
    noEmail.status === 403 &&
    noEmail.json.code === "TRIAL_GATE_REQUIRED" &&
    search1.status === 201 &&
    search2.status === 201 &&
    search3.status === 429 &&
    search3.json.code === "TRIAL_LIMIT" &&
    status2.json?.searchesUsed === 2 &&
    status3.json?.searchesUsed === 2 &&
    mailbox.status === 401,
};

console.log(JSON.stringify(report, null, 2));
process.exit(report.pass ? 0 : 1);
