/**
 * AI Ads Automation Masterclass: Paystack -> LeadThur router -> DigitalSkillX.
 *
 * Imports the real production modules and injects the Paystack verify call and
 * fetch, so nothing touches the network and no payment is made.
 *
 *   npx tsx scripts/verify-paystack-digitalskillx-masterclass.mts
 */
import assert from "node:assert/strict";

process.env.NODE_ENV ??= "test";
process.env.PAYSTACK_SECRET_KEY ??= "sk_test_leadthur_router";
process.env.DIGITALSKILLX_FORWARD_SECRET ??= "dsx_forward_secret_for_tests_0123456789abcdef";

const {
  DIGITALSKILLX_AI_ADS_AMOUNT_KOBO,
  DIGITALSKILLX_AI_ADS_COURSE_ID,
  DIGITALSKILLX_AI_ADS_PAGE_SLUG,
  DIGITALSKILLX_AI_ADS_PRODUCT_KEY,
  DIGITALSKILLX_AIAPP_AMOUNT_KOBO,
  DIGITALSKILLX_AIAPP_COURSE_ID,
  DIGITALSKILLX_AIAPP_PRODUCT_KEY,
  DIGITALSKILLX_ROUTER_PRODUCTS,
  hasAlreadyForwarded,
  isDigitalSkillXPaystackEvent,
  resetDigitalSkillXForwardCache,
  routeDigitalSkillXCharge,
} = await import("../src/services/paystack-digitalskillx-forward");

const { isLeadThurLifetimePaystackCharge } = await import("../src/services/paystack-product-guard");

const {
  DIGITALSKILLX_NONCE_HEADER,
  DIGITALSKILLX_PRODUCT_HEADER,
  DIGITALSKILLX_SIGNATURE_HEADER,
  DIGITALSKILLX_TIMESTAMP_HEADER,
  verifyDigitalSkillXHandoff,
} = await import("../src/services/digitalskillx-handoff");

const SECRET = process.env.DIGITALSKILLX_FORWARD_SECRET!;
const MASTERCLASS_REFERRER = `https://paystack.shop/pay/${DIGITALSKILLX_AI_ADS_PAGE_SLUG}`;

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

function masterclassTx(overrides: Partial<VerifiedShape> = {}): VerifiedShape {
  return {
    status: "success",
    amount: DIGITALSKILLX_AI_ADS_AMOUNT_KOBO,
    currency: "NGN",
    customer: { email: "Buyer@Example.COM" },
    metadata: { referrer: MASTERCLASS_REFERRER },
    reference: "T_mc_default",
    page: null,
    paidAt: "2026-11-15T09:00:00.000Z",
    ...overrides,
  };
}

type FetchCall = { url: string; init: RequestInit };

function stubFetch(response: { status: number; body?: string }) {
  const calls: FetchCall[] = [];
  const impl = (async (url: unknown, init: unknown) => {
    calls.push({ url: String(url), init: (init ?? {}) as RequestInit });
    return {
      status: response.status,
      text: async () => response.body ?? "{}",
      headers: { get: () => "application/json" },
    };
  }) as unknown as typeof fetch;
  return { impl, calls };
}

/** Fails the first `failures` calls, then answers 200. Simulates a brief outage. */
function flakyFetch(failuresBeforeSuccess: number) {
  const calls: FetchCall[] = [];
  let attempt = 0;
  const impl = (async (url: unknown, init: unknown) => {
    calls.push({ url: String(url), init: (init ?? {}) as RequestInit });
    attempt += 1;
    if (attempt <= failuresBeforeSuccess) throw new Error("ECONNRESET");
    return { status: 200, text: async () => '{"enrolled":true}', headers: { get: () => "application/json" } };
  }) as unknown as typeof fetch;
  return { impl, calls };
}

