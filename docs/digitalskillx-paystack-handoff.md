# DigitalSkillX fulfillment handoff (receiver spec)

LeadThur owns the single Paystack webhook (`https://backend.leadthur.com/webhooks/paystack`).
When a charge is verified as the DigitalSkillX product, LeadThur performs a signed
server-to-server call to DigitalSkillX. This document is the contract the
DigitalSkillX receiver must implement.

## Endpoint

```
POST https://www.digitalskillx.com/api/webhooks/paystack
Content-Type: application/json
```

## Headers

| Header | Meaning |
| --- | --- |
| `x-leadthur-signature` | `sha256=<hex>` HMAC-SHA256 of the signed material |
| `x-leadthur-timestamp` | Unix seconds when the request was signed |
| `x-leadthur-nonce` | Unique per request (UUID) |
| `x-leadthur-event-id` | Paystack transaction reference — the idempotency key |
| `x-leadthur-product-key` | Always `build-software-with-ai` |

Signed material is the exact string:

```
`${timestamp}.${nonce}.${rawRequestBody}`
```

The shared secret is `DIGITALSKILLX_FORWARD_SECRET`, identical on both sides.

## Body

Only what enrollment needs. No secrets, no LeadThur internals.

```json
{
  "event": "charge.success",
  "source": "leadthur-paystack-router",
  "product_key": "build-software-with-ai",
  "course_id": "9818cf69-4158-40b5-8926-54a3be38f306",
  "reference": "T123456789",
  "amount": 4999900,
  "currency": "NGN",
  "status": "success",
  "paid_at": "2026-08-29T09:00:00.000Z",
  "customer": { "email": "student@example.com" }
}
```

## Required receiver checks

Reject with `401` unless all of these hold:

1. `x-leadthur-signature` matches the recomputed HMAC, compared in constant time.
2. `|now - x-leadthur-timestamp| <= 300` seconds.
3. `x-leadthur-nonce` has not been seen before (persist nonces for at least 24h).

Reject with `400` unless:

4. `product_key === "build-software-with-ai"`.
5. `amount === 4999900` and `currency === "NGN"`.
6. `course_id` matches the DigitalSkillX mapping for that product key —
   never trust the incoming `course_id` on its own.

`product_key`, `course_id` and `amount` must never be accepted from a browser.

## Fulfillment

Keyed on `reference`, so repeated deliveries are safe:

1. Normalize the customer email (trim + lowercase).
2. Find the student, creating one through the existing purchase flow if absent.
3. Enroll into course `9818cf69-4158-40b5-8926-54a3be38f306`.
4. Record the transaction against `reference`.
5. Send the course-access email only on first fulfillment.
6. Return `2xx`.

## Response contract

| Status | LeadThur behaviour |
| --- | --- |
| `2xx` | Marked fulfilled; never re-sent for that reference |
| `4xx` | Surfaced to Paystack; **not** marked fulfilled |
| `5xx` or timeout | LeadThur replies `503` so Paystack retries delivery |

Because a non-2xx is never cached, a retry after an outage re-delivers the same
reference — the receiver's own idempotency is what prevents a duplicate
enrollment or a duplicate access email.

## Optional legacy mode

If `DIGITALSKILLX_FORWARD_SECRET` is unset, LeadThur falls back to forwarding the
original raw Paystack body with the `x-paystack-signature` header, which requires
DigitalSkillX to hold the same Paystack secret key. Prefer the signed mode.
