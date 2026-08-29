/**
 * Paystack -> LeadThur router -> DigitalSkillX integration tests.
 *
 * Imports the real production modules (no duplicated logic) and injects
 * the Paystack verify call and fetch so nothing touches the network.
 *
 *   npx tsx scripts/verify-paystack-digitalskillx-routing.ts
 */
import assert from "node:assert/strict";
import crypto from "node:crypto";

process.env.NODE_ENV ??= "test";
process.env.SUPABASE_URL ??= "https://example.supabase.co";
process.env.SUPABASE_SERVICE_KEY ??= "service_role_test_key_0123456789";
process.env.FRONTEND_URL ??= "http://localhost:3000";
process.env.ADMIN_EMAIL ??= "admin@example.com";
process.env.ADMIN_PASSWORD ??= "testpassword12";
process.env.JWT_SECRET ??= "0123456789012345678901234567890123456789";
process.env.PAYSTACK_SECRET_KEY ??= "sk_test_leadthur_router";
process.env.DIGITALSKILLX_FORWARD_SECRET ??=
  "dsx_forward_secret_for_tests_0123456789abcdef";

const {
  DIGITALSKILLX_AIAPP_AMOUNT_KOBO,
  DIGITALSKILLX_AIAPP_COURSE_ID,
  DIGITALSKILLX_AIAPP_CURRENCY,
  DIGITALSKILLX_AIAPP_PRODUCT_KEY,
  isDigitalSkillXPaystackEvent,
  hasAlreadyForwarded,
  resetDigitalSkillXForwardCache,
  routeDigitalSkillXCharge,
} = await import("../src/services/paystack-digitalskillx-forward");

const { isLeadThurLifetimePaystackCharge } = await import(
  "../src/services/paystack-product-guard"
);

const {
  buildDigitalSkillXHandoffHeaders,
  safeEqualHex,
  signDigitalSkillXPayload,
  verifyDigitalSkillXHandoff,
  DIGITALSKILLX_SIGNATURE_HEADER,
  DIGITALSKILLX_TIMESTAMP_HEADER,
  DIGITALSKILLX_NONCE_HEADER,
} = await import("../src/services/digitalskillx-handoff");

const SECRET = process.env.DIGITALSKILLX_FORWARD_SECRET!;

let passed = 0;
let failed = 0;
const failures: string[] = [];

async function check(label: string, fn: () => void | Promise<void>): Promise<void> {
  try {
    await fn();
    passed += 1;
    console.log(JSON.stringify({ label, pass: true }));
  } catch (err) {
    failed += 1;
    const message = err instanceof Error ? err.message : String(err);
    failures.push(`${label}: ${message}`);
    console.log(JSON.stringify({ label, pass: false, error: message }));
  }
}

type VerifiedShape = {
  status: string;
  amount: number;
  currency?: string;
  customer: { email: string };
  metadata: Record<string, unknown> | string | null;
  reference: string;
  page?: { slug?: string; name?: string } | null;
  paidAt?: string | null;
};

function verifiedTx(overrides: Partial<VerifiedShape> = {}): VerifiedShape {
  return {
    status: "success",
    amount: DIGITALSKILLX_AIAPP_AMOUNT_KOBO,
    currency: DIGITALSKILLX_AIAPP_CURRENCY,
    customer: { email: "Student@Example.COM" },
    metadata: { product_key: DIGITALSKILLX_AIAPP_PRODUCT_KEY },
    reference: "T_dsx_default",
    page: { slug: "aiapp", name: "Build And Monetize Your Software With AI" },
    paidAt: "2026-08-29T09:00:00.000Z",
    ...overrides,
  };
}

type FetchCall = { url: string; init: RequestInit };

function stubFetch(response: { status: number; body?: string; contentType?: string }) {
  const calls: FetchCall[] = [];
  const impl = (async (url: unknown, init: unknown) => {
    calls.push({ url: String(url), init: (init ?? {}) as RequestInit });
    return {
      status: response.status,
      text: async () => response.body ?? "{}",
      headers: { get: () => response.contentType ?? "application/json" },
    };
  }) as unknown as typeof fetch;
  return { impl, calls };
}