await check("M1. catalog: two products, distinct keys, slugs and courses", () => {
  assert.equal(DIGITALSKILLX_ROUTER_PRODUCTS.length, 2);
  assert.notEqual(DIGITALSKILLX_AI_ADS_PRODUCT_KEY, DIGITALSKILLX_AIAPP_PRODUCT_KEY);
  assert.notEqual(DIGITALSKILLX_AI_ADS_COURSE_ID, DIGITALSKILLX_AIAPP_COURSE_ID);
  assert.equal(DIGITALSKILLX_AI_ADS_AMOUNT_KOBO, 1_499_900);
});

await check("M2. successful masterclass payment is forwarded with its own product and course", async () => {
  resetDigitalSkillXForwardCache();
  const { impl, calls } = stubFetch({ status: 200, body: '{"enrolled":true}' });
  const result = await routeDigitalSkillXCharge(
    { reference: "T_mc_ok", eventType: "charge.success" },
    { verify: async () => masterclassTx({ reference: "T_mc_ok" }), fetchImpl: impl }
  );
  assert.equal(result.outcome, "forwarded");
  assert.equal(calls.length, 1);
  const body = JSON.parse(String(calls[0].init.body));
  assert.equal(body.product_key, DIGITALSKILLX_AI_ADS_PRODUCT_KEY);
  assert.equal(body.course_id, DIGITALSKILLX_AI_ADS_COURSE_ID);
  assert.equal(body.reference, "T_mc_ok");
  assert.equal(body.amount, 1_499_900);
  assert.equal(body.currency, "NGN");
  assert.equal(body.status, "success");
  assert.equal(body.customer.email, "buyer@example.com");
  const headers = calls[0].init.headers as Record<string, string>;
  assert.equal(headers[DIGITALSKILLX_PRODUCT_HEADER], DIGITALSKILLX_AI_ADS_PRODUCT_KEY);
  assert.equal(headers["x-leadthur-event-id"], "T_mc_ok");
});

await check("M3. masterclass handoff carries a valid HMAC, timestamp and nonce", async () => {
  resetDigitalSkillXForwardCache();
  const { impl, calls } = stubFetch({ status: 200 });
  const nowMs = 1_800_000_000_000;
  await routeDigitalSkillXCharge(
    { reference: "T_mc_hmac" },
    { verify: async () => masterclassTx({ reference: "T_mc_hmac" }), fetchImpl: impl, now: () => nowMs }
  );
  const headers = calls[0].init.headers as Record<string, string>;
  const body = String(calls[0].init.body);
  const signature = headers[DIGITALSKILLX_SIGNATURE_HEADER].replace("sha256=", "");
  const timestamp = headers[DIGITALSKILLX_TIMESTAMP_HEADER];
  const nonce = headers[DIGITALSKILLX_NONCE_HEADER];
  assert.deepEqual(
    verifyDigitalSkillXHandoff({ secret: SECRET, signature, timestamp, nonce, body, nowSeconds: nowMs / 1000 }),
    { valid: true }
  );
  assert.equal(
    verifyDigitalSkillXHandoff({ secret: SECRET, signature: "a".repeat(64), timestamp, nonce, body, nowSeconds: nowMs / 1000 }).valid,
    false,
    "invalid HMAC must fail"
  );
  assert.equal(
    verifyDigitalSkillXHandoff({ secret: SECRET, signature, timestamp, nonce, body: body.replace("T_mc_hmac", "T_x"), nowSeconds: nowMs / 1000 }).valid,
    false,
    "tampered body must fail"
  );
  assert.equal(
    verifyDigitalSkillXHandoff({ secret: SECRET, signature, timestamp, nonce, body, nowSeconds: nowMs / 1000 + 3600 }).valid,
    false,
    "stale request must fail"
  );
});

await check("M4. masterclass is identified by page slug alone (with exact amount)", () => {
  assert.equal(
    isDigitalSkillXPaystackEvent({
      event: "charge.success",
      data: { reference: "T_mc_slug", amount: 1_499_900, currency: "NGN", page: { slug: DIGITALSKILLX_AI_ADS_PAGE_SLUG } },
    }),
    true
  );
});

