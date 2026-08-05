# LeadThur V2 RC1 — Staging Release Report

**Date:** 2026-08-05  
**Objective:** Deploy approved RC1 to staging only (no production merge, no new features)  
**Branch:** `staging`  
**Release Candidate tip (git):** `a39a2263435cf162e065f25cab75afe57ebdefad`

---

## 1. Deployment summary

| Step | Result |
|------|--------|
| Pre-release: working tree for RC1 code | Clean after release-blocker commit |
| Pre-release: P0 evidence scripts | **PASS** (`verify-p0-hardening.mjs`, `verify-p0-xss.mjs`) |
| Pre-release: TypeScript | **PASS** (frontend + backend `tsc --noEmit`) |
| Pre-release: ESLint | **PASS** (`next lint --quiet`) |
| Pre-release: Frontend production build | **PASS** after sanitizer fix (see below) |
| Git push `origin/staging` | **Done** — milestone commits preserved (no squash/force) |
| Frontend deploy (Vercel ← `staging`) | **Triggered by push** — live URL behind Vercel Deployment Protection (SSO); commit on host not verifiable without SSO |
| Backend deploy (Coolify staging) | **Not completed** — no staging Coolify webhook in GitHub Actions; live BE still on older SHA |

### Release-blocker commit (post `e501021`)

`a39a226` — `fix(v2): server-safe blog sanitizer for RC1 staging build`

- Replaced `isomorphic-dompurify` (jsdom `browser/default-stylesheet.css` break on Vercel/Next build) with server-safe `sanitizeBlogHtml`.
- P0-5 XSS stripping retained; evidence script updated.
- **No product/UI/workflow changes.**

### Milestone commits on `origin/staging` (intact)

1. `f9b1d50` — Discovery Workspace  
2. `b412f8e` — Saved Leads Workspace  
3. `54509f5` — Outreach Workspace  
4. `e804c46` — Mailboxes Workspace  
5. `fd1a866` — RC1 product QA  
6. `e501021` — P0 production hardening  
7. `a39a226` — staging build sanitizer fix  

---

## 2. Git SHA deployed

| Surface | SHA | Match RC1? |
|---------|-----|------------|
| `origin/staging` | `a39a2263435cf162e065f25cab75afe57ebdefad` | **Yes** |
| Staging frontend (expected Vercel target) | `a39a226…` (branch tip) | **Expected** — confirm in Vercel dashboard after SSO |
| Staging backend `/health.gitCommitSha` | `a340bf5d6d9d850c45a587e7d6c67788c0148151` | **No** — pre-RC1 |

---

## 3. Staging URLs

| Service | URL |
|---------|-----|
| Frontend | https://staging.leadthur.com |
| Backend | https://staging-backend.leadthur.com |

Frontend requires Vercel team SSO to load the app.

---

## 4. Smoke test results

### Backend boot / health (live)

| Check | Result |
|-------|--------|
| `GET /health` | **PASS** — 200, `status=ok`, browser ready, BullMQ |
| `GET /api/health` | **PASS** — 200 |
| `GET /health/ready` | **PASS** — 200 |
| `verify-deployment.sh` vs staging-backend | **PASS** (health suite) |
| Backend SHA == RC1 | **FAIL** — `a340bf5` ≠ `a39a226` |
| `GET /auth/status` (invalid license) | **PASS** — 401 `INVALID_LICENSE` |

### P0 live on staging backend (critical)

| P0 | Expected on RC1 | Observed on live staging BE | Result |
|----|-----------------|----------------------------|--------|
| P0-6 Admin `/admin/test-email` gated | 401/403 or disabled in prod-like env | **HTTP 200** — sends mail without admin auth | **FAIL** (old BE) |

This proves RC1 backend (including P0 hardening) is **not** running on staging-backend yet.

### Frontend / product matrix

| Area | Result | Notes |
|------|--------|-------|
| Authentication (Trial / Checkout / Activate) | **BLOCKED** | Vercel SSO gate; no authenticated session in automation |
| Discovery (Search / Filters / Saved / Details / Export) | **BLOCKED** | Same |
| Mailboxes (Connect / Disconnect / SMTP) | **BLOCKED** | Same |
| Outreach (Compose / Preview / Send / History) | **BLOCKED** | Same |
| Payments (Credits / Top-ups) | **BLOCKED** | Same |
| Navigation Desktop / Tablet / Mobile | **BLOCKED** | Same |
| Browsers Chrome / Safari / Firefox / Edge | **BLOCKED** | Same |

