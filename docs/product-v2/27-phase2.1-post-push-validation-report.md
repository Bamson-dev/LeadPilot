# LeadThur V2 — Phase 2.1 Post-Push Validation Report

**Date:** 2026-08-07  
**Approved commits:** `3877c2d` → `4819ac2` → `8e8a0d3`  
**Target SHA:** `8e8a0d3a8d2b57ddb3466d7e27a377c89e462c58`  
**Scope:** Validation only — no new features, redesign, or refactor.

---

## Executive summary

**Phase 2.1 decision: NO-GO**

Git push to `origin/staging` succeeded (branch was already at target SHA). **Coolify staging backend did not redeploy** within 15+ minutes of monitoring. Live staging still runs pre-Phase-2 binary `79b7392`, so Phase 2.1 observability routes, event ingest, and admin analytics APIs are **not available** for validation.

---

## 1. Push status — PASS

| Item | Result |
|------|--------|
| Local HEAD | `8e8a0d3` |
| Remote `origin/staging` | `8e8a0d3` (matches) |
| Push command | `Everything up-to-date` (commits were already on remote) |

---

## 2. Deployment status — FAIL

### Backend (Coolify)

| Check | Expected | Observed |
|-------|----------|----------|
| Health SHA | `8e8a0d3…` | **`79b7392…`** |
| Poll duration | Deploy within ~15 min | **No change after 30 polls (~15 min)** |
| `POST /public/events` | 202 | **404** |
| `GET /admin/observability/overview` | 401 | **404** |
| `GET /admin/observability/executive` | 401 | **404** |
| `GET /admin/observability/funnels` | 401 | **404** |

Health at time of report:

```json
{
  "status": "ok",
  "gitCommitSha": "79b7392112035c91fdd8fcb91494d972ca06b472",
  "timestamp": "2026-08-07T09:14:06.231Z"
}
```

**Conclusion:** Coolify staging service has **not** picked up `origin/staging` tip. Manual redeploy in Coolify UI (or fix git webhook / branch binding) is required before Phase 2.1 validation can proceed.

### Frontend (Vercel)

| Check | Result |
|-------|--------|
| `https://staging.leadthur.com` | HTTP **302** → Vercel SSO |
| Deployment SHA | **Unverifiable** without Vercel dashboard access / SSO bypass |
| Vercel CLI | No `VERCEL_TOKEN` available in environment |

---

## 3. Migration status — PASS (from prior gate)

Migration `040` (`analytics_attribution_polish`) applied on LeadPilot Staging:

- `analytics_events` with `utm_content`, `utm_term`, `fbclid`, `gclid`
- Indexes: email_hash, license, utm_source time
- RLS enabled; `anon`/`authenticated` cannot SELECT

Schema is ready; application code to write/read is not deployed.

---

## 4. Gate script results — FAIL

```bash
EXPECTED_GIT_SHA=8e8a0d3 bash backend/scripts/verify-phase21-staging-gates.sh
```

| Gate | Result |
|------|--------|
| Backend SHA match | **FAIL** (`79b7392` ≠ `8e8a0d3`) |
| Frontend HTTP | 302 (SSO) |
| Admin observability | 404 |
| Public events ingest | 404 |

---

## 5. Static verification — PASS

| Script | Result |
|--------|--------|
| `verify-observability-phase2.mjs` | PASS |
| `verify-observability-privacy.mjs` | PASS |

These validate local code/schema wiring only, not live staging behaviour.

---

## 6. Live customer journey — NOT RUN

Full journey (Landing → Trial → Search → Paywall → Checkout → Activation → Dashboard → Discovery → Save → Export → Mailbox → Outreach → Open → Affiliate → Billing → Settings → Logout/Login) **blocked** because:

1. Backend lacks Phase 2 routes (`/public/events`, observability admin APIs).
2. Frontend requires Vercel SSO for browser access.

---

## 7. Analytics / dashboard / alert validation — NOT RUN

Cannot verify:

- One event per funnel step
- Attribution persistence
- Customer timeline, cohorts, executive KPIs
- Search quality, outreach health, license health
- Alert ack/resolve

**Reason:** Staging process still serves `79b7392` (pre-Phase-2 observability).

---

## 8. Remaining issues / required actions

1. **Manual Coolify redeploy** staging backend from `origin/staging` @ `8e8a0d3`.
2. Confirm `/health` reports `gitCommitSha` starting with `8e8a0d3`.
3. Re-run:
   ```bash
   EXPECTED_GIT_SHA=8e8a0d3 bash backend/scripts/verify-phase21-staging-gates.sh
   ```
   Expect: SHA match, `POST /public/events` = **202**, admin observability = **401**.
4. Confirm Vercel deployment for `staging` branch @ `8e8a0d3` (dashboard; SSO bypass for QA).
5. Execute full live journey + admin analytics validation checklist.
6. Only then re-issue report with **Phase 2.1 GO**.

---

## 9. Final decision

# **Phase 2.1 — NO-GO**

| Gate | Status |
|------|--------|
| Git push to `origin/staging` | **GO** |
| Migration 040 on staging DB | **GO** |
| Coolify backend deploy to `8e8a0d3` | **NO-GO** |
| Vercel frontend deploy verified | **NO-GO** (unverified) |
| Gate script (SHA, 202, 401) | **NO-GO** |
| Live journey + analytics accuracy | **NO-GO** (blocked) |

**Do not declare production readiness for Phase 2.1 until Coolify redeploy completes and live validation passes.**
