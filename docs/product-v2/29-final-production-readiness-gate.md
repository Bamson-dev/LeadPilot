# LeadThur Final Pre-Production Gate

**Date:** 2026-08-09  
**Scope:** RC1 + Phase 2 + Phase 2.1 + Phase 2.2 verification only  
**Rule:** No application changes. No merge to `main`. No production deploy.

---

## 1. Executive summary

**NOT READY FOR PRODUCTION PROMOTION**

Staging Phase 2 / 2.1 / 2.2 observability and email attribution are **live and working** on backend SHA `ca166ca`. Controlled staging steps for trial signup, nurture send, search completion, and checkout **initialize** (`payment_initiated`) passed.

Production is **not** ready:

1. Live production backend `https://backend.leadthur.com` returns **503** (`no available server`).
2. Production Supabase has **no** `analytics_events` / `analytics_alerts` / `analytics_tech_snapshots` tables — Phase 2 / 2.1 / 2.2 migrations are **not applied** on production.
3. `origin/staging` and `origin/main` have **diverged**. Staging has Phase 2.2; main has later nurture/search commits staging lacks. A blind promote is unsafe without an explicit merge plan.
4. Full payment → activation → paid search → revenue attribution was **not** completed (safe scope; Paystack initialize works but charge completion was not executed).

---

## 2. Git state

| Item | Value |
|------|--------|
| Current branch | `staging` |
| Local HEAD | `669f579` |
| `origin/staging` | `669f579` |
| `origin/main` | `bc10b0b` |
| Live staging backend SHA | `ca166ca` (docs-only commits after do not rebuild backend) |
| Phase 2.2 app commit | `05ac7fd` (ancestor of tip) |

### Staging contains

| Work | On `origin/staging` |
|------|---------------------|
| Phase 2 (`3877c2d`) | YES |
| Phase 2.1 (`4819ac2`) | YES |
| Phase 2.2 (`05ac7fd`) | YES |
| Built for Your Business (`68dacdc` / `9ba61c3`) | YES |

### Main vs staging

- `main` **does not** contain Phase 2.2 (`05ac7fd`).
- `main` **does** contain post-`v2.0.0` nurture/search commits **not** in staging (e.g. 30-email schedule hardening, nurture pipeline isolation).
- Promoting staging → main requires an explicit merge/rebase review. **Not performed this gate.**

### Uncommitted / untracked (local only)

| Class | Examples |
|-------|----------|
| Unrelated modified | `docs/product-v2/LeadThur-V2-RC1-Release-Sign-off.md` |
| Documentation-only untracked | UI audit docs, prior phase reports, handbooks |
| Generated / media | `LeadThur-Demo.mp4`, `remotion-leadthur/`, `video/`, `.vercel/` |
| Scripts / noise | mock helpers, unmatched reports, verify scripts not in tip |

None of these were promoted. This report is documentation-only.

---

## 3. Release content

| Area | Present in staging tree | Notes |
|------|-------------------------|-------|
| Discovery / Saved Leads / Outreach / Mailboxes / Insights / Affiliate / Billing / Settings / Admin | PASS | Dashboard routes present |
| Public journey (Landing, Free Trial, Checkout, Activate, Blog, About) | PASS | App routes present |
| Built for Your Business | PASS | `frontend/components/public/enterprise-solutions-section.tsx` |
| Phase 2 observability | PASS | routers, taxonomy, migrations 039 |
| Phase 2.1 attribution / timeline / cohorts / health | PASS | polish routes, migration 040 |
| Phase 2.2 email revenue | PASS | nurture attribution + email-revenue API/UI |

**Nothing new was added this gate.**

---

## 4. Staging backend