await check("M5. masterclass is identified by product_key metadata", () => {
  assert.equal(
    isDigitalSkillXPaystackEvent({
      event: "charge.success",
      data: { reference: "T_mc_key", amount: 1_499_900, currency: "NGN", metadata: { product_key: DIGITALSKILLX_AI_ADS_PRODUCT_KEY } },
    }),
    true
  );
});

await check("M6. amount alone never identifies the masterclass", async () => {
  resetDigitalSkillXForwardCache();
  assert.equal(
    isDigitalSkillXPaystackEvent({
      event: "charge.success",
      data: { reference: "T_amount_only", amount: 1_499_900, currency: "NGN", metadata: {} },
    }),
    false
  );
  const { impl, calls } = stubFetch({ status: 200 });
  const result = await routeDigitalSkillXCharge(
    { reference: "T_amount_only" },
    { verify: async () => masterclassTx({ reference: "T_amount_only", metadata: {}, page: null }), fetchImpl: impl }
  );
  assert.equal(result.outcome, "rejected");
  assert.equal((result as { reason: string }).reason, "product_not_confirmed");
  assert.equal(calls.length, 0);
});

await check("M7. incorrect amount is rejected and never forwarded", async () => {
  resetDigitalSkillXForwardCache();
  const { impl, calls } = stubFetch({ status: 200 });
  const result = await routeDigitalSkillXCharge(
    { reference: "T_mc_low" },
    { verify: async () => masterclassTx({ reference: "T_mc_low", amount: 100_000 }), fetchImpl: impl }
  );
  assert.equal(result.outcome, "rejected");
  assert.equal((result as { reason: string }).reason, "amount_mismatch");
  assert.equal(calls.length, 0);
});

await check("M8. incorrect currency is rejected and never forwarded", async () => {
  resetDigitalSkillXForwardCache();
  const { impl, calls } = stubFetch({ status: 200 });
  const result = await routeDigitalSkillXCharge(
    { reference: "T_mc_usd" },
    { verify: async () => masterclassTx({ reference: "T_mc_usd", currency: "USD" }), fetchImpl: impl }
  );
  assert.equal(result.outcome, "rejected");
  assert.equal((result as { reason: string }).reason, "currency_mismatch");
  assert.equal(calls.length, 0);
});

await check("M9. failed and abandoned masterclass payments are never forwarded", async () => {
  for (const status of ["failed", "abandoned", "pending", "reversed"]) {
    resetDigitalSkillXForwardCache();
    const { impl, calls } = stubFetch({ status: 200 });
    const result = await routeDigitalSkillXCharge(
      { reference: `T_mc_${status}` },
      { verify: async () => masterclassTx({ reference: `T_mc_${status}`, status }), fetchImpl: impl }
    );
    assert.equal(result.outcome, "not_success", status);
    assert.equal(calls.length, 0, status);
  }
});

await check("M10. duplicate webhook forwards the masterclass exactly once", async () => {
  resetDigitalSkillXForwardCache();
  const { impl, calls } = stubFetch({ status: 200, body: '{"enrolled":true}' });
  const verify = async () => masterclassTx({ reference: "T_mc_dupe" });
  const outcomes = [];
  for (let i = 0; i < 4; i += 1) {
    outcomes.push((await routeDigitalSkillXCharge({ reference: "T_mc_dupe" }, { verify, fetchImpl: impl })).outcome);
  }
  assert.deepEqual(outcomes, ["forwarded", "duplicate", "duplicate", "duplicate"]);
  assert.equal(calls.length, 1);
});

