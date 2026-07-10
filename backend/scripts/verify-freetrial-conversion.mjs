#!/usr/bin/env node
/**
 * Verifies free trial conversion page behaviors against a local test server.
 * Usage: node backend/scripts/verify-freetrial-conversion.mjs
 */
import express from "express";
import http from "http";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { registerCjsMocks } from "./register-cjs-mocks.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");

process.env.NODE_ENV = "test";
process.env.SUPABASE_URL = "https://example.supabase.co";
process.env.SUPABASE_SERVICE_KEY = "test-service-role-key-0123456789ab";
process.env.FRONTEND_URL = "https://staging.leadthur.com";
process.env.ADMIN_EMAIL = "admin@leadthur.com";
process.env.ADMIN_PASSWORD = "test-password-123";
process.env.JWT_SECRET = "test-jwt-secret-01234567890123456789012";

const trialSignups = new Map();

function buildTrialSupabase() {
  return {
    from(table) {
      const state = { filters: {} };
      const api = {
        select() {
          return api;
        },
        eq(col, val) {
          state.filters[col] = val;
          return api;
        },
        order() {
          return api;
        },
        lt() {
          return Promise.resolve({ data: [], error: null });
        },
        maybeSingle: async () => {
          if (table === "free_trial_signups") {
            return { data: trialSignups.get(state.filters.email) ?? null, error: null };
          }
          if (table === "trial_email_opens") {
            return { data: null, error: null };
          }
          return { data: null, error: null };
        },
        insert(row) {
          return {
            select() {
              return {
                single: async () => {
                  if (table === "free_trial_signups") {
                    const record = {
                      id: `trial-${trialSignups.size + 1}`,
                      email: row.email,
                      signed_up_at: new Date().toISOString(),
                      searches_used: 0,
                      converted: false,
                      converted_at: null,
                      sequence_step: 0,
                      sequence_paused: false,
                      last_email_sent_at: null,
                      created_at: new Date().toISOString(),
                    };
                    trialSignups.set(row.email, record);
                    return { data: record, error: null };
                  }
                  return { data: null, error: null };
                },
              };
            },
          };
        },
        update(patch) {
          const updateState = { filters: {} };
          const chain = {
            eq(col, val) {
              updateState.filters[col] = val;
              return chain;
            },
            select() {
              return {
                maybeSingle: async () => {
                  if (table !== "free_trial_signups") {
                    return { data: null, error: null };
                  }
                  const email = String(updateState.filters.email ?? "");
                  const row = trialSignups.get(email);
                  if (!row) return { data: null, error: null };
                  if (
                    updateState.filters.searches_used != null &&
                    row.searches_used !== updateState.filters.searches_used
                  ) {
                    return { data: null, error: null };
                  }
                  const next = { ...row, ...patch };
                  trialSignups.set(email, next);
                  return { data: next, error: null };
                },
              };
            },
          };
          return chain;
        },
      };
      return api;
    },
  };
}

globalThis.__mockSupabase = buildTrialSupabase();

await registerCjsMocks();

const Module = await import("node:module");
const originalLoad = Module.default._load;
const emailSendLog = [];
const emailLoad = Module.default._load;
Module.default._load = function (request, parent, isMain) {
  if (request.includes("/services/email")) {
    const actual = emailLoad(request, parent, isMain);
    return {
      ...actual,
      sendTrialEmail: async (email, step) => {
        emailSendLog.push({ email, step });
      },
    };
  }
  if (request.includes("database/client")) {
    return { supabase: globalThis.__mockSupabase };
  }
  if (request.includes("database/search-repository")) {
    let seq = 0;
    return {
      createSearchJob: async (query, location) => ({
        id: `trial-job-${++seq}`,
        query,
        location,
        status: "pending",
        totalFound: 0,
        processed: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        error: null,
        isTrial: true,
      }),
      getSearchJob: async () => null,
      getSearchJobAccess: async () => null,
      getSearchResults: async () => ({ leads: [], total: 0 }),
      markSearchComplete: async () => {},
      markSearchFailed: async () => {},
      countSearchLeads: async () => 0,
      getAllSearchLeads: async () => [],
    };
  }
  if (request.includes("queue/search-queue")) {
    return {
      enqueueSearchJob: async () => {},
      resolveQueuePosition: async () => 0,
      refreshSearchQueueStatus: async () => ({ queued: 0 }),
    };
  }
  return originalLoad(request, parent, isMain);
};

const { trialRouter } = await import("../dist/api/trial-router.js");
const { handleFreeTrialSearch } = await import("../dist/api/search-router.js");
const { mailboxesRouter } = await import("../dist/routes/mailboxes.js");
const { sendRouter } = await import("../dist/routes/send.js");

const app = express();
app.use(express.json());
app.use("/trial", trialRouter);
app.post("/freetrial", handleFreeTrialSearch);
app.use("/mailboxes", mailboxesRouter);
app.use("/send", sendRouter);

const server = http.createServer(app);
await new Promise((resolve) => server.listen(0, resolve));
const base = `http://127.0.0.1:${server.address().port}`;

const results = [];

function record(name, pass, detail) {
  results.push({ name, pass, detail });
  console.log(JSON.stringify({ name, pass, detail }));
}