| Check | Result |
|-------|--------|
| `GET /health` | **PASS** — `gitCommitSha=ca166ca…` |
| `browser` | **PASS** — `ready` |
| `queue.mode` | **PASS** — `bullmq` |
| Redis | **PASS** (inferred via healthy bullmq queue; no separate Redis probe endpoint) |
| `verify-deployment.sh` | **PASS** |
| `/auth/status` | **PASS** — JSON 401 (route registered, not HTML 404) |
| `/balance` | **PASS** — JSON 401 |
| `/auth/usage` | **PASS** — JSON 401 |
| `/mailboxes` | **PASS** — JSON 401 |
| `/search/history` | **PASS** — JSON 401 |
| `/topup/tiers` | **PASS** — 200 tiers JSON |
| `/email-templates` | **PASS** — 200 |
| `/public/blog/posts` | **PASS** — 200 |
| `GET /checkout` | **NOT APPLICABLE** — no GET handler (404 HTML expected) |
| `POST /checkout/initialize` | **PASS** — 200 authorization URL when email provided |

---

## 5. Observability live gate

| Check | Result |
|-------|--------|
| `POST /public/events` | **PASS** — 202 |
| `/admin/observability/*` unauth | **PASS** — 401 |
| `/admin/observability/email-revenue` | **PASS** — 401 |
| Phase 2.1 gate script (`EXPECTED_GIT_SHA=ca166ca`) | **PASS** |

---

## 6. Database / migrations

### Staging (`LeadPilot Staging` / `ptuarufjtjybedmnlyqb`)

| Migration | Applied |
|-----------|---------|
| `analytics_observability` | **PASS** |
| `analytics_attribution_polish` | **PASS** |
| `rls_deny_public_sensitive` | **PASS** |

| Schema check | Result |
|--------------|--------|
| `analytics_events` columns `utm_content`, `utm_term`, `fbclid`, `gclid`, `idempotency_key` | **PASS** |
| RLS enabled on analytics tables | **PASS** |
| Service-role read | **PASS** |
| Anon read | **PASS pattern** — migration revokes `anon`/`authenticated`; no permissive policies found |

### Production (`Lead Rush` / `oytbynwogudfqqaxxrjq`)

| Check | Result |
|-------|--------|
| `analytics_events` | **FAIL** — `to_regclass` = null |
| `analytics_alerts` | **FAIL** — null |
| `analytics_tech_snapshots` | **FAIL** — null |
| Analytics migrations applied | **FAIL** — not in production migration list |

**PRODUCTION MIGRATION (Phase 2/2.1/2.2) = NOT VERIFIED / FAIL**

---

## 7. Security gates

| Script / check | Result |
|----------------|--------|
| `verify-p0-hardening.mjs` | **PASS** (15 evidence checks) |
| `verify-p0-xss.mjs` | **PASS** |
| `verify-observability-privacy.mjs` | **PASS** |
| `verify-observability-phase2.mjs` | **PASS** |
| `verify-phase22-email-attribution.mjs` | **PASS** |
| `verify-security-fixes.mjs` | **NOT VERIFIED** — missing local `supertest` |
| Code forbids `MOCK_*` / `DEMO_MODE` / `ENABLE_TEST_EMAIL` in production | **PASS** (schema) |
| Staging Coolify mock flags | **NOT VERIFIED** (not visible in local `.env.staging`; inferred healthy full API not health-only) |
| Production Coolify env flags | **NOT VERIFIED** (backend 503; UI not opened) |
| `/demo/search` on production | **NOT VERIFIED** (503 on all prod routes) |
| `/admin/test-email` on production | **NOT VERIFIED** (503) |
| Admin JWT required | **PASS** on staging (observability 401) |
| CORS | **PASS** staging — `access-control-allow-origin: https://staging.leadthur.com` |
| Security headers | **PASS** in code (`X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`) |

---

## 8. Resend Pro

| Check | Result |
|-------|--------|
| Staging nurture delivery works (Resend path) | **PASS** — `email_sent` after trial signup |
| Code: nurture = Resend-only | **PASS** |
| Code: transactional = Zepto → Resend fallback | **PASS** (Zepto still present as primary transactional attempt) |
| Local `.env.staging` Resend var names | **NOT VERIFIED** — keys not present locally (Coolify holds runtime secrets) |
| Production Resend env | **NOT VERIFIED** (backend down; Coolify UI not inspected) |
| Config changed this gate | **NOT APPLICABLE** — unchanged |

