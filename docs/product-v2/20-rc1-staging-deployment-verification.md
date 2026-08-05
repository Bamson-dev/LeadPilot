# LeadThur V2 RC1 — Staging Deployment Verification Report

**Date:** 2026-08-05  
**Investigator:** Cursor agent (no Coolify dashboard credentials in repo)  
**Objective:** Confirm frontend + backend run the same verified RC1 release on staging  
**Constraint:** No feature/UI/backend behavior changes — verification only

---

## 0. Documentation push status

| Item | Status |
|------|--------|
| Commit `d25af0e` on `origin/staging` | **Yes** — already published (`docs(v2): RC1 final release report…`) |
| Working tree vs `origin/staging` | In sync for tracked RC1 commits |

---

## 1. Git SHA deployed (repository)

| Ref | SHA | Message |
|-----|-----|---------|
| `origin/staging` tip | `d25af0e853d36f39a917db97abe6063e8154ddb6` | RC1 final release report |
| Feature-complete Admin tip | `43fa038fd8c343c16042899c4d6a79855f51148f` | RC1 Admin Workspace |
| Env fix required for staging Coolify | `b2a35765f35d3dfcf62f404e0a04acf447f66040` | Allow staging `FRONTEND_URL` under `NODE_ENV=production` |

**Target for staging backend:** tip `d25af0e` (or at least ≥ `b2a3576`).  
**User-noted target `43fa038`:** acceptable app feature tip; current tip also includes docs-only `d25af0e` after Admin.

---

## 2. Frontend SHA

| Surface | Status |
|---------|--------|
| Expected | Vercel deploys from `staging` branch → tip `d25af0e` |
| Live verification | **Blocked** — `https://staging.leadthur.com` returns **302 → Vercel SSO** |
| `x-vercel-id` present | Yes (edge responding) |

Cannot read deployment commit from the public edge without SSO. Confirm in Vercel → Project → Deployments → Production/Preview for branch `staging` = `d25af0e`.

---

## 3. Backend SHA (live)

### Pass A — pre-redeploy (stuck image)

**Probe time:** 2026-08-05T18:36:54Z → SHA **`9e9d10b…`**

### Pass B — after Coolify redeploy (current)

**Probe time:** 2026-08-05T18:41:48Z

```json
{
  "status": "ok",
  "browser": "initializing",
  "queue": { "mode": "inline", "running": 0, "queued": 0 },
  "gitCommitSha": "d25af0e853d36f39a917db97abe6063e8154ddb6",
  "freeTrialIpCapReady": true
}
```

| Check | Expected | Observed |
|-------|----------|----------|
| Health SHA | `d25af0e…` | **`d25af0e…`** (match tip) |
| `GET /api/health` | 200 | **200** |
| `GET /auth/status` | 401 JSON | **404 HTML** `Cannot GET /auth/status` |
| `GET /balance` | 401/200 JSON | **404 HTML** |
| `POST` checkout / topup | JSON API | **404 HTML** |

**UI symptom (Billing):** “Checkout issue — Request failed (404)”, Credits `—`, “Usage unavailable”, “Balance unavailable”. Plan cards still render from **static frontend catalog**; Subscribe hits missing `/checkout` → 404.

---

## 4. Deployment timestamp

| Event | Time (local / UTC) |
|-------|--------------------|
| Live health `timestamp` | `2026-08-05T18:36:54.181Z` |
| Commit `9e9d10b` authored | 2026-08-05 13:10 +0100 |
| Env fix `b2a3576` authored | 2026-08-05 13:22 +0100 (never applied on this container) |
| Tip `d25af0e` authored | 2026-08-05 19:35 +0100 |

Coolify last successful deploy for this service is inferred as **around `9e9d10b`** — no automated redeploy after that.

---

## 5. Build status

| Build | Status | Notes |
|-------|--------|-------|
| Local `next build` at tip | PASS (prior stabilization) | — |
| Local backend `tsc` at tip | PASS | — |
| Coolify staging image for tip | **Unknown / not running** | Live container reports old SHA |
| GitHub Actions staging BE | **Not Found** | `deploy.yml` is **`main` → production only** |

---

## 6. Health endpoint output

See §3. Summary: process is up (`status: ok`) but **API routes are not registered**.

---

## 7. Remaining deployment issues — root cause

### Phase 1 (resolved): image lag

Coolify was behind on `9e9d10b`. **Operator redeployed** — live health now reports tip **`d25af0e`**.

### Phase 2 (current): tip image, routes still disabled

`server.ts` always serves `/health`. API mounts only after `loadEnv()` succeeds. On failure:

```text
Backend configuration failed — /health works, API routes disabled
```

Live tip still returns Express default **404 HTML** for `/auth/*`, `/balance`, `/checkout`, `/topup` → FE Billing shows exactly the screenshot errors.

### Most likely Coolify env conflict (P0-3)

Staging handbook historically recommends:

| Var | Handbook | P0-3 with `NODE_ENV=production` |
|-----|----------|--------------------------------|
| `MOCK_OUTREACH_SEND=1` | Recommended for staging | **Forbidden — boot refuses** |
| `MOCK_MAILBOX_SMTP=1` | Sometimes used | **Forbidden** |
| `ENABLE_TEST_EMAIL=true` | Optional | **Forbidden** |
| `DEMO_MODE=1/true` | Optional | **Forbidden** |

