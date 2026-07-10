#!/usr/bin/env node
import express from "express";
import http from "http";
import { registerCjsMocks, seedSearchJob } from "./register-cjs-mocks.mjs";

process.env.NODE_ENV = "test";
process.env.SUPABASE_URL = "https://wffwhktwessvlubndkmj.supabase.co";
process.env.SUPABASE_SERVICE_KEY = "test-service-role-key-0123456789ab";
process.env.FRONTEND_URL = "https://staging.leadthur.com";
process.env.ADMIN_EMAIL = "admin@leadthur.com";
process.env.ADMIN_PASSWORD = "test-password-123";
process.env.JWT_SECRET = "test-jwt-secret-01234567890123456789012";

globalThis.__mockLicenses = new Map([
  [
    "owner@example.com|LP-OWNER-KEY-0001",
    {
      id: "lic-owner",
      email: "owner@example.com",
      key: "LP-OWNER-KEY-0001",
      activated: true,
      is_suspended: false,
    },
  ],
  [
    "other@example.com|LP-OTHER-KEY-0002",
    {
      id: "lic-other",
      email: "other@example.com",
      key: "LP-OTHER-KEY-0002",
      activated: true,
      is_suspended: false,
    },
  ],
]);

await registerCjsMocks();

seedSearchJob("paid-search-1", { licenseEmail: "owner@example.com", isTrial: false });
seedSearchJob("trial-search-1", {
  licenseEmail: "trial@example.com",
  isTrial: true,
});

const { searchRouter } = await import("../dist/api/search-router.js");

const app = express();
app.use(express.json());
app.use("/search", searchRouter);

const server = http.createServer(app);
await new Promise((resolve) => server.listen(0, resolve));
const base = `http://127.0.0.1:${server.address().port}`;

async function check(label, path, headers = {}, expected, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? 10000);
  try {
    const res = await fetch(`${base}${path}`, { headers, signal: controller.signal });
    const body = options.expectStream
      ? await res.text()
      : await res.json().catch(() => ({}));
    const pass = res.status === expected;
    console.log(
      JSON.stringify({
        label,
        pass,
        expected,
        status: res.status,
        body: options.expectStream ? body.slice(0, 80) : body,
      })
    );
    return pass;
  } catch (err) {
    const pass = options.allowAbort && expected === 200;
    console.log(JSON.stringify({ label, pass, expected, error: String(err) }));
    return pass;
  } finally {
    clearTimeout(timer);
  }
}

const ownerHeaders = {
  "x-license-email": "owner@example.com",
  "x-license-key": "LP-OWNER-KEY-0001",
};
const otherHeaders = {
  "x-license-email": "other@example.com",
  "x-license-key": "LP-OTHER-KEY-0002",
};

let allPass = true;
allPass = (await check("paid owner can read /:id", "/search/paid-search-1", ownerHeaders, 200)) && allPass;
allPass =
  (await check("other license blocked on /:id", "/search/paid-search-1", otherHeaders, 403)) && allPass;
allPass = (await check("no auth blocked on paid /:id", "/search/paid-search-1", {}, 401)) && allPass;
allPass =
  (await check("owner can read /:id/results", "/search/paid-search-1/results", ownerHeaders, 200)) &&
  allPass;
allPass =
  (await check("other license blocked on /:id/results", "/search/paid-search-1/results", otherHeaders, 403)) &&
  allPass;
allPass =
  (await check("trial stream allowed without license", "/search/trial-search-1/stream?trialEmail=trial@example.com", {}, 200, {
    expectStream: true,
    allowAbort: true,
    timeoutMs: 800,
  })) && allPass;
allPass =
  (await check("history requires email", "/search/history", { "x-license-key": "LP-OWNER-KEY-0001" }, 401)) &&
  allPass;
allPass = (await check("history works with key+email", "/search/history", ownerHeaders, 200)) && allPass;

server.close();
process.exit(allPass ? 0 : 1);