function failingFetch() {
  const impl = (async () => {
    throw new Error("ECONNREFUSED");
  }) as unknown as typeof fetch;
  return impl;
}

// --- 1. Existing Leadthur successful payment ------------------------------
await check("1. Leadthur in-app checkout is identified as LeadThur", () => {
  assert.equal(
    isLeadThurLifetimePaystackCharge({
      reference: "LP-1786343304640-4WA4OQ",
      metadata: { product: "leadthur", source: "leadthur_checkout" },
      amount: 2_500_000,
      currency: "NGN",
    }),
    true
  );
});

// --- 2. DigitalSkillX successful payment ----------------------------------
await check("2. DigitalSkillX verified charge is forwarded", async () => {
  resetDigitalSkillXForwardCache();
  const { impl, calls } = stubFetch({ status: 200, body: '{"enrolled":true}' });

  const result = await routeDigitalSkillXCharge(
    { reference: "T_dsx_success", eventType: "charge.success" },
    { verify: async () => verifiedTx({ reference: "T_dsx_success" }), fetchImpl: impl }
  );

  assert.equal(result.outcome, "forwarded");
  assert.equal(calls.length, 1);

  const body = JSON.parse(String(calls[0].init.body));
  assert.equal(body.product_key, DIGITALSKILLX_AIAPP_PRODUCT_KEY);
  assert.equal(body.course_id, DIGITALSKILLX_AIAPP_COURSE_ID);
  assert.equal(body.reference, "T_dsx_success");
  assert.equal(body.amount, DIGITALSKILLX_AIAPP_AMOUNT_KOBO);
  assert.equal(body.currency, "NGN");
  assert.equal(body.customer.email, "student@example.com", "email must be normalized");
});

// --- 3. Invalid Paystack signature ----------------------------------------
await check("3. Invalid Paystack signature is rejected (constant-time compare)", () => {
  const secret = "sk_test_leadthur_router";
  const raw = Buffer.from(JSON.stringify({ event: "charge.success" }));
  const good = crypto.createHmac("sha512", secret).update(raw).digest("hex");
  const bad = crypto.createHmac("sha512", "wrong_secret").update(raw).digest("hex");

  assert.equal(safeEqualHex(good, good), true);
  assert.equal(safeEqualHex(bad, good), false);
  assert.equal(safeEqualHex("", good), false);
  assert.equal(safeEqualHex("short", good), false);
});

// --- 4. Failed Paystack transaction ---------------------------------------
await check("4. Failed transaction is never forwarded", async () => {
  resetDigitalSkillXForwardCache();
  const { impl, calls } = stubFetch({ status: 200 });

  const result = await routeDigitalSkillXCharge(
    { reference: "T_dsx_failed" },
    {
      verify: async () => verifiedTx({ reference: "T_dsx_failed", status: "failed" }),
      fetchImpl: impl,
    }
  );

  assert.equal(result.outcome, "not_success");
  assert.equal(calls.length, 0);
});

// --- 5. Abandoned transaction ---------------------------------------------
await check("5. Abandoned transaction is never forwarded", async () => {
  resetDigitalSkillXForwardCache();
  const { impl, calls } = stubFetch({ status: 200 });

  const result = await routeDigitalSkillXCharge(
    { reference: "T_dsx_abandoned" },
    {
      verify: async () => verifiedTx({ reference: "T_dsx_abandoned", status: "abandoned" }),
      fetchImpl: impl,
    }
  );

  assert.equal(result.outcome, "not_success");
  assert.equal(calls.length, 0);
});

