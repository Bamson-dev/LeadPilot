#!/usr/bin/env node
/**
 * Production IP cap verification for free trial.
 * Usage: node backend/scripts/verify-trial-ip-cap-production.mjs
 */
const BASE = process.env.PRODUCTION_BACKEND_URL?.trim() || "https://backend.leadthur.com";
const ALLOWLIST_IP = process.env.TRIAL_TEST_IP?.trim() || "162.120.188.117";
const stamp = Date.now();

const hdrs = (extra = {}) => ({
  "Content-Type": "application/json",
  ...extra,
});

async function post(path, body, extraHeaders = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: hdrs(extraHeaders),
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json };
}

async function signupAndSearch(label, email, query, location, extraHeaders = {}) {
  const signup = await post("/trial/signup", { email }, extraHeaders);
  const search = await post(
    "/freetrial",
    { email, query, location },
    extraHeaders
  );
  return { label, email, signup, search };
}

const email1 = `ipcap-a-${stamp}@example.com`;
const email2 = `ipcap-b-${stamp}@example.com`;
const email3 = `ipcap-c-${stamp}@example.com`;
const email4 = `ipcap-d-${stamp}@example.com`;

const step1 = await signupAndSearch("search-1", email1, "cafes", "London UK");
const step2 = await signupAndSearch("search-2", email2, "cafes", "Paris France");
const step3 = await signupAndSearch("search-3-ip-block", email3, "cafes", "Berlin Germany");

const allowlisted = await signupAndSearch(
  "allowlist-bypass",
  email4,
  "cafes",
  "Lagos Nigeria",
  { "X-Real-IP": ALLOWLIST_IP, "True-Client-IP": ALLOWLIST_IP }
);

const emailLimitEmail = `ipcap-email-${stamp}@example.com`;
await post("/trial/signup", { email: emailLimitEmail });
const emailSearch1 = await post("/freetrial", {
  email: emailLimitEmail,
  query: "dentists",
  location: "Abuja Nigeria",
});
const emailSearch2 = await post("/freetrial", {
  email: emailLimitEmail,
  query: "dentists",
  location: "Lagos Nigeria",
});
const emailSearch3 = await post("/freetrial", {
  email: emailLimitEmail,
  query: "dentists",
  location: "Accra Ghana",
});

const report = {
  base: BASE,
  allowlistIp: ALLOWLIST_IP,
  step1: { status: step1.search.status, code: step1.search.json.code, searchId: step1.search.json.searchId },
  step2: { status: step2.search.status, code: step2.search.json.code, searchId: step2.search.json.searchId },
  step3: {
    status: step3.search.status,
    code: step3.search.json.code,
    error: step3.search.json.error,
  },
  allowlisted: {
    status: allowlisted.search.status,
    code: allowlisted.search.json.code,
    searchId: allowlisted.search.json.searchId,
  },
  perEmailCap: {
    search1: { status: emailSearch1.status, code: emailSearch1.json.code },
    search2: { status: emailSearch2.status, code: emailSearch2.json.code },
    search3: {
      status: emailSearch3.status,
      code: emailSearch3.json.code,
      error: emailSearch3.json.error,
    },
  },
  pass:
    step1.search.status === 201 &&
    step2.search.status === 201 &&
    step3.search.status === 429 &&
    step3.search.json.code === "TRIAL_IP_LIMIT" &&
    emailSearch1.status === 201 &&
    emailSearch2.status === 201 &&
    emailSearch3.status === 429 &&
    emailSearch3.json.code === "TRIAL_LIMIT",
};

console.log(JSON.stringify(report, null, 2));
process.exit(report.pass ? 0 : 1);