---

## 9. Trial nurture

| Check | Result |
|-------|--------|
| Max step 30 | **PASS** (`TRIAL_SEQUENCE_MAX_STEP_V3 = 30`) |
| Post-search email | **PASS** |
| Schedule module | **PASS** |
| Conversion stop (`converted` / pause / max step) | **PASS** in `trial-sequence.ts` |
| UTM tagging constants | **PASS** (`trial_nurture_v3`, step content IDs) |
| 30-day attribution window | **PASS** |
| Sequence copy/timing changed this gate | **NOT APPLICABLE** — not changed |

---

## 10. Controlled customer journey (staging)

Safe disposable mailinator account. No mass mail. No real outreach. No completed charge.

| Step | Result |
|------|--------|
| 1. Trial signup | **PASS** — 200 |
| 2. Nurture email send | **PASS** — `email_sent` (`trial_v3_step_1`) |
| 3. Search start | **PASS** — `/freetrial` 201 `searchId=507debd7-…` |
| 4. Search complete | **PASS** — worker `search_completed` for that `search_id` in `analytics_events` |
| 5. Checkout initialize | **PASS** — Paystack `authorizationUrl` + `payment_initiated` |
| 6. Payment completed | **NOT VERIFIED** — charge not completed (safety) |
| 7. Activation | **NOT VERIFIED** |
| 8. Paid search | **NOT VERIFIED** |
| 9. Export | **NOT VERIFIED** |
| 10. Outreach (no send) | **NOT VERIFIED** |

`checkout_started` client event was **not** observed (API-only initialize; no frontend checkout page session).

---

## 11. Email → revenue attribution

| Check | Result |
|-------|--------|
| CTA UTM structure | **PASS** (helper + prior Phase 2.2 verification) |
| `email_clicked` ingest | **PASS** (prior + recent rows) |
| First-touch vs last-click separation | **PASS** (prior controlled smoke) |
| Send → open → click → search chain | **PASS** (partial; see journey) |
| Click → checkout → **payment_completed** → activation → revenue | **NOT VERIFIED** |
| Email Revenue admin association for a paid conversion | **NOT VERIFIED** |

**PAYMENT → REVENUE ATTRIBUTION = NOT VERIFIED**

---

## 12. Admin verification

| Check | Result |
|-------|--------|
| Unauthenticated observability APIs | **PASS** (401) |
| Authenticated Admin UI | **NOT VERIFIED** — no admin creds in local staging env; FE `staging.leadthur.com` returns Vercel SSO 302 |
| DB evidence of events | **PASS** |

**ADMIN UI = NOT VERIFIED**  
**ADMIN API SHAPE = PASS**

---

## 13. Frontend verification

| Check | Result |
|-------|--------|
| Frontend TypeScript / production build | **PASS** (`npm run build`) |
| Staging FE reachability | **PASS shape** — HTTP 302 (Vercel SSO) |
| Exact Vercel production SHA | **NOT VERIFIED** |
| www.leadthur.com HTML | **PASS** — HTTP 200 (FE up; independent of API 503) |

**FRONTEND SHA = NOT VERIFIED**

---

## 14. Production environment verification

| Check | Result |
|-------|--------|
| `GET https://backend.leadthur.com/health` | **FAIL** — 503 `no available server` |
| Observability on production | **FAIL** — 503 |
| Production analytics schema | **FAIL** — tables absent |
| Production Coolify env (Resend, Redis, mocks) | **NOT VERIFIED** |
| Customer Gmail outreach stack untouched | **PASS** (no code changes this gate) |

---

## 15. Deployment path

Documented / observed path:

```text
origin/staging (verify)
  → review + resolve main divergence
  → merge/promote to main
  → production Coolify redeploy (GHA webhook or manual)
  → apply missing production migrations (039/040)
  → /health SHA gate
  → smoke test
```

