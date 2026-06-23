#!/usr/bin/env node
/**
 * Verifies MailThur Paystack metadata detection does not affect LeadThur events.
 */
import assert from "node:assert/strict";

function parsePaystackMetadata(metadata) {
  if (!metadata) return undefined;
  if (typeof metadata === "string") {
    try {
      return JSON.parse(metadata);
    } catch {
      return undefined;
    }
  }
  if (typeof metadata === "object") return metadata;
  return undefined;
}

function isMailthurPaystackEvent(metadata) {
  const parsed = parsePaystackMetadata(metadata);
  return parsed?.product === "mailthur";
}

let pass = true;

function check(label, fn) {
  try {
    fn();
    console.log(JSON.stringify({ label, pass: true }));
  } catch (err) {
    pass = false;
    console.log(
      JSON.stringify({
        label,
        pass: false,
        error: err instanceof Error ? err.message : String(err),
      })
    );
  }
}

check("mailthur metadata forwards", () => {
  assert.equal(isMailthurPaystackEvent({ product: "mailthur" }), true);
});

check("LeadThur lifetime checkout is not forwarded", () => {
  assert.equal(isMailthurPaystackEvent({ product: "LeadThur Lifetime" }), false);
});

check("LeadThur topup metadata is not forwarded", () => {
  assert.equal(isMailthurPaystackEvent({ type: "topup", tierId: "starter" }), false);
});

check("missing metadata is not forwarded", () => {
  assert.equal(isMailthurPaystackEvent(undefined), false);
});

check("stringified mailthur metadata forwards", () => {
  assert.equal(
    isMailthurPaystackEvent(JSON.stringify({ product: "mailthur", plan: "pro" })),
    true
  );
});

check("case-sensitive product value", () => {
  assert.equal(isMailthurPaystackEvent({ product: "MailThur" }), false);
  assert.equal(isMailthurPaystackEvent({ product: "MAILTHUR" }), false);
});

process.exit(pass ? 0 : 1);