await check("M11. temporary handoff failure is retryable and succeeds on retry without a duplicate", async () => {
  resetDigitalSkillXForwardCache();
  const { impl, calls } = flakyFetch(2);
  const verify = async () => masterclassTx({ reference: "T_mc_flaky" });
  const first = await routeDigitalSkillXCharge({ reference: "T_mc_flaky" }, { verify, fetchImpl: impl });
  const second = await routeDigitalSkillXCharge({ reference: "T_mc_flaky" }, { verify, fetchImpl: impl });
  assert.equal(first.outcome, "retryable");
  assert.equal(second.outcome, "retryable");
  assert.equal(hasAlreadyForwarded("T_mc_flaky"), false);
  const third = await routeDigitalSkillXCharge({ reference: "T_mc_flaky" }, { verify, fetchImpl: impl });
  assert.equal(third.outcome, "forwarded");
  assert.equal(hasAlreadyForwarded("T_mc_flaky"), true);
  const fourth = await routeDigitalSkillXCharge({ reference: "T_mc_flaky" }, { verify, fetchImpl: impl });
  assert.equal(fourth.outcome, "duplicate");
  assert.equal(calls.length, 3, "two failed attempts plus one successful delivery");
});

await check("M12. DigitalSkillX 5xx (for example an email failure) is retryable and not cached", async () => {
  resetDigitalSkillXForwardCache();
  const { impl } = stubFetch({ status: 500, body: '{"error":"Access email failed to send."}' });
  const result = await routeDigitalSkillXCharge(
    { reference: "T_mc_5xx" },
    { verify: async () => masterclassTx({ reference: "T_mc_5xx" }), fetchImpl: impl }
  );
  assert.equal(result.outcome, "retryable");
  assert.equal(hasAlreadyForwarded("T_mc_5xx"), false);
});

await check("M13. DigitalSkillX 401 (invalid HMAC or replayed nonce) is surfaced and never cached as done", async () => {
  resetDigitalSkillXForwardCache();
  const { impl } = stubFetch({ status: 401, body: '{"error":"Unauthorized handoff"}' });
  const result = await routeDigitalSkillXCharge(
    { reference: "T_mc_401" },
    { verify: async () => masterclassTx({ reference: "T_mc_401" }), fetchImpl: impl }
  );
  assert.equal(result.outcome, "forwarded");
  assert.equal((result as { status: number }).status, 401);
  assert.equal(hasAlreadyForwarded("T_mc_401"), false);
});

await check("M14. Paystack verify outage is retryable and never forwards", async () => {
  resetDigitalSkillXForwardCache();
  const { impl, calls } = stubFetch({ status: 200 });
  const result = await routeDigitalSkillXCharge(
    { reference: "T_mc_verify_down" },
    { verify: async () => { throw new Error("Paystack API request failed"); }, fetchImpl: impl }
  );
  assert.equal(result.outcome, "retryable");
  assert.equal(calls.length, 0);
});

await check("M15. the two products cannot cross-enrol on a shared price or evidence", async () => {
  resetDigitalSkillXForwardCache();
  const { impl, calls } = stubFetch({ status: 200 });
  // ai-app evidence at the masterclass price must not reach the masterclass course.
  const a = await routeDigitalSkillXCharge(
    { reference: "T_x1" },
    { verify: async () => masterclassTx({ reference: "T_x1", metadata: { product_key: DIGITALSKILLX_AIAPP_PRODUCT_KEY } }), fetchImpl: impl }
  );
  assert.equal(a.outcome, "rejected");
  assert.equal((a as { reason: string }).reason, "amount_mismatch");
  // masterclass evidence at the ai-app price must not reach the ai-app course.
  const b = await routeDigitalSkillXCharge(
    { reference: "T_x2" },
    { verify: async () => masterclassTx({ reference: "T_x2", amount: DIGITALSKILLX_AIAPP_AMOUNT_KOBO }), fetchImpl: impl }
  );
  assert.equal(b.outcome, "rejected");
  assert.equal((b as { reason: string }).reason, "amount_mismatch");
  assert.equal(calls.length, 0);
});

