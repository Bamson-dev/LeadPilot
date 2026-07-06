#!/usr/bin/env node
/**
 * Outreach payment layer verification (mock Supabase + simulated Paystack webhooks).
 */
import crypto from "crypto";
import express from "express";
import http from "http";
import { createRequire } from "node:module";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  registerMailboxMocks,
  resetMailboxMocks,
  seedUser,
  seedLicense,
  setOutreachAccount,
  getOutreachAccount,
  getLedgerForUser,
  seedPaystackPlans,
  getStoredPaystackPlans,
} from "./verify-mailbox-mocks.mjs";
import { OUTREACH_CREDIT_PACKS, OUTREACH_SUBSCRIPTION_TIERS } from "../dist/constants/outreach-pricing.js";

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
process.env.PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY || "sk_test_outreach_verify";
process.env.SUPABASE_URL = "https://mock.supabase.co";
process.env.SUPABASE_SERVICE_KEY = "mock-service-key-0123456789";
delete process.env.USE_REAL_SUPABASE;
process.env.FRONTEND_URL = process.env.FRONTEND_URL || "https://staging.leadthur.com";
process.env.JWT_SECRET = process.env.JWT_SECRET || "test-jwt-secret-01234567890123456789012";
process.env.ADMIN_EMAIL = process.env.ADMIN_EMAIL || "admin@test.local";
process.env.ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "test-admin-password";

const results = [];
const PAYSTACK_TEST_SECRET = process.env.PAYSTACK_SECRET_KEY;

function pass(label, detail = "") {
  results.push({ label, status: "PASS", detail });
  console.log(`PASS: ${label}${detail ? ` — ${detail}` : ""}`);
}

function fail(label, detail = "") {
  results.push({ label, status: "FAIL", detail });
  console.error(`FAIL: ${label}${detail ? ` — ${detail}` : ""}`);
}

function clearModuleCache() {
  const require = createRequire(import.meta.url);
  for (const key of Object.keys(require.cache)) {
    if (
      key.includes("/dist/") ||
      key.includes("payment-fulfillment") ||
      key.includes("outreach-paystack") ||
      key.includes("outreach-grace") ||
      key.includes("paystack-client") ||
      key.includes("database/client") ||
      key.includes("database/outreach-repository") ||
      key.includes("webhook-router") ||
      key.includes("outreach-checkout") ||
      key.includes("balance") ||
      key.includes("config/env")
    ) {
      delete require.cache[key];
    }
  }
}

function signPaystackBody(rawBody) {
  return crypto.createHmac("sha512", PAYSTACK_TEST_SECRET).update(rawBody).digest("hex");
}

async function registerPaymentMocks() {
  await registerMailboxMocks({ skipOutreachRepoMock: false, mockPaystack: true });
}

function chargeSuccessEvent({ reference, metadata, subscription }) {
  return {
    event: "charge.success",
    data: {
      reference,
      amount: metadata.amountKobo ?? 500_000,
      metadata,
      subscription,
      next_payment_date: subscription?.next_payment_date,
      subscription_code: subscription?.subscription_code,
    },
  };
}

async function loadDist(modulePath) {
  const require = createRequire(import.meta.url);
  return require(join(__dirname, "..", "dist", modulePath));
}

