# LeadThur V2 Phase 12 — P0 Hardening Evidence Report

**Date:** 2026-08-05  
**Commit message:** `fix(v2): production hardening and P0 security remediation`  
**Scope:** Close every P0 from `11-rc1-production-readiness-report.md`  
**Constraint:** No new features / UI redesign / workflow changes except security-required

---

## Verdict after remediation

| P0 | Status | Why no longer exploitable |
|----|--------|---------------------------|
| P0-1 Search metering fail-open | **CLOSED** | DB/limit errors return **503** `METERING_UNAVAILABLE`; no `"unknown"` license / 99 remaining |
| P0-2 Top-up credit trust | **CLOSED** | Credits = **tier catalog only**; paid amount must meet `amountKobo` / `amountUsd`; `metadata.credits` ignored |
| P0-3 MOCK / test modes | **CLOSED** | Production boot **refuses** `MOCK_OUTREACH_SEND=1`, `MOCK_MAILBOX_SMTP=1`, `ENABLE_TEST_EMAIL`, `DEMO_MODE`, staging `FRONTEND_URL` |
| P0-4 RLS on sensitive tables | **CLOSED** | RLS enabled + `REVOKE` from `anon`/`authenticated` on prod + staging; migration `038` + startup apply |
| P0-5 XSS × localStorage | **CLOSED** | Blog HTML sanitized (DOMPurify); site scripts allowlisted + theft-pattern blocked |
| P0-6 Open `/admin/test-email` | **CLOSED** | Requires `NODE_ENV !== production` **and** `ENABLE_TEST_EMAIL=true` **and** `requireAdminAuth` |

**Auth/session hardening (Phase 12 item 5):** XSS theft vectors closed; `/auth` rate-limited. Full HttpOnly session redesign deferred (would change activation workflow) — remaining residual is P1 device binding / SSE query params.

---

## Evidence by issue

### P0-1 — Search metering fail-closed

**Change:** `backend/src/middleware/check-search-limit.ts`

**Before (exploitable):**
- License DB error → `next()` with `licenseId: "unknown"`, `searchesRemaining: 99`
- Limit check error → continue as allowed
- Outer catch → `next()` (allow)

**After:**
- All of the above → `503` + `code: "METERING_UNAVAILABLE"`
- No invented license identity

**Evidence command:**
```bash
node backend/scripts/verify-p0-hardening.mjs
# PASS: P0-1 …
```

**Exploit attempt now:** Attacker cannot obtain free searches during Supabase outage; search API returns 503 until metering recovers.

---

### P0-2 — Payment credit verification

**Change:** `backend/src/services/topup-service.ts` (`resolveVerifiedTopUpTier` + `fulfillTopUpPayment`)  
**Also:** Flutterwave webhook no longer passes `metadata.credits` (`webhook-router.ts`)

**Before:** `credits = Number(metadata.credits)` — client/webhook meta could claim 2100 after paying for 300.

**After:**
1. Resolve tier from `tierId` or payment reference  
2. `credits = tier.credits` only  
3. Reject if paid amount < tier `amountUsd` (FLW) or `amountKobo` (Paystack)

**Evidence:**
```bash
node backend/scripts/verify-p0-hardening.mjs
# PASS: P0-2 attack simulation: metadata.credits=2100 ignored; tier grants 300
# PASS: P0-2 underpay rejected: $15 for topup_2100 fails
```

---

### P0-3 / P0-6 — Environment + test-email safety

**Changes:**
- `backend/src/config/env.ts` — production `superRefine` rejects MOCK_*, ENABLE_TEST_EMAIL, DEMO_MODE, staging FRONTEND_URL  
- `backend/.env.example` — MOCK flags commented; never default on  
- `backend/src/api/admin-router.ts` — test-email only if non-prod + ENABLE_TEST_EMAIL + `requireAdminAuth`  
- `backend/src/server.ts` — `rateLimit` on `/auth`