**This gate did not merge or deploy.**

---

## 16. Rollback verification

| Item | Value |
|------|--------|
| Tag | `v2.0.0` |
| Commit | `bc10b0ba73e56466607e0660141769d562324e80` |
| On `origin/main` | YES |
| Restore method | Redeploy Coolify production to `v2.0.0` / `bc10b0b`; FE via Vercel prior deployment |

**Rollback availability = PASS** (tag/commit documented). Current production outage means rollback may also be needed **now** as an ops action outside this gate.

---

## 17. Full scorecard

| Gate | Result |
|------|--------|
| Git release content | PASS |
| Staging backend | PASS |
| Observability | PASS |
| Phase 2 | PASS |
| Phase 2.1 | PASS |
| Phase 2.2 | PASS |
| Database migrations (staging) | PASS |
| Database migrations (production) | FAIL |
| RLS/security (staging analytics) | PASS |
| P0 hardening | PASS |
| XSS | PASS |
| Resend Pro (staging behavior) | PASS |
| Resend Pro (production env) | NOT VERIFIED |
| Trial nurture | PASS |
| Search | PASS |
| Checkout (initialize) | PASS |
| Payment (completed) | NOT VERIFIED |
| Activation | NOT VERIFIED |
| Email attribution (send/open/click/search) | PASS |
| Revenue attribution (paid) | NOT VERIFIED |
| Admin analytics UI | NOT VERIFIED |
| Admin analytics API | PASS |
| Frontend production build | PASS |
| Frontend production SHA | NOT VERIFIED |
| Production backend | FAIL |
| Production environment | NOT VERIFIED |
| Rollback | PASS |

---

## 18. Known limitations

- Staging and main have diverged; Phase 2.2 is staging-only.
- Production analytics schema missing; even after backend recovery, Phase 2+ cannot store events until migrations 039/040 are applied.
- Payment→activation→revenue not exercised with a completed charge.
- Authenticated Admin UI blocked by missing local admin credentials + Vercel SSO.
- Coolify production/staging env UIs were not inspected this session.
- `GET /checkout` 404 is expected (POST routes only).

---

## 19. Final GO / NO-GO

### Decision

# NOT READY FOR PRODUCTION PROMOTION

### Why

1. **P0 ops:** Production backend is down (503).
2. ~~**P0 data:** Production missing Phase 2/2.1 analytics tables/migrations.~~ → **FIXED 2026-08-09** (`analytics_observability` + `analytics_attribution_polish` applied on production Supabase).
3. ~~**Release hygiene:** Staging/main divergence unresolved.~~ → **Clarified:** `main` tree == merge-base `9ba61c3`; staging adds Phase 2.2 only; merge `staging`→`main` is clean (not executed until backend healthy). See `docs/product-v2/30-production-promotion-readiness.md`.
4. **Journey gap:** Payment completed → activation → revenue attribution remains **NOT VERIFIED**.

### What already works (staging)

- RC1 product surface on staging tip tree  
- Phase 2 / 2.1 / 2.2 live on `ca166ca`  
- `/public/events` 202; observability protected  
- Trial → nurture send → search complete → checkout initialize  
- Email attribution ingest and first-touch / last-click separation  

### Required before PRODUCTION GO

1. Restore production backend health; verify `/health` SHA.  
2. ~~Apply production migrations `039` + `040` (analytics).~~ **DONE**  
3. Reconcile `staging` ↔ `main` via documented safe merge after backend recovery.  
4. Complete one safe payment → activation journey and confirm Email Revenue association.  
5. Verify Coolify production env: no `MOCK_*` / `DEMO_MODE` / `ENABLE_TEST_EMAIL`; Resend vars present (names only).  
6. Confirm frontend production SHA and rollback rehearsal notes.

Until then: **do not merge for production promotion on the basis of this gate.**

**Follow-up report:** `docs/product-v2/30-production-promotion-readiness.md`