// --- 6. Wrong amount -------------------------------------------------------
await check("6. Wrong verified amount is rejected", async () => {
  resetDigitalSkillXForwardCache();
  const { impl, calls } = stubFetch({ status: 200 });

  const result = await routeDigitalSkillXCharge(
    { reference: "T_dsx_low" },
    {
      verify: async () => verifiedTx({ reference: "T_dsx_low", amount: 100_000 }),
      fetchImpl: impl,
    }
  );

  assert.equal(result.outcome, "rejected");
  assert.equal((result as { reason: string }).reason, "amount_mismatch");
  assert.equal(calls.length, 0);
});

// --- 7. Wrong currency -----------------------------------------------------
await check("7. Wrong verified currency is rejected", async () => {
  resetDigitalSkillXForwardCache();
  const { impl, calls } = stubFetch({ status: 200 });

  const result = await routeDigitalSkillXCharge(
    { reference: "T_dsx_usd" },
    {
      verify: async () => verifiedTx({ reference: "T_dsx_usd", currency: "USD" }),
      fetchImpl: impl,
    }
  );

  assert.equal(result.outcome, "rejected");
  assert.equal((result as { reason: string }).reason, "currency_mismatch");
  assert.equal(calls.length, 0);
});

// --- 8. Wrong product ------------------------------------------------------
await check("8. Right amount but non-DigitalSkillX verified product is rejected", async () => {
  resetDigitalSkillXForwardCache();
  const { impl, calls } = stubFetch({ status: 200 });

  const result = await routeDigitalSkillXCharge(
    { reference: "T_other_product" },
    {
      verify: async () =>
        verifiedTx({
          reference: "T_other_product",
          metadata: { product: "some-other-course" },
          page: { slug: "otherpage" },
        }),
      fetchImpl: impl,
    }
  );

  assert.equal(result.outcome, "rejected");
  assert.equal((result as { reason: string }).reason, "product_not_confirmed");
  assert.equal(calls.length, 0);
});

// --- 9. Duplicate Paystack webhook -----------------------------------------
await check("9. Duplicate webhook forwards exactly once", async () => {
  resetDigitalSkillXForwardCache();
  const { impl, calls } = stubFetch({ status: 200, body: '{"enrolled":true}' });
  const verify = async () => verifiedTx({ reference: "T_dsx_dupe" });

  const first = await routeDigitalSkillXCharge({ reference: "T_dsx_dupe" }, { verify, fetchImpl: impl });
  const second = await routeDigitalSkillXCharge({ reference: "T_dsx_dupe" }, { verify, fetchImpl: impl });
  const third = await routeDigitalSkillXCharge({ reference: "T_dsx_dupe" }, { verify, fetchImpl: impl });

  assert.equal(first.outcome, "forwarded");
  assert.equal(second.outcome, "duplicate");
  assert.equal(third.outcome, "duplicate");
  assert.equal(calls.length, 1, "DigitalSkillX must only be called once per reference");
});

// --- 10. DigitalSkillX existing user ---------------------------------------
await check("10. Existing DigitalSkillX student response is passed through", async () => {
  resetDigitalSkillXForwardCache();
  const { impl } = stubFetch({ status: 200, body: '{"student":"existing","enrolled":true}' });

  const result = await routeDigitalSkillXCharge(
    { reference: "T_dsx_existing_user" },
    { verify: async () => verifiedTx({ reference: "T_dsx_existing_user" }), fetchImpl: impl }
  );

  assert.equal(result.outcome, "forwarded");
  assert.equal((result as { status: number }).status, 200);
  assert.match((result as { body: string }).body, /existing/);
});

// --- 11. DigitalSkillX new user --------------------------------------------
await check("11. New DigitalSkillX student is enrolled with normalized email", async () => {
  resetDigitalSkillXForwardCache();
  const { impl, calls } = stubFetch({ status: 201, body: '{"student":"created"}' });

  const result = await routeDigitalSkillXCharge(
    { reference: "T_dsx_new_user" },
    {
      verify: async () =>
        verifiedTx({ reference: "T_dsx_new_user", customer: { email: "  NEW.Student@Example.com " } }),
      fetchImpl: impl,
    }
  );

  assert.equal(result.outcome, "forwarded");
  const body = JSON.parse(String(calls[0].init.body));
  assert.equal(body.customer.email, "new.student@example.com");
});