Local pre-deploy gates (tsc / lint / next build / P0 scripts) **passed** on RC1 tip before push.

### Console / routes / hydration / layout

Not observed on live staging FE (SSO). No evidence of regressions from local production build route table (includes `/dashboard`, `/dashboard/saved`, `/dashboard/outreach`, `/dashboard/mailboxes`).

---

## 5. Failed / incomplete tests

1. **Staging backend not on RC1 SHA** — Coolify staging not auto-deployed from `staging` push.  
2. **P0-6 still open on live staging BE** — unauthenticated `/admin/test-email` succeeded (evidence of pre-RC1 binary).  
3. **Full product smoke matrix** — blocked by Vercel Deployment Protection SSO.  
4. **Frontend live SHA confirmation** — blocked by SSO (dashboard required).  
5. Incorrect probe paths `/api/plans`, `/api/auth/status` → 404 (routes are not under `/api` prefix for those; not a product failure).

---

## 6. Known P1 issues (carry-forward; not fixed in this release)

From `11-rc1-production-readiness-report.md` / `12-phase12-p0-hardening-evidence.md` (still open by design):

- **P1-1** Device binding not enforced on `requireLicense`  
- **P1-3** License in SSE query string  
- **P1-4** Paystack bad signature → HTTP 200  
- **P1-7/8** Mailbox error/disconnect UX gaps  
- **P1-12** No staging BE GitHub Action; prod CI is webhook+health only  
- **P1-14** No rollback runbook  

P0 items are closed **in git** with evidence; they are **not yet live on staging-backend** until Coolify redeploy.

---

## 7. Recommended next actions

1. **Coolify:** Open staging **backend** service → confirm Git branch = `staging` → **Redeploy** (force rebuild).  
2. **Verify:** `curl -sS https://staging-backend.leadthur.com/health | jq .gitCommitSha` → must equal `a39a2263435cf162e065f25cab75afe57ebdefad`.  
3. **Confirm P0-6 live:** `POST /admin/test-email` without admin JWT must **not** send (401/403/404/disabled). Ensure `ENABLE_TEST_EMAIL` is unset/false on staging Coolify if unwanted.  
4. **Vercel:** Confirm deployment for commit `a39a226` succeeded for `staging.leadthur.com`.  
5. **Human SSO smoke:** Complete the full matrix in §4 on staging after BE SHA matches.  
6. **Do not** merge `staging` → `main` / production until smoke + P1 go/no-go checklist pass.  
7. **Ops follow-up:** Add `COOLIFY_STAGING_DEPLOY_WEBHOOK_URL` + GHA on `staging` (closes P1-12 staging gap).

---

## 8. Go / No-Go for Production

### **NO-GO** for production cutover.

**Reasons:**

1. Staging backend is not running RC1 (`a340bf5` vs `a39a226`).  
2. Live staging still exhibits open `/admin/test-email` (P0-6 regression vs git).  
3. Full staging product smoke not executed (Vercel SSO + BE lag).  

### Staging release status

| Question | Answer |
|----------|--------|
| Is RC1 **on GitHub `staging`?** | **Yes** (`a39a226`) |
| Is RC1 suitable for **final validation once BE redeployed?** | **Yes** (code + local gates green) |
| Is staging environment **fully on RC1 today?** | **No** — frontend pending SSO confirm; backend pending Coolify redeploy |
| Production promote? | **No-Go** |

---

## Operator checklist (complete before claiming “RC1 on staging”)

- [ ] Coolify staging BE redeployed to `a39a226`  
- [ ] `/health.gitCommitSha` matches  
- [ ] `/admin/test-email` no longer open  
- [ ] Vercel FE deployment green for `a39a226`  
- [ ] SSO sign-in + full product smoke matrix signed off  
- [ ] No unexpected console / failed API / hydration errors during smoke  