async function runTests() {
  resetMailboxMocks();
  clearModuleCache();
  await registerPaymentMocks();

  const { ensureOutreachPaystackPlans, getAllStoredOutreachPlanCodes } = await loadDist(
    "services/outreach-paystack-plans.js"
  );

  const createdCodes = await ensureOutreachPaystackPlans();
  const stored = getStoredPaystackPlans();
  const tiers = ["starter", "growth", "scale"];
  if (
    tiers.every((t) => createdCodes[t]?.startsWith("PLN_TEST_")) &&
    stored.length === 3
  ) {
    pass("Paystack plans created/stored", JSON.stringify(createdCodes));
  } else {
    fail("Paystack plans created/stored", JSON.stringify({ createdCodes, stored }));
  }

  const { processOutreachPaystackWebhookEvent } = await loadDist("services/payment-fulfillment.js");

  for (const pack of OUTREACH_CREDIT_PACKS) {
    resetMailboxMocks();
    clearModuleCache();
    await registerPaymentMocks();
    seedPaystackPlans(
      OUTREACH_SUBSCRIPTION_TIERS.map((t) => ({
        tier: t.id,
        plan_code: `PLN_TEST_${t.amountKobo}`,
        amount_kobo: t.amountKobo,
        monthly_allowance: t.monthlyAllowance,
        max_mailboxes: t.maxMailboxes,
      }))
    );

    const user = seedUser(`pack-${pack.id}@test.local`);
    setOutreachAccount(user.id, { purchased_credits_balance: 0 });

    const ref = `pack-${pack.id}-${Date.now()}`;
    await processOutreachPaystackWebhookEvent(
      chargeSuccessEvent({
        reference: ref,
        metadata: {
          outreach_type: "pack",
          user_id: user.id,
          pack_id: pack.id,
          amountKobo: pack.amountKobo,
        },
      })
    );

    const acct = getOutreachAccount(user.id);
    const ledger = getLedgerForUser(user.id).filter((r) => r.type === "purchase");
    if (
      acct?.purchased_credits_balance === pack.credits &&
      ledger.length === 1 &&
      ledger[0].bucket === "purchased_credits" &&
      ledger[0].amount === pack.credits &&
      ledger[0].reference === ref
    ) {
      pass(`pack purchase ${pack.id}`, `balance=${acct.purchased_credits_balance}, ledger amount=${ledger[0].amount}`);
    } else {
      fail(`pack purchase ${pack.id}`, JSON.stringify({ acct, ledger }));
    }
  }

  for (const tier of OUTREACH_SUBSCRIPTION_TIERS) {
    resetMailboxMocks();
    clearModuleCache();
    await registerPaymentMocks();
    seedPaystackPlans(
      OUTREACH_SUBSCRIPTION_TIERS.map((t) => ({
        tier: t.id,
        plan_code: `PLN_TEST_${t.amountKobo}`,
        amount_kobo: t.amountKobo,
        monthly_allowance: t.monthlyAllowance,
        max_mailboxes: t.maxMailboxes,
      }))
    );

    const user = seedUser(`sub-${tier.id}@test.local`);
    setOutreachAccount(user.id, {});

    const ref = `sub-${tier.id}-${Date.now()}`;
    const renewsAt = new Date(Date.now() + 30 * 86_400_000).toISOString();
    await processOutreachPaystackWebhookEvent(
      chargeSuccessEvent({
        reference: ref,
        metadata: {
          outreach_type: "subscription",
          user_id: user.id,
          tier: tier.id,
        },
        subscription: {
          subscription_code: `SUB_${tier.id}`,
          next_payment_date: renewsAt,
        },
      })
    );

    const acct = getOutreachAccount(user.id);
    const refill = getLedgerForUser(user.id).filter((r) => r.type === "monthly_refill");
    if (
      acct?.subscription_status === "active" &&
      acct.subscription_tier === tier.id &&
      acct.max_mailboxes === tier.maxMailboxes &&
      acct.monthly_allowance === tier.monthlyAllowance &&
      acct.monthly_allowance_remaining === tier.monthlyAllowance &&
      acct.monthly_allowance_reset_at &&
      refill.length === 1 &&
      refill[0].amount === tier.monthlyAllowance &&
      refill[0].bucket === "monthly_allowance"
    ) {
      pass(
        `first subscription ${tier.id}`,
        `allowance=${acct.monthly_allowance_remaining}, mailboxes=${acct.max_mailboxes}`
      );
    } else {
      fail(`first subscription ${tier.id}`, JSON.stringify({ acct, refill }));
    }
  }

  resetMailboxMocks();
  clearModuleCache();
  await registerPaymentMocks();
  const renewUser = seedUser("renew@test.local");
  setOutreachAccount(renewUser.id, {
    subscription_status: "active",
    subscription_tier: "growth",
    max_mailboxes: 3,
    monthly_allowance: 5000,
    monthly_allowance_remaining: 120,
    purchased_credits_balance: 50,
  });
  const renewRef1 = `renew-1-${Date.now()}`;
  const renewRef2 = `renew-2-${Date.now() + 1}`;
  await processOutreachPaystackWebhookEvent(
    chargeSuccessEvent({
      reference: renewRef1,
      metadata: { outreach_type: "subscription", user_id: renewUser.id, tier: "growth" },
    })
  );
  setOutreachAccount(renewUser.id, {
    subscription_status: "active",
    subscription_tier: "growth",
    monthly_allowance: 5000,
    monthly_allowance_remaining: 200,
  });
  await processOutreachPaystackWebhookEvent(
    chargeSuccessEvent({
      reference: renewRef2,
      metadata: { outreach_type: "subscription", user_id: renewUser.id, tier: "growth" },
    })
  );
  const renewAcct = getOutreachAccount(renewUser.id);
  const renewLedger = getLedgerForUser(renewUser.id).filter((r) => r.type === "monthly_refill");
  if (
    renewAcct?.monthly_allowance_remaining === 5000 &&
    renewAcct.purchased_credits_balance === 50 &&
    renewLedger.length === 2
  ) {
    pass("subscription renewal refill", `remaining=5000 (not 5200), refills=${renewLedger.length}`);
  } else {
    fail("subscription renewal refill", JSON.stringify({ renewAcct, renewLedger }));
  }

  resetMailboxMocks();
  clearModuleCache();
  await registerPaymentMocks();
  const idemUser = seedUser("idem@test.local");
  setOutreachAccount(idemUser.id, { purchased_credits_balance: 0 });
  const idemRef = `idem-${Date.now()}`;
  const idemMeta = { outreach_type: "pack", user_id: idemUser.id, pack_id: "small" };
  await processOutreachPaystackWebhookEvent(chargeSuccessEvent({ reference: idemRef, metadata: idemMeta }));
  await processOutreachPaystackWebhookEvent(chargeSuccessEvent({ reference: idemRef, metadata: idemMeta }));
  const idemAcct = getOutreachAccount(idemUser.id);
  const idemPurchases = getLedgerForUser(idemUser.id).filter((r) => r.type === "purchase");
  if (idemAcct?.purchased_credits_balance === 1000 && idemPurchases.length === 1) {
    pass("idempotency duplicate webhook", `balance=1000, purchases=${idemPurchases.length}`);
  } else {
    fail("idempotency duplicate webhook", JSON.stringify({ idemAcct, idemPurchases }));
  }

  resetMailboxMocks();
  clearModuleCache();
  await registerPaymentMocks();
  const graceUser = seedUser("grace@test.local");
  setOutreachAccount(graceUser.id, {
    subscription_status: "active",
    subscription_tier: "starter",
    monthly_allowance_remaining: 800,
    purchased_credits_balance: 250,
    paystack_subscription_code: "SUB_GRACE",
  });
  await processOutreachPaystackWebhookEvent({
    event: "invoice.payment_failed",
    data: {
      subscription_code: "SUB_GRACE",
      customer: { email: "grace@test.local" },
    },
  });
  const graceAcct = getOutreachAccount(graceUser.id);
  const graceUntil = graceAcct?.grace_until ? new Date(graceAcct.grace_until) : null;
  const graceOk =
    graceAcct?.subscription_status === "grace" &&
    graceAcct.purchased_credits_balance === 250 &&
    graceUntil &&
    graceUntil.getTime() > Date.now();
  if (graceOk) {
    pass("grace on payment failed", `status=${graceAcct.subscription_status}, credits=${graceAcct.purchased_credits_balance}`);
  } else {
    fail("grace on payment failed", JSON.stringify(graceAcct));
  }

  resetMailboxMocks();
  clearModuleCache();
  await registerPaymentMocks();
  const expireUser = seedUser("expire@test.local");
  setOutreachAccount(expireUser.id, {
    subscription_status: "grace",
    subscription_tier: "starter",
    monthly_allowance_remaining: 400,
    purchased_credits_balance: 99,
    grace_until: new Date(Date.now() - 60_000).toISOString(),
  });
  const { processOutreachGraceExpiry } = await loadDist("services/outreach-grace-scheduler.js");
  const expiredCount = await processOutreachGraceExpiry();
  const expireAcct = getOutreachAccount(expireUser.id);
  if (
    expiredCount === 1 &&
    expireAcct?.subscription_status === "none" &&
    expireAcct.monthly_allowance_remaining === 0 &&
    expireAcct.purchased_credits_balance === 99
  ) {
    pass("grace expiry", `status=${expireAcct.subscription_status}, purchased=${expireAcct.purchased_credits_balance}`);
  } else {
    fail("grace expiry", JSON.stringify({ expiredCount, expireAcct }));
  }

  resetMailboxMocks();
  clearModuleCache();
  await registerPaymentMocks();
  seedPaystackPlans(
    OUTREACH_SUBSCRIPTION_TIERS.map((t) => ({
      tier: t.id,
      plan_code: `PLN_TEST_${t.amountKobo}`,
      amount_kobo: t.amountKobo,
      monthly_allowance: t.monthlyAllowance,
      max_mailboxes: t.maxMailboxes,
    }))
  );

  const balUser = seedUser("balance@test.local");
  const balKey = "LP-BAL-TEST";
  seedLicense("balance@test.local", balKey);
  const future = new Date(Date.now() + 7 * 86_400_000).toISOString();
  setOutreachAccount(balUser.id, {
    subscription_status: "active",
    subscription_tier: "growth",
    max_mailboxes: 3,
    monthly_allowance: 5000,
    monthly_allowance_remaining: 1200,
    monthly_allowance_reset_at: future,
    purchased_credits_balance: 300,
    free_sends_granted: 50,
    free_sends_used: 40,
    free_sends_expire_at: future,
  });

  const { balanceRouter } = await loadDist("routes/balance.js");
  const app = express();
  app.use(express.json());
  app.use("/balance", balanceRouter);
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const balRes = await fetch(`${base}/balance`, {
    headers: {
      "x-license-key": balKey,
      "x-license-email": "balance@test.local",
    },
  });
  const balBody = await balRes.json();
  server.close();

  if (
    balRes.status === 200 &&
    balBody.send_balance === 1510 &&
    balBody.free_trial_remaining === 10 &&
    balBody.monthly_allowance_remaining === 1200 &&
    balBody.purchased_credits === 300 &&
    balBody.subscription_tier === "growth" &&
    balBody.subscription_status === "active"
  ) {
    pass(
      "balance endpoint breakdown",
      `send_balance=${balBody.send_balance}, free=${balBody.free_trial_remaining}, monthly=${balBody.monthly_allowance_remaining}, purchased=${balBody.purchased_credits}`
    );
  } else {
    fail("balance endpoint breakdown", JSON.stringify({ status: balRes.status, balBody }));
  }

  const searchSendPaths = [
    join(__dirname, "../src/queue/search-queue.ts"),
    join(__dirname, "../src/workers/search-worker.ts"),
    join(__dirname, "../src/services/outreach-send-service.ts"),
    join(__dirname, "../src/queue/outreach-send-queue.ts"),
  ];
  const sendSrc = readFileSync(searchSendPaths[2], "utf8");
  const outreachQueueSrc = readFileSync(searchSendPaths[3], "utf8");
  if (!sendSrc.includes("payment") && !outreachQueueSrc.includes("paystack")) {
    pass("steps 1-2 send logic untouched", "no payment code in send queue/service");
  } else {
    fail("steps 1-2 send logic untouched", "payment references found in send files");
  }

  const webhookSrc = readFileSync(join(__dirname, "../src/api/webhook-router.ts"), "utf8");
  if (
    webhookSrc.includes("processOutreachPaystackWebhookEvent") &&
    webhookSrc.includes('"/paystack"')
  ) {
    pass("extended existing Paystack webhook", "outreach routed through /webhooks/paystack");
  } else {
    fail("extended existing Paystack webhook", "missing outreach handler wiring");
  }

  const planCodes = await getAllStoredOutreachPlanCodes();
  console.log("\nPaystack test plan codes:", planCodes);
}

await runTests();

console.log("\n=== Summary ===");
for (const r of results) {
  console.log(`${r.status}: ${r.label}${r.detail ? ` — ${r.detail}` : ""}`);
}
process.exit(results.some((r) => r.status === "FAIL") ? 1 : 0);