// --- 12. Existing DigitalSkillX enrollment ---------------------------------
await check("12. Already-enrolled acknowledgement is treated as success", async () => {
  resetDigitalSkillXForwardCache();
  const { impl } = stubFetch({ status: 200, body: '{"already_enrolled":true}' });

  const result = await routeDigitalSkillXCharge(
    { reference: "T_dsx_already_enrolled" },
    { verify: async () => verifiedTx({ reference: "T_dsx_already_enrolled" }), fetchImpl: impl }
  );

  assert.equal(result.outcome, "forwarded");
  assert.equal(hasAlreadyForwarded("T_dsx_already_enrolled"), true);
});

// --- 13. Access email idempotency ------------------------------------------
await check("13. Repeat deliveries cannot trigger a second access email", async () => {
  resetDigitalSkillXForwardCache();
  const { impl, calls } = stubFetch({ status: 200, body: '{"email_sent":true}' });
  const verify = async () => verifiedTx({ reference: "T_dsx_email_once" });

  await routeDigitalSkillXCharge({ reference: "T_dsx_email_once" }, { verify, fetchImpl: impl });
  for (let i = 0; i < 5; i += 1) {
    await routeDigitalSkillXCharge({ reference: "T_dsx_email_once" }, { verify, fetchImpl: impl });
  }

  assert.equal(calls.length, 1, "only one fulfillment request may reach DigitalSkillX");
});

// --- 14. Server-to-server authentication failure ---------------------------
await check("14. DigitalSkillX auth rejection is surfaced and not cached as done", async () => {
  resetDigitalSkillXForwardCache();
  const { impl } = stubFetch({ status: 401, body: '{"error":"bad signature"}' });

  const result = await routeDigitalSkillXCharge(
    { reference: "T_dsx_auth_fail" },
    { verify: async () => verifiedTx({ reference: "T_dsx_auth_fail" }), fetchImpl: impl }
  );

  assert.equal(result.outcome, "forwarded");
  assert.equal((result as { status: number }).status, 401);
  assert.equal(
    hasAlreadyForwarded("T_dsx_auth_fail"),
    false,
    "a rejected handoff must never be marked fulfilled"
  );
});

// --- 15. Replay attack prevention ------------------------------------------
await check("15. Signed handoff blocks replay, tampering and forgery", () => {
  const body = JSON.stringify({ reference: "T_replay", product_key: DIGITALSKILLX_AIAPP_PRODUCT_KEY });
  const now = 1_800_000_000;
  const headers = buildDigitalSkillXHandoffHeaders({
    secret: SECRET,
    body,
    eventId: "T_replay",
    productKey: DIGITALSKILLX_AIAPP_PRODUCT_KEY,
    nowSeconds: now,
    nonce: "nonce-1",
  });

  const signature = headers[DIGITALSKILLX_SIGNATURE_HEADER].replace("sha256=", "");
  const timestamp = headers[DIGITALSKILLX_TIMESTAMP_HEADER];
  const nonce = headers[DIGITALSKILLX_NONCE_HEADER];

  assert.deepEqual(
    verifyDigitalSkillXHandoff({ secret: SECRET, signature, timestamp, nonce, body, nowSeconds: now }),
    { valid: true },
    "fresh signed request must verify"
  );

  assert.equal(
    verifyDigitalSkillXHandoff({
      secret: SECRET,
      signature,
      timestamp,
      nonce,
      body,
      nowSeconds: now + 3600,
    }).valid,
    false,
    "replayed request outside the freshness window must fail"
  );

  assert.equal(
    verifyDigitalSkillXHandoff({
      secret: SECRET,
      signature,
      timestamp,
      nonce,
      body: body.replace("T_replay", "T_attacker"),
      nowSeconds: now,
    }).valid,
    false,
    "tampered body must fail"
  );

  assert.equal(
    verifyDigitalSkillXHandoff({
      secret: "attacker-secret-attacker-secret-01",
      signature,
      timestamp,
      nonce,
      body,
      nowSeconds: now,
    }).valid,
    false,
    "forged signature must fail"
  );

  assert.notEqual(
    signDigitalSkillXPayload({ secret: SECRET, timestamp, nonce: "nonce-2", body }),
    signature,
    "nonce must be bound into the signature"
  );
});

