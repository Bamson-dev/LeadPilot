#!/usr/bin/env node
/**
 * Outreach AI email generation verification — run after backend build:
 *   node backend/scripts/verify-outreach-generate-email.mjs
 */
import express from "express";
import http from "http";
import { createRequire } from "node:module";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  registerMailboxMocks,
  resetMailboxMocks,
  seedLicense,
  seedUser,
} from "./verify-mailbox-mocks.mjs";
import {
  buildOutreachEmailPrompt,
  ensureBusinessNameToken,
  parseOutreachEmailJson,
  outreachEmailHasStructure,
} from "../dist/services/outreach-email-service.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadEnvFiles() {
  for (const path of [join(__dirname, ".env.staging"), join(__dirname, "../.env.staging")]) {
    if (!existsSync(path)) continue;
    for (const line of readFileSync(path, "utf8").split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq <= 0) continue;
      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (!process.env[key]) process.env[key] = value;
    }
  }
}

loadEnvFiles();

process.env.NODE_ENV = "test";
process.env.SUPABASE_URL = process.env.SUPABASE_URL || "https://mock.supabase.co";
process.env.SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || "mock-service-key";
process.env.JWT_SECRET = process.env.JWT_SECRET || "test-jwt-secret-01234567890123456789012";
process.env.OUTREACH_GENERATE_RATE_MAX = "3";
process.env.OUTREACH_GENERATE_RATE_WINDOW_MS = "60000";
delete process.env.REDIS_URL;

const results = [];
let sampleGeneration = null;

function pass(label, detail = "") {
  results.push({ label, status: "PASS", detail });
  console.log(`PASS: ${label}${detail ? ` — ${detail}` : ""}`);
}

function fail(label, detail = "") {
  results.push({ label, status: "FAIL", detail });
  console.error(`FAIL: ${label}${detail ? ` — ${detail}` : ""}`);
}

function skip(label, reason) {
  results.push({ label, status: "SKIP", detail: reason });
  console.log(`SKIP: ${label} — ${reason}`);
}

function clearModuleCache() {
  const require = createRequire(import.meta.url);
  for (const key of Object.keys(require.cache)) {
    if (
      key.includes("/dist/") ||
      key.includes("outreach") ||
      key.includes("deepseek") ||
      key.includes("require-license")
    ) {
      delete require.cache[key];
    }
  }
}

function authHeaders(email, key) {
  return {
    "Content-Type": "application/json",
    "x-license-key": key,
    "x-license-email": email,
  };
}

const MOCK_EMAIL_JSON = {
  subject: "Quick idea for [Business Name]",
  body:
    "Hi [Business Name],\n\nI noticed many local restaurants still rely on walk-ins alone. That often means quiet weekdays and missed bookings.\n\nI build simple websites that turn Google searches into table requests.\n\nMost owners see more inquiries within a few weeks.\n\nOpen to a quick reply if you want examples?",
};

