# LeadThur V2 — Phase 2.1 Observability & Product Intelligence Polish

**Date:** 2026-08-07  
**Constraint:** Review/completion only — no product feature, API contract, search, outreach, checkout, or licensing behaviour changes  
**Commit policy:** Local only — do not push until live-data validation

---

## 1. Complete observability audit

Phase 2 foundation was real (schema, ingest, taxonomy, hooks, admin tabs). Phase 2.1 audit found material gaps:

| Area | Pre-2.1 status |
|------|----------------|
| Funnel | Counts only; missing mid-funnel emits; no drop-off/duration/filters |
| Attribution | UTM trio only; no content/term/click IDs; not first-touch persisted |
| Cohorts | Missing |
| Search quality | Lifecycle yes; success mislabeled as fail; no zero/low/large aggregates |
| Customer timeline | Missing |
| License health | Success only |
| Outreach health | Sent/fail yes; opens not in analytics |
| Executive landing | Platform stats only; not obs KPIs |
| Alerts | No ack/resolve; alert→api_error spam; some catalogue keys unevaluated |
| Duplicates | Client+server double counts on checkout/license |

---

## 2. Missing items discovered (prioritized)

**P0:** search success mislabel; dual-emit inflation; missing mid-funnel; alert spam; no ack/resolve; no executive obs landing; no timeline  
**P1:** attribution fields; cohorts; search quality; license/outreach health; funnel filters/duration; checkout abandon emitter  
**P2:** GeoIP country fill; webhook→payment UTM join enrichment; dedicated delivered/bounce/spam SMTP probes

---

## 3. Improvements implemented

- Fixed `job_processing_end` success labeling (worker/inline/recovery + smarter lifecycle)
- Deduped funnel ownership: client `checkout_started` / abandon; server `payment_initiated` / activation
- Removed client `license_activated` (server authoritative)
- Mid-funnel: `freetrial_viewed` on mount; `trial_search_completed` + `results_displayed`
- First-touch attribution (`utm_*`, `fbclid`, `gclid`) + migration `040`
- `email_opened` from open pixel; license failure/device/duplicate events
- `second_visit` / `returning_customer`; dedicated `scroll_depth`
- Alert ack/resolve PATCH; stopped alert→`api_error` spam; wired activation/duration/worker alerts
- Admin: executive dashboard default KPIs; timeline/cohorts/attribution/search-quality/license/outreach tabs
- Funnel: conversion %, drop-off %, avg/median duration, dimension filters

---

## 4. Event taxonomy

See `backend/src/observability/event-taxonomy.ts` — added `returning_customer`, `email_queued`, license health events, funnel includes second visit / returning.

---

## 5. Funnel verification

| Step | Emitter |
|------|---------|
| landing_viewed | marketing page |
| freetrial_viewed | freetrial mount |
| trial_email_submitted / trial_started | client+server same keys |
| trial_search_started / search_started | server |
| trial_search_completed / results_displayed | freetrial finish |
| paywall_viewed | freetrial |
| checkout_started | client page |
| payment_initiated | server (Paystack) / client (Flutterwave) |
| payment_completed | fulfillment/webhooks |
| license_activated | server |
| dashboard_entered | activate success |
| first/second_search | search-ordinals |
| csv_export / mailbox / first_outreach | existing |
| second_visit / returning_customer | page tracker |

---

## 6. Attribution verification

Persisted first-touch in `localStorage` (`lt_analytics_attribution`) and written on every client event. Columns: `utm_content`, `utm_term`, `fbclid`, `gclid` (+ existing source/medium/campaign/referrer/landing). Admin `/attribution` aggregates purchases.

**Debt:** server webhook `payment_completed` rows still often lack UTM unless earlier client session events exist for the same hashed email.

---

## 7. Executive dashboard summary

`/admin/dashboard` now loads `/admin/observability/executive` + infrastructure + KPIs as the top “Today” card row (revenue events, searches, conversion, activated, SMTP, errors, Redis, API latency). Still shows platform overview underneath.

---

## 8. Technical monitoring summary

Unchanged core + activation failures, avg search duration, worker_healthy in infra snapshot/alert eval. SMTP alert uses `smtp_failure` only (no double-count with `email_failed`).

---

## 9. Alert summary

Catalogue unchanged keys; evaluator now covers activation/duration/worker. UI Ack/Resolve via `PATCH /admin/observability/alerts/:id`. Unique open-key index still prevents duplicate open rows.

---

## 10. Performance impact

Still async/batched. Funnel filter queries pull up to 2k rows per step for duration stats — acceptable for admin. No product-path awaits.

---

## 11. Test report

| Check | Result |
|-------|--------|
| Static verify script | Extend + run |
| `tsc` backend/frontend | Run in this pass |
| Staging migration 040 | Applied when approved |
| Live E2E against production traffic | **Not done — do not push until validated** |

---

## 12–13. Bugs found / fixed

| Bug | Fix |
|-----|-----|
| Successful searches → `search_failed` | Pass `success: true` + leadCount; smarter end classifier |
| Checkout/license double counts | Split ownership / remove client activate emit |
| Alert spam via `api_error` | Removed side-effect emit |
| `checkout_abandoned` never fired | Client pagehide abandon |
| Open pixel not analytics | `email_opened` track |
| Scroll polluted `page_view` | `scroll_depth` event |
| `freetrial_viewed` only on signup | Mount-time view |

---

## 14. Remaining technical debt

- Production migrate `039`+`040`
- Attach first-touch attribution onto server payment rows (hash join)
- Bounce/spam/delivered SMTP providers as first-class events
- Browser crash / worker offline active probes (not only inferred)
- Session-true funnel (user progression) vs event-count funnel
- Inactive-user cohort from product DB (not only analytics hashes)

---

## 15. Production readiness verdict

**Phase 2.1 is implementation-complete for audit P0/P1 polish, but NOT push-ready until:**

1. Staging backend deploy with migrations  
2. Manual flow: trial → search → paywall → checkout abandon/pay → activate → dashboard → export → mailbox → outreach open  
3. Admin dashboard + analytics tabs validated against live rows  
4. Confirm search_completed ≫ search_failed under healthy load  

**Verdict:** Conditionally ready for staging verification; hold production push.