// --- 16. Leadthur payment must not enroll into DigitalSkillX ---------------
await check("16. Leadthur payments are never identified as DigitalSkillX", () => {
  const leadthurCharges = [
    { reference: "LP-1786343304640-4WA4OQ", amount: 2_500_000, currency: "NGN", metadata: { product: "leadthur", source: "leadthur_checkout" } },
    { reference: "T100175682259401", amount: 2_500_000, currency: "NGN", metadata: { product: "LeadThur Lifetime" } },
    { reference: "T486918630228311", amount: 2_500_000, currency: "NGN", metadata: { referrer: "https://paystack.shop/pay/Leadthur" } },
    // Same price as DigitalSkillX but clearly LeadThur — amount must not decide.
    { reference: "LP-1786343304641-ZZZZZZ", amount: DIGITALSKILLX_AIAPP_AMOUNT_KOBO, currency: "NGN", metadata: { product: "leadthur", source: "leadthur_checkout" } },
  ];

  for (const charge of leadthurCharges) {
    assert.equal(
      isDigitalSkillXPaystackEvent({ event: "charge.success", data: charge }),
      false,
      `must not route to DigitalSkillX: ${charge.reference}`
    );
  }
});

// --- 17. DigitalSkillX payment must not trigger Leadthur fulfillment -------
await check("17. DigitalSkillX payments never satisfy the LeadThur guard", () => {
  const dsxCharges = [
    { reference: "T_aiapp_1", amount: DIGITALSKILLX_AIAPP_AMOUNT_KOBO, currency: "NGN", metadata: { product_key: DIGITALSKILLX_AIAPP_PRODUCT_KEY } },
    { reference: "T_aiapp_2", amount: DIGITALSKILLX_AIAPP_AMOUNT_KOBO, currency: "NGN", metadata: { referrer: "https://paystack.shop/pay/aiapp" } },
  ];

  for (const charge of dsxCharges) {
    assert.equal(isLeadThurLifetimePaystackCharge(charge), false, `must not fulfill LeadThur: ${charge.reference}`);
    assert.equal(isDigitalSkillXPaystackEvent({ event: "charge.success", data: charge }), true);
  }
});

// --- 18. Paystack API verification failure ---------------------------------
await check("18. Paystack verify failure is retryable and never forwards", async () => {
  resetDigitalSkillXForwardCache();
  const { impl, calls } = stubFetch({ status: 200 });

  const result = await routeDigitalSkillXCharge(
    { reference: "T_verify_down" },
    {
      verify: async () => {
        throw new Error("Paystack API request failed");
      },
      fetchImpl: impl,
    }
  );

  assert.equal(result.outcome, "retryable");
  assert.equal((result as { reason: string }).reason, "paystack_verify_failed");
  assert.equal(calls.length, 0);
  assert.equal(hasAlreadyForwarded("T_verify_down"), false);
});

// --- 19. Missing customer email --------------------------------------------
await check("19. Verified transaction without an email is rejected", async () => {
  resetDigitalSkillXForwardCache();
  const { impl, calls } = stubFetch({ status: 200 });

  const result = await routeDigitalSkillXCharge(
    { reference: "T_no_email" },
    {
      verify: async () =>
        verifiedTx({ reference: "T_no_email", customer: { email: "" } }),
      fetchImpl: impl,
    }
  );

  assert.equal(result.outcome, "rejected");
  assert.equal((result as { reason: string }).reason, "missing_customer_email");
  assert.equal(calls.length, 0);
});