async function installDeepSeekMock() {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    const href = typeof url === "string" ? url : url.toString();
    if (href.includes("api.deepseek.com")) {
      const body = JSON.parse(String(init?.body ?? "{}"));
      const prompt = body.messages?.[0]?.content ?? "";
      if (!prompt.includes("[Business Name]")) {
        return new Response(JSON.stringify({ error: "bad prompt" }), { status: 400 });
      }
      return new Response(
        JSON.stringify({
          choices: [{ message: { content: JSON.stringify(MOCK_EMAIL_JSON) } }],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }
    return originalFetch(url, init);
  };
  return () => {
    globalThis.fetch = originalFetch;
  };
}

async function startApp() {
  const { outreachGenerateRouter } = await import("../dist/routes/outreach-generate.js");
  const app = express();
  app.use(express.json());
  app.use("/outreach", outreachGenerateRouter);
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  return { server, base: `http://127.0.0.1:${server.address().port}` };
}

async function runTests() {
  const prompt = buildOutreachEmailPrompt({
    service_description: "I build websites for restaurants",
    target_business_type: "restaurants",
    tone: "direct",
  });
  if (prompt.includes("Hook") && prompt.includes("[Business Name]")) {
    pass("Prompt includes structure + merge token");
  } else {
    fail("Prompt includes structure + merge token");
  }

  const parsed = parseOutreachEmailJson(JSON.stringify(MOCK_EMAIL_JSON));
  if (parsed?.subject && parsed?.body) pass("JSON parser", parsed.subject);
  else fail("JSON parser");

  const ensured = ensureBusinessNameToken("Hello there,\n\nWe can help.");
  if (/\[Business Name\]/i.test(ensured)) pass("ensureBusinessNameToken");
  else fail("ensureBusinessNameToken", ensured);

  if (outreachEmailHasStructure(MOCK_EMAIL_JSON.body)) {
    pass("Generated body has outreach structure markers");
  } else {
    fail("Generated body has outreach structure markers");
  }

  resetMailboxMocks();
  clearModuleCache();
  await registerMailboxMocks({ mockSmtpVerify: true });
  process.env.DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || "test-deepseek-key";
  const restoreFetch = await installDeepSeekMock();

  const stamp = Date.now();
  const email = `ai-email-${stamp}@test.local`;
  const key = `LP-AI-${stamp}`;
  seedUser(email);
  seedLicense(email, key);

  const { server, base } = await startApp();
  const headers = authHeaders(email, key);

  const anon = await fetch(`${base}/outreach/generate-email`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      service_description: "Web design",
      target_business_type: "restaurants",
    }),
  });
  if (anon.status === 401) pass("POST requires auth");
  else fail("POST requires auth", String(anon.status));

  const missing = await fetch(`${base}/outreach/generate-email`, {
    method: "POST",
    headers,
    body: JSON.stringify({ target_business_type: "restaurants" }),
  });
  if (missing.status === 400) pass("service_description required");
  else fail("service_description required", String(missing.status));

  const okRes = await fetch(`${base}/outreach/generate-email`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      service_description: "I build fast websites for local restaurants",
      target_business_type: "restaurants",
      tone: "friendly",
    }),
  });
  const okJson = await okRes.json();
  if (
    okRes.status === 200 &&
    typeof okJson.subject === "string" &&
    typeof okJson.body === "string" &&
    /\[Business Name\]/i.test(okJson.body)
  ) {
    sampleGeneration = okJson;
    pass(
      "POST returns subject + body with merge token",
      `subject="${okJson.subject.slice(0, 48)}"`
    );
  } else {
    fail("POST returns subject + body with merge token", JSON.stringify(okJson));
  }

  let rateLimited = false;
  for (let i = 0; i < 4; i++) {
    const res = await fetch(`${base}/outreach/generate-email`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        service_description: "SEO audits",
        target_business_type: "salons",
      }),
    });
    if (res.status === 429) {
      rateLimited = true;
      break;
    }
  }
  if (rateLimited) pass("Per-user generation rate limit");
  else fail("Per-user generation rate limit");

  restoreFetch();
  server.close();

  const liveKey = process.env.DEEPSEEK_API_KEY?.trim();
  const isTestKey =
    !liveKey ||
    liveKey === "test-deepseek-key" ||
    liveKey.startsWith("mock") ||
    liveKey.length < 20;

  if (isTestKey) {
    skip("Live DeepSeek generation", "no real DEEPSEEK_API_KEY in environment");
    return;
  }

  clearModuleCache();
  const { generateOutreachEmail } = await import("../dist/services/outreach-email-service.js");
  const live = await generateOutreachEmail({
    service_description: "I help gyms get more members with better Instagram content",
    target_business_type: "gyms",
    tone: "consultative",
  });
  if (live.ok && /\[Business Name\]/i.test(live.body)) {
    sampleGeneration = { subject: live.subject, body: live.body };
    pass("Live DeepSeek generation", `subject="${live.subject.slice(0, 50)}"`);
  } else {
    fail("Live DeepSeek generation", JSON.stringify(live));
  }
}

await runTests();

console.log("\n=== Summary ===");
for (const r of results) {
  console.log(`${r.status}: ${r.label}${r.detail ? ` — ${r.detail}` : ""}`);
}
if (sampleGeneration) {
  console.log("\n=== Sample generation ===");
  console.log(`Subject: ${sampleGeneration.subject}`);
  console.log(`Body:\n${sampleGeneration.body}`);
}
process.exit(results.some((r) => r.status === "FAIL") ? 1 : 0);