async function post(path, body, headers = {}) {
  const res = await fetch(`${base}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  return { res, json };
}

const testEmail = `freetrial-verify-${Date.now()}@example.com`;

const signup = await post("/trial/signup", { email: testEmail });
record(
  "email stored in free_trial_signups before search",
  signup.res.status === 200 && trialSignups.has(testEmail),
  `status=${signup.res.status}, stored=${trialSignups.has(testEmail)}`
);

record(
  "trial signup triggers email 1",
  emailSendLog.some((e) => e.email === testEmail && e.step === 1),
  JSON.stringify(emailSendLog.filter((e) => e.email === testEmail))
);

const noEmail = await post("/freetrial", {
  query: "restaurants",
  location: "Lagos Nigeria",
});
record(
  "search without trial email rejected",
  noEmail.res.status === 403 && noEmail.json.code === "TRIAL_GATE_REQUIRED",
  `status=${noEmail.res.status}, code=${noEmail.json.code}`
);

const search1 = await post("/freetrial", {
  email: testEmail,
  query: "restaurants",
  location: "Lagos Nigeria",
});
const search2 = await post("/freetrial", {
  email: testEmail,
  query: "dentists",
  location: "Abuja Nigeria",
});
const search3 = await post("/freetrial", {
  email: testEmail,
  query: "gyms",
  location: "London UK",
});

record(
  "first two trial searches accepted",
  search1.res.status === 201 && search2.res.status === 201,
  `search1=${search1.res.status}, search2=${search2.res.status}`
);
record(
  "third trial search rejected on server",
  search3.res.status === 429 && search3.json.code === "TRIAL_LIMIT",
  `search3=${search3.res.status}, body=${JSON.stringify(search3.json)}`
);

const row = trialSignups.get(testEmail);
record(
  "searches_used counter increments in search flow",
  row?.searches_used === 2,
  `searches_used=${row?.searches_used}`
);

const searchUsedEndpoint = await post("/trial/search-used", { email: testEmail });
record(
  "search-used endpoint does not increment again",
  searchUsedEndpoint.json.searches_used === 2,
  JSON.stringify(searchUsedEndpoint.json)
);

const mailbox = await post("/mailboxes/connect", {
  email_address: "trial@example.com",
  app_password: "fake",
});
record(
  "trial user mailbox connect rejected",
  mailbox.res.status === 401,
  `status=${mailbox.res.status}, error=${mailbox.json.error}`
);

const send = await post("/send", { targets: [], subject: "x", body: "y" });
record(
  "trial user send rejected",
  send.res.status === 401,
  `status=${send.res.status}, error=${send.json.error}`
);

const pagePath = path.join(repoRoot, "frontend/app/freetrial/page.tsx");
const pageSource = fs.readFileSync(pagePath, "utf8");

record(
  "no WhatsApp on freetrial page",
  !/wa\.me|whatsapp|09067285890/i.test(pageSource),
  "whatsapp patterns absent"
);

record(
  "Paystack shop is only payment path on page",
  pageSource.includes("https://paystack.shop/pay/Leadthur") &&
    !pageSource.includes('"/checkout"') &&
    !pageSource.includes("wa.me"),
  "paystack.shop present, /checkout and wa.me absent"
);

record(
  "locked export button present",
  /Export CSV, locked/.test(pageSource),
  "Export CSV, locked"
);

record(
  "locked send button present",
  /Send email to \{currentEmailableCount\} businesses, locked/.test(pageSource),
  "dynamic emailable count send label"
);

record(
  "searches remaining counter uses server state",
  /fetchTrialStatus/.test(pageSource) &&
    /searchesRemaining/.test(pageSource) &&
    !/lp_trial_count/.test(pageSource),
  "server-backed counter wired"
);

record(
  "upgrade panel uses aggregate stats",
  /aggregateStats\.totalFound/.test(pageSource) &&
    /aggregateStats\.verifiedEmailCount/.test(pageSource),
  "not hardcoded totals"
);

const banned = [
  "embark",
  "delve",
  "craft",
  "imagine",
  "remarkable",
  "unlock",
  "discover",
  "skyrocket",
  "innovative",
  "revolutionary",
  "utilize",
  "illuminate",
  "unveil",
  "intricate",
  "harness",
  "groundbreaking",
  "unlimited",
];
const bannedFound = banned.filter((w) => new RegExp(`\\b${w}\\b`, "i").test(pageSource));
const hasEmDash = pageSource.includes("—");

record(
  "banned words absent",
  bannedFound.length === 0,
  bannedFound.length ? bannedFound.join(", ") : "none"
);
record("em dash absent", !hasEmDash, hasEmDash ? "found em dash" : "none");

const tapMatches =
  pageSource.match(/minHeight:\s*48/g) ?? [];
const tapSpreads = pageSource.match(/\.\.\.tapTarget/g) ?? [];
record(
  "tap targets at least 48px",
  tapMatches.length + tapSpreads.length >= 8,
  `minHeight:48 count=${tapMatches.length}, tapTarget spreads=${tapSpreads.length}`
);

server.close();

const failed = results.filter((r) => !r.pass);
if (failed.length) {
  console.error(`\n${failed.length} check(s) failed`);
  process.exit(1);
}
console.log(`\nAll ${results.length} checks passed`);