await check("M16. existing ai-app product still routes to its own course", async () => {
  resetDigitalSkillXForwardCache();
  const { impl, calls } = stubFetch({ status: 200 });
  const result = await routeDigitalSkillXCharge(
    { reference: "T_aiapp_regression" },
    {
      verify: async () =>
        masterclassTx({
          reference: "T_aiapp_regression",
          amount: DIGITALSKILLX_AIAPP_AMOUNT_KOBO,
          metadata: { product_key: DIGITALSKILLX_AIAPP_PRODUCT_KEY },
          page: { slug: "aiapp" },
        }),
      fetchImpl: impl,
    }
  );
  assert.equal(result.outcome, "forwarded");
  const body = JSON.parse(String(calls[0].init.body));
  assert.equal(body.product_key, DIGITALSKILLX_AIAPP_PRODUCT_KEY);
  assert.equal(body.course_id, DIGITALSKILLX_AIAPP_COURSE_ID);
  assert.equal(body.amount, DIGITALSKILLX_AIAPP_AMOUNT_KOBO);
});

await check("M17. unknown product at the masterclass price routes nowhere", async () => {
  resetDigitalSkillXForwardCache();
  const { impl, calls } = stubFetch({ status: 200 });
  const result = await routeDigitalSkillXCharge(
    { reference: "T_unknown" },
    {
      verify: async () => masterclassTx({ reference: "T_unknown", metadata: { product: "some-other-course" }, page: { slug: "otherpage" } }),
      fetchImpl: impl,
    }
  );
  assert.equal(result.outcome, "rejected");
  assert.equal(calls.length, 0);
});

await check("M18. LeadThur never claims a masterclass payment and the masterclass never claims LeadThur", () => {
  assert.equal(
    isLeadThurLifetimePaystackCharge({
      reference: "T_mc_guard",
      amount: 1_499_900,
      currency: "NGN",
      metadata: { referrer: MASTERCLASS_REFERRER },
    }),
    false
  );
  // Even with a wrong amount the foreign-product marker keeps LeadThur away.
  assert.equal(
    isLeadThurLifetimePaystackCharge({
      reference: "T_mc_guard_wrong_amount",
      amount: 1_000,
      currency: "NGN",
      metadata: { referrer: MASTERCLASS_REFERRER },
    }),
    false
  );
  const leadthur = [
    { reference: "LP-1786343304640-4WA4OQ", amount: 1_499_900, currency: "NGN", metadata: { product: "leadthur", source: "leadthur_checkout" } },
    { reference: "T486918630228311", amount: 2_500_000, currency: "NGN", metadata: { referrer: "https://paystack.shop/pay/Leadthur" } },
    { reference: "T_mailthur", amount: 1_499_900, currency: "NGN", metadata: { product: "mailthur" } },
    { reference: "T_topup", amount: 1_499_900, currency: "NGN", metadata: { type: "topup" } },
  ];
  for (const charge of leadthur) {
    assert.equal(isDigitalSkillXPaystackEvent({ event: "charge.success", data: charge }), false, charge.reference);
  }
});

await check("M19. forwarded masterclass request leaks no secret", async () => {
  resetDigitalSkillXForwardCache();
  const { impl, calls } = stubFetch({ status: 200 });
  await routeDigitalSkillXCharge(
    { reference: "T_mc_secrets" },
    { verify: async () => masterclassTx({ reference: "T_mc_secrets" }), fetchImpl: impl }
  );
  const serialized = JSON.stringify({ headers: calls[0].init.headers, body: calls[0].init.body });
  assert.ok(!serialized.includes(process.env.PAYSTACK_SECRET_KEY!));
  assert.ok(!serialized.includes(SECRET));
});

console.log(JSON.stringify({ summary: true, passed, failed, total: passed + failed }));
if (failures.length) console.error("\nFailures:\n" + failures.map((f) => ` - ${f}`).join("\n"));
process.exit(failed === 0 ? 0 : 1);
