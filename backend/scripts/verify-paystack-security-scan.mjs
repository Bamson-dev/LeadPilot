#!/usr/bin/env node
/**
 * Static security scan for the Paystack -> DigitalSkillX routing path.
 * Fails the build if a known-dangerous pattern reappears.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => fs.readFileSync(path.join(root, rel), "utf8");

let pass = true;
function check(label, condition, detail = "") {
  if (condition) {
    console.log(JSON.stringify({ label, pass: true }));
  } else {
    pass = false;
    console.log(JSON.stringify({ label, pass: false, error: detail }));
  }
}

const webhook = read("src/api/webhook-router.ts");
const forward = read("src/services/paystack-digitalskillx-forward.ts");
const handoff = read("src/services/digitalskillx-handoff.ts");
const guard = read("src/services/paystack-product-guard.ts");

check(
  "Paystack signature compared in constant time",
  webhook.includes("safeEqualHex(signature, expectedHash)") &&
    !/signature\s*!==\s*expectedHash/.test(webhook),
  "webhook-router must use safeEqualHex, not !=="
);

check(
  "DigitalSkillX routing runs only after the charge.success gate",
  webhook.indexOf('event.event !== "charge.success"') <
    webhook.indexOf("isDigitalSkillXPaystackEvent(event)"),
  "failed/abandoned charges must never reach DigitalSkillX"
);

check(
  "DigitalSkillX routing re-verifies against the Paystack API",
  forward.includes("verifyTransaction") && forward.includes("paystack_verify_failed"),
  "router must call Paystack verify before fulfillment"
);

check(
  "Amount and currency are enforced on verified data",
  forward.includes("amount_mismatch") && forward.includes("currency_mismatch"),
  "verified amount/currency checks missing"
);

check(
  "Handoff signature binds timestamp and nonce",
  handoff.includes("${params.timestamp}.${params.nonce}.${params.body}"),
  "replay protection material is incomplete"
);

check(
  "Handoff uses timing-safe comparison",
  handoff.includes("crypto.timingSafeEqual"),
  "signature comparison must be constant time"
);

check(
  "Handoff enforces a freshness window",
  handoff.includes("DIGITALSKILLX_MAX_CLOCK_SKEW_SECONDS") && handoff.includes("stale_timestamp"),
  "missing clock-skew rejection"
);

check(
  "No secret material is placed in the forwarded body",
  !/PAYSTACK_SECRET_KEY|SUPABASE_SERVICE_KEY|JWT_SECRET/.test(forward),
  "forward module references a secret env var"
);

check(
  "Secrets are not logged",
  !/logger\.[a-z]+\([^)]*SECRET/i.test(forward) && !/logger\.[a-z]+\([^)]*SECRET/i.test(handoff),
  "a logger call may include secret material"
);

check(
  "DigitalSkillX markers keep charges out of LeadThur fulfillment",
  guard.includes("isDigitalSkillXPaystackEvent") && guard.includes("return false"),
  "LeadThur guard must exclude DigitalSkillX charges"
);

check(
  "Fulfillment is only cached after a 2xx acknowledgement",
  /result\.status >= 200 && result\.status < 300[\s\S]{0,120}markForwarded/.test(forward),
  "idempotency must not be recorded for failed handoffs"
);

check(
  "Course id is server-side only",
  forward.includes("DIGITALSKILLX_AIAPP_COURSE_ID") &&
    !/req\.(body|query|params)/.test(forward),
  "course id must never come from a request"
);

process.exit(pass ? 0 : 1);
