# LeadThur V2 — Phase 2.1 Staging Release Gate Report

**Date:** 2026-08-07  
**Local HEAD:** `4819ac2` (Phase 2.1 polish)  
**Previous Phase 2 commit:** `3877c2d`  
**Constraint:** No new features / redesign / business-logic changes. Release gates only.  
**Push policy:** Local commit only until gates pass — **push still blocked**.

---

## 1. Migration status — PASS

| Item | Status |
|------|--------|
| Migration `039` (`analytics_observability`) | Applied on LeadPilot Staging (`ptuarufjtjybedmnlyqb`) — recorded as `analytics_observability` |
| Migration `040` (`analytics_attribution_polish`) | **Applied successfully** — recorded as `analytics_attribution_polish` (`20260807075248`) |
| `analytics_events` table | Present |
| Attribution columns | Present: `utm_content`, `utm_term`, `fbclid`, `gclid` (+ existing `utm_source/medium/campaign`, `referrer`, `landing_page`) |
| Indexes | Present: idempotency unique, name/category/session/search/correlation, email_hash/license/utm_source time indexes from 040 |
| RLS | Enabled on `analytics_events`, `analytics_alerts`, `analytics_tech_snapshots` |
| Policies | No public policies (deny-by-default with RLS) |
| Grants | `anon`/`authenticated` have no SELECT; `service_role` has INSERT/SELECT/UPDATE as expected |
| Triggers | None (by design — migrations define none) |
| Schema smoke | Insert+delete with attribution columns succeeded (`remaining_smoke=0`) |

**Schema matches code expectations** for `track.ts` / public ingest / admin queries.

---

## 2. Deployment status — FAIL (blocked)

| Check | Result |
|-------|--------|
| Staging backend URL | `https://staging-backend.leadthur.com` — healthy (`status: ok`) |
| Staging backend SHA | `79b7392` (admin polish) |
| Required SHA for Phase 2.1 | `4819ac2` (local, **2 commits ahead of `origin/staging`**) |
| Staging frontend | `https://staging.leadthur.com` — HTTP **302** (Vercel SSO protection) |
| `POST /public/events` | **404** (Phase 2 ingest not deployed) |
| `GET /admin/observability/*` | **404** (Phase 2 admin API not deployed) |
| Env vars | Backend health shows browser ready, Deepseek configured, BullMQ mode, freeTrialIpCapReady=true — but Phase 2.1 routes absent |
| Analytics tables | Exist in staging DB (migration done) but **app code writing to them is not live** |

**Why deploy failed:** Staging backend is Coolify git-triggered from `origin/staging`. Frontend is Vercel on the `staging` branch. Both require a **git push**. Standing order is **do not push until every release gate passes**, so deploy was intentionally not performed.

Probe script added: `backend/scripts/verify-phase21-staging-gates.sh`

---

## 3. Live validation results — BLOCKED / NOT RUN

Full journey (Landing → Trial → Search → Paywall → Checkout → Payment → Activation → Dashboard → Discovery → Save → CSV → Mailbox → Outreach → Open → Affiliate → Billing → Settings → Logout/Login) **cannot be validated against Phase 2.1 behaviour** until `4819ac2` is deployed.

| Gate | Status |
|------|--------|
| End-to-end product journey on Stage 2.1 code | **Blocked** (backend still `79b7392`) |
| Frontend journey under SSO | **Blocked** (302 to Vercel SSO; needs human SSO session) |
| Payment / mailbox / outreach live paths | **Not executed** (would exercise pre-2.1 binary) |

---

## 4. Analytics validation — BLOCKED

Cannot confirm “exactly one event per step,” attribution persistence, timeline, funnel, cohorts, or executive KPIs on staging because:

1. Event emitters / ingest routes are not deployed (`/public/events` 404).  
2. Admin observability APIs are not deployed (`/admin/observability/*` 404).  

Local static checks:

| Script | Result |
|--------|--------|
| `node backend/scripts/verify-observability-phase2.mjs` | **PASS** |
| `node backend/scripts/verify-observability-privacy.mjs` | **PASS** |
| Backend/frontend `tsc --noEmit` (prior pass on 2.1 commit) | **PASS** |

---

## 5. Dashboard validation — BLOCKED

Executive dashboard + analytics workspace tabs exist in local code (`4819ac2`) but are **not live** on staging frontend/backend.

---

## 6. Alert validation — BLOCKED

Alert catalogue / ack-resolve / infra evaluation code is in `4819ac2` only. Staging process does not load it yet.

---

## 7. Remaining issues / release blockers

1. **Push not authorized** → Coolify + Vercel cannot pick up `3877c2d` + `4819ac2`.  
2. After push: confirm Coolify staging service redeploys to SHA `4819ac2` (or later).  
3. After FE deploy: bypass/complete Vercel SSO to run browser journey.  
4. After deploy: re-run `EXPECTED_GIT_SHA=4819ac2 bash backend/scripts/verify-phase21-staging-gates.sh` — expect `/public/events` → **202**, `/admin/observability/overview` → **401** (not 404).  
5. Then execute full live journey + admin analytics checks listed in Task 3–6.  
6. No product bugs were introduced/fixed in this gate pass (gate-only).  

---

## 8. Final Phase 2.1 GO / NO-GO decision

# **NO-GO for staging release**

| Gate | Decision |
|------|----------|
| Migration 040 | **GO** |
| Schema/security alignment | **GO** |
| Static verification scripts | **GO** |
| Staging deploy (FE+BE revision match) | **NO-GO** |
| Live journey + analytics accuracy | **NO-GO** (blocked on deploy) |
| Dashboards / alerts live validation | **NO-GO** (blocked on deploy) |

**Overall: NO-GO.**

### Unblock sequence (when push is approved)

```bash
# 1) Push staging branch (explicit approval required)
git push -u origin staging

# 2) Wait for Coolify + Vercel
EXPECTED_GIT_SHA=$(git rev-parse HEAD) bash backend/scripts/verify-phase21-staging-gates.sh
# Expect: SHA match, POST /public/events = 202, admin observability = 401

# 3) Human SSO into staging.leadthur.com and run Task 3 journey
# 4) Admin: validate funnel/timeline/cohorts/executive/search/outreach/license/alerts
# 5) Re-issue this report as GO only when every gate is green
```

---

## Artifacts

- Migration applied: `analytics_attribution_polish` on staging Supabase  
- Gate probe: `backend/scripts/verify-phase21-staging-gates.sh`  
- Local commits pending push: `3877c2d`, `4819ac2` (+ this report commit)