Staging Coolify typically uses **`NODE_ENV=production`**. After tip redeploy, the old `FRONTEND_URL` staging ban is gone (`b2a3576`), but **any remaining MOCK_*/ENABLE_TEST_EMAIL/DEMO_MODE still aborts `loadEnv()`** → same health-only failure as before.

Other possible Zod failures (check Coolify logs for the exact message):

- `JWT_SECRET` shorter than 32 chars  
- `ADMIN_PASSWORD` shorter than 8  
- `SUPABASE_SERVICE_KEY` contains substring `anon`  
- Missing `SUPABASE_URL` / `FRONTEND_URL` / `ADMIN_EMAIL`

### Operator fix (env — no code change)

1. Coolify → **staging** backend → **Environment**.  
2. **Unset / remove** (do not leave `=1` or `=true`):
   - `MOCK_OUTREACH_SEND`
   - `MOCK_MAILBOX_SMTP`
   - `ENABLE_TEST_EMAIL`
   - `DEMO_MODE`
3. Keep `NODE_ENV=production`, `FRONTEND_URL=https://staging.leadthur.com`.  
4. Open **container logs** and confirm line: `Backend routes ready` (not `configuration failed`).  
5. Restart/redeploy once after env save.  
6. Verify:

```bash
curl -sS https://staging-backend.leadthur.com/health | jq .gitCommitSha
# expect: d25af0e…

curl -sS -w "\n%{http_code}\n" https://staging-backend.leadthur.com/auth/status \
  -H 'x-license-key: invalid' -H 'x-license-email: x@y.com'
# expect: 401 JSON — NOT 404 HTML

curl -sS -w "\n%{http_code}\n" https://staging-backend.leadthur.com/balance \
  -H 'x-license-key: invalid' -H 'x-license-email: x@y.com'
# expect: 401 JSON — NOT 404
```

7. Reload Billing — Checkout / Usage / Balance should stop 404ing (auth errors only if license missing).

**Note:** Unsetting `MOCK_OUTREACH_SEND` means staging uses **real SMTP** for sends. That is required for this RC1 binary under `NODE_ENV=production`. Do not re-enable mocks without a later code change (out of scope for this verification).

### What was checked from here

| Check | Result |
|-------|--------|
| Coolify dashboard / build logs / container logs | **Unavailable** (no credentials) — need operator paste of `configuration failed` line |
| Deployment hooks for staging | **Not Found** in GHA (prod only) |
| Branch / image | Tip SHA **`d25af0e`** now live |
| Failed migrations | DB reachable (`freeTrialIpCapReady: true`); migrations only run after routes register |
| Env vars | Cannot read Coolify; **MOCK_* under NODE_ENV=production** is strongest hypothesis |
| Billing UI 404s | Confirmed against live missing `/balance`, `/checkout`, `/auth` |

---

## 8. Go / No-Go

### **NO-GO for production**

| Criterion | Status |
|-----------|--------|
| BE tip image on staging | **PASS** (`d25af0e`) |
| API routes registered | **FAIL** (all app paths 404) |
| FE + BE same tip *and* functional | **FAIL** (FE up; BE health-only) |
| Billing / auth / search / mailboxes / outreach | **FAIL** (404) |
| P0 live against running binary | **Blocked** until routes register |

### **GO** only after

1. Coolify staging env: remove MOCK_*/ENABLE_TEST_EMAIL/DEMO_MODE (or fix whatever log shows).  
2. Logs show `Backend routes ready`.  
3. `/auth/status` → 401 JSON (not 404).  
4. Billing no longer shows “Request failed (404)”.  
5. Live smoke + P0 pass.  
6. FE Vercel SHA confirmed = tip.

---

## P0 verification (this session)

### Against **code at tip** (local)

```text
node backend/scripts/verify-p0-hardening.mjs  → PASS (prior run)
node backend/scripts/verify-p0-xss.mjs        → PASS (prior run)
```

### Against **live staging** (`9e9d10b`)

| Check | Result |
|-------|--------|
| Live binary includes P0 metering fail-closed | **Unknown / unlikely full set** — SHA predates later commits; env guard still broken |
| Live `/admin/test-email` | Not re-probed this pass (previously open on older SHA; tip gates it) |
| Live API smoke | **FAIL** — routes unregistered |

**After Coolify redeploy**, re-run:

```bash
# SHA gate
curl -sS https://staging-backend.leadthur.com/health | jq .

# Auth gate
curl -sS -w "\n%{http_code}\n" https://staging-backend.leadthur.com/auth/status \
  -H 'x-license-key: invalid' -H 'x-license-email: x@y.com'

# Source evidence still green
node backend/scripts/verify-p0-hardening.mjs
node backend/scripts/verify-p0-xss.mjs
```

Plus licensed smoke: activate → search → mailboxes → outreach.

---

## Summary

| # | Finding |
|---|---------|
| 1 | Repo + Coolify image tip = **`d25af0e`** (redeploy worked) |
| 2 | Frontend Billing on staging shows **404 checkout / usage / balance** |
| 3 | Backend **health-only** — `loadEnv()` still failing after tip |
| 4 | Likely: **`MOCK_OUTREACH_SEND=1` (or sibling flags) + `NODE_ENV=production`** |
| 5 | Next: Coolify env cleanup + confirm `Backend routes ready` in logs |
| 6 | **No-Go** production until routes register and smoke passes |

**Next human action:** Coolify staging env → unset MOCK_*/ENABLE_TEST_EMAIL/DEMO_MODE → restart → paste `/health` + `/auth/status` + the `routes ready` / `configuration failed` log line.