**Exploit attempt now:**
- Prod with `MOCK_OUTREACH_SEND=1` → **process refuses to start**  
- `/admin/test-email` without admin JWT → **401**  
- Staging FRONTEND_URL alone no longer opens the route  

---

### P0-4 — Supabase RLS

**Artifacts:**
- `supabase/migrations/038_rls_deny_public_sensitive.sql`  
- Applied via startup migrations (`run-startup-migrations.ts`)  
- **Applied live** to:
  - Lead Rush (prod) `oytbynwogudfqqaxxrjq`
  - LeadPilot Staging `ptuarufjtjybedmnlyqb`

**Verified SQL (both projects):**

| table | rls_enabled |
|-------|-------------|
| connected_mailboxes | true |
| outreach_accounts | true |
| sent_emails | true |
| blog_posts | true |
| topup_purchases | true |
| site_settings | true |
| search_history | true |
| lead_statuses | true |

**Exploit attempt now:** Anon key cannot `SELECT` mailbox ciphertext / sent mail / etc. via PostgREST (RLS on + grants revoked). Backend `service_role` continues to work.

---

### P0-5 — XSS / session theft surface

**Changes:**
- `frontend/lib/blog-content.ts` — `sanitizeBlogHtml` via `isomorphic-dompurify` inside `prepareArticleContent`  
- `frontend/lib/site-scripts-safety.ts` — host allowlist + block `localStorage`/`document.cookie` inline scripts  
- `frontend/app/layout.tsx` — uses safety filters  

**Evidence:**
```bash
cd frontend && node ../backend/scripts/verify-p0-xss.mjs
# PASS: DOMPurify strips script tags and onerror handlers from blog HTML
# PASS: theft pattern catches localStorage license steal
# PASS: external script host allowlist rejects evil.example.com
```

**Exploit attempt now:**
- Blog `<script>localStorage.getItem('leadthur_key')</script>` → stripped before render  
- Site script from `evil.example.com` → not injected  
- Inline script reading `localStorage` → filtered out  

Residual: license still in localStorage (P1 architecture); XSS that does not go through these filters would still be dangerous — main stored XSS paths are closed.

---

## Re-run: security audit (delta)

| Prior finding | Status |
|---------------|--------|
| Fail-open metering | Fixed |
| Top-up metadata credits | Fixed |
| MOCK defaults / open test-email | Fixed |
| No RLS on mailboxes+ | Fixed (prod+staging) |
| Blog + site-script XSS | Fixed |
| Device binding not enforced | **Still P1** |
| Paystack bad signature → 200 | **Still P1** |
| License in SSE query string | **Still P1** |

---

## Re-run: production readiness (P0 gate)

| Gate | Result |
|------|--------|
| P0 register closed? | **Yes** |
| Evidence scripts green? | **Yes** (`verify-p0-hardening.mjs`, `verify-p0-xss.mjs`) |
| `tsc` backend + frontend | **Pass** |
| Safe to cut www solely on P0? | **Conditional** — still close P1 ops checklist (live Paystack secret, MOCK unset confirmed on Coolify, smoke send) |

**Updated recommendation:** P0 blockers from the readiness report are remediated with evidence. Proceed to P1 hardening + live smoke before full production cutover. Soft-launch / staging validation is appropriate now.

---

## Files touched (summary)

- `backend/src/middleware/check-search-limit.ts`
- `backend/src/services/topup-service.ts`
- `backend/src/api/webhook-router.ts`
- `backend/src/config/env.ts`
- `backend/src/api/admin-router.ts`
- `backend/src/server.ts`
- `backend/src/database/run-startup-migrations.ts`
- `backend/.env.example`, `backend/.env.staging.example`
- `supabase/migrations/038_rls_deny_public_sensitive.sql`
- `frontend/lib/blog-content.ts`, `frontend/lib/site-scripts-safety.ts`, `frontend/app/layout.tsx`
- `frontend/package.json` (+ `isomorphic-dompurify`)
- `backend/scripts/verify-p0-hardening.mjs`, `verify-p0-xss.mjs`
- This report