// --- 20. Unknown / unrecognized product ------------------------------------
await check("20. Unknown products route to neither LeadThur nor DigitalSkillX", () => {
  const unknown = [
    { reference: "T504145040489331", amount: 5_000_000, currency: "NGN", metadata: {} },
    { reference: "T_unknown_amount_only", amount: DIGITALSKILLX_AIAPP_AMOUNT_KOBO, currency: "NGN", metadata: {} },
    { reference: "T_promptearn", amount: 1_000_000, currency: "NGN", metadata: { product: "promptearn" } },
  ];

  for (const charge of unknown) {
    assert.equal(isDigitalSkillXPaystackEvent({ event: "charge.success", data: charge }), false);
    assert.equal(isLeadThurLifetimePaystackCharge(charge), false);
  }
});

// --- Supporting guarantees ---------------------------------------------------
await check("21. DigitalSkillX network outage is retryable, not silently dropped", async () => {
  resetDigitalSkillXForwardCache();
  const result = await routeDigitalSkillXCharge(
    { reference: "T_dsx_down" },
    { verify: async () => verifiedTx({ reference: "T_dsx_down" }), fetchImpl: failingFetch() }
  );

  assert.equal(result.outcome, "retryable");
  assert.equal(hasAlreadyForwarded("T_dsx_down"), false);
});

await check("22. DigitalSkillX 5xx is retryable and not cached", async () => {
  resetDigitalSkillXForwardCache();
  const { impl } = stubFetch({ status: 500, body: "boom" });

  const result = await routeDigitalSkillXCharge(
    { reference: "T_dsx_5xx" },
    { verify: async () => verifiedTx({ reference: "T_dsx_5xx" }), fetchImpl: impl }
  );

  assert.equal(result.outcome, "retryable");
  assert.equal(hasAlreadyForwarded("T_dsx_5xx"), false);
});

await check("23. Forward carries signed headers and leaks no secrets", async () => {
  resetDigitalSkillXForwardCache();
  const { impl, calls } = stubFetch({ status: 200 });

  await routeDigitalSkillXCharge(
    { reference: "T_dsx_headers" },
    { verify: async () => verifiedTx({ reference: "T_dsx_headers" }), fetchImpl: impl }
  );

  const headers = calls[0].init.headers as Record<string, string>;
  assert.ok(headers[DIGITALSKILLX_SIGNATURE_HEADER]?.startsWith("sha256="));
  assert.ok(headers[DIGITALSKILLX_TIMESTAMP_HEADER]);
  assert.ok(headers[DIGITALSKILLX_NONCE_HEADER]);

  const serialized = JSON.stringify({ headers, body: calls[0].init.body });
  assert.ok(!serialized.includes(process.env.PAYSTACK_SECRET_KEY!), "must not leak Paystack secret");
  assert.ok(!serialized.includes(SECRET), "must not leak the shared secret itself");
  assert.ok(!serialized.includes(process.env.SUPABASE_SERVICE_KEY!), "must not leak Supabase key");
  assert.ok(!serialized.includes(process.env.JWT_SECRET!), "must not leak JWT secret");
});

await check("24. A forged product_key without a verified transaction cannot enroll", async () => {
  resetDigitalSkillXForwardCache();
  const { impl, calls } = stubFetch({ status: 200 });

  // Attacker-controlled webhook body claims DigitalSkillX, but Paystack's
  // verify API is the source of truth and reports a different product.
  const result = await routeDigitalSkillXCharge(
    { reference: "T_forged" },
    {
      verify: async () =>
        verifiedTx({
          reference: "T_forged",
          amount: 100,
          metadata: { product: "attacker" },
          page: null,
        }),
      fetchImpl: impl,
    }
  );

  assert.equal(result.outcome, "rejected");
  assert.equal(calls.length, 0);
});

console.log(
  JSON.stringify({ summary: true, passed, failed, total: passed + failed }, null, 0)
);
if (failures.length) {
  console.error("\nFailures:\n" + failures.map((f) => ` - ${f}`).join("\n"));
}
process.exit(failed === 0 ? 0 : 1);
