#!/usr/bin/env node
/**
 * Security fix verification harness.
 * Usage: API_URL=http://localhost:3000 node backend/scripts/verify-security-fixes.mjs
 */
import express from "express";
import request from "supertest";

const API_URL = (process.env.API_URL || "http://localhost:3000").replace(/\/$/, "");

function setBaseEnv() {
  process.env.PORT = process.env.PORT || "3000";
  process.env.NODE_ENV = process.env.NODE_ENV || "test";
  process.env.SUPABASE_URL =
    process.env.SUPABASE_URL || "https://wffwhktwessvlubndkmj.supabase.co";
  process.env.SUPABASE_SERVICE_KEY =
    process.env.SUPABASE_SERVICE_KEY || "test-service-role-key-0123456789ab";
  process.env.FRONTEND_URL = process.env.FRONTEND_URL || "https://staging.leadthur.com";
  process.env.ADMIN_EMAIL = process.env.ADMIN_EMAIL || "admin@leadthur.com";
  process.env.ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "test-password-123";
  process.env.JWT_SECRET =
    process.env.JWT_SECRET || "test-jwt-secret-01234567890123456789012";
}

async function testFlutterwaveWebhookLocally() {
  setBaseEnv();
  const results = [];

  async function runCase(label, secretHash, verifHash, expectedStatus) {
    process.env.FLUTTERWAVE_SECRET_HASH = secretHash;
    const { config } = await import("../dist/config/env.js");
    config.FLUTTERWAVE_SECRET_HASH;
    const { webhookRouter } = await import("../dist/api/webhook-router.js");

    const app = express();
    app.use("/webhooks", webhookRouter);

    const res = await request(app)
      .post("/webhooks/flutterwave")
      .set("Content-Type", "application/json")
      .set("verif-hash", verifHash)
      .send({ event: "charge.completed", data: { status: "pending" } });

    const pass = res.status === expectedStatus;
    results.push({ label, pass, expectedStatus, actualStatus: res.status, body: res.body });
    return pass;
  }

  await runCase("unset secret hash rejects", "", "anything", 500);
  await runCase("invalid signature rejects", "expected-hash", "wrong-hash", 401);
  await runCase("valid signature accepts non-success", "expected-hash", "expected-hash", 200);

  return results;
}

async function remoteGet(path, headers = {}) {
  const res = await fetch(`${API_URL}${path}`, { headers, cache: "no-store" });
  const text = await res.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = text;
  }
  return { status: res.status, body };
}

async function remotePost(path, body, headers = {}) {
  const res = await fetch(`${API_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = text;
  }
  return { status: res.status, body: parsed };
}

async function testRemoteSearchIdor() {
  const results = [];
  const licenseA = {
    email: process.env.TEST_LICENSE_EMAIL_A,
    key: process.env.TEST_LICENSE_KEY_A,
  };
  const licenseB = {
    email: process.env.TEST_LICENSE_EMAIL_B,
    key: process.env.TEST_LICENSE_KEY_B,
  };

  if (!licenseA.email || !licenseA.key || !licenseB.email || !licenseB.key) {
    return [
      {
        label: "remote IDOR (skipped)",
        pass: false,
        skipped: true,
        reason: "Set TEST_LICENSE_EMAIL_A/KEY_A and TEST_LICENSE_EMAIL_B/KEY_B",
      },
    ];
  }

  const headersA = {
    "x-license-email": licenseA.email,
    "x-license-key": licenseA.key,
  };
  const headersB = {
    "x-license-email": licenseB.email,
    "x-license-key": licenseB.key,
  };

  const created = await remotePost(
    "/search",
    { query: "security-audit-cafe", location: "lagos, nigeria" },
    headersA
  );
  results.push({
    label: "create search as license A",
    pass: created.status === 201,
    status: created.status,
    body: created.body,
  });
  const searchId = created.body?.searchId;
  if (!searchId) return results;

  const own = await remoteGet(`/search/${searchId}`, headersA);
  results.push({
    label: "owner can read search status",
    pass: own.status === 200,
    status: own.status,
  });

  const other = await remoteGet(`/search/${searchId}`, headersB);
  results.push({
    label: "other license gets 403 on /search/:id",
    pass: other.status === 403,
    status: other.status,
    body: other.body,
  });

  const noAuth = await remoteGet(`/search/${searchId}`);
  results.push({
    label: "no auth gets 401 on paid /search/:id",
    pass: noAuth.status === 401,
    status: noAuth.status,
    body: noAuth.body,
  });

  const historyMissing = await remoteGet("/search/history", {
    "x-license-key": licenseA.key,
  });
  results.push({
    label: "history without email is rejected",
    pass: historyMissing.status === 401,
    status: historyMissing.status,
    body: historyMissing.body,
  });

  const historyOk = await remoteGet("/search/history", headersA);
  results.push({
    label: "history with matching key+email works",
    pass: historyOk.status === 200,
    status: historyOk.status,
  });

  return results;
}

async function testRemoteFlutterwave() {
  const invalid = await remotePost(
    "/webhooks/flutterwave",
    { event: "charge.completed", data: { status: "successful" } },
    { "verif-hash": "definitely-wrong-hash" }
  );
  return [
    {
      label: "remote invalid flutterwave signature",
      pass: invalid.status === 401,
      status: invalid.status,
      body: invalid.body,
    },
  ];
}

async function testRemoteFreeTrial() {
  const created = await remotePost("/freetrial", {
    query: "security-audit-trial",
    location: "abuja, nigeria",
    visitorId: `audit-${Date.now()}`,
  });
  const searchId = created.body?.searchId;
  const stream = searchId
    ? await remoteGet(`/search/${searchId}/stream?licenseEmail=x&licenseKey=y`)
    : { status: 0, body: null };

  return [
    {
      label: "freetrial search creates job",
      pass: created.status === 201,
      status: created.status,
      body: created.body,
    },
    {
      label: "trial stream still reachable without paid license",
      pass: Boolean(searchId) && stream.status === 200,
      status: stream.status,
      searchId,
    },
  ];
}

async function main() {
  console.log("=== Fix 3: local Flutterwave webhook harness ===");
  const fix3 = await testFlutterwaveWebhookLocally();
  for (const row of fix3) {
    console.log(JSON.stringify(row));
  }

  console.log("\n=== Remote API checks against", API_URL, "===");
  const remote = [
    ...(await testRemoteFlutterwave()),
    ...(await testRemoteFreeTrial()),
    ...(await testRemoteSearchIdor()),
  ];
  for (const row of remote) {
    console.log(JSON.stringify(row));
  }

  const fix3Pass = fix3.every((r) => r.pass);
  const remotePass = remote.filter((r) => !r.skipped).every((r) => r.pass);
  const skipped = remote.some((r) => r.skipped);

  if (!fix3Pass || (!remotePass && !skipped)) {
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
