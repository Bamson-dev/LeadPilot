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

**Probe time:** 2026-08-05T18:36:54Z

```json
{
  "status": "ok",
  "browser": "initializing",
  "queue": { "mode": "inline", "running": 0, "queued": 0 },
  "gitCommitSha": "9e9d10ba5642f8594c083e2d5bc371fe8bf66612",
  "freeTrialIpCapReady": true
}
```

| Check | Expected | Observed |
|-------|----------|----------|
| Health SHA | `43fa038…` or `d25af0e…` | **`9e9d10b…`** |
| Match tip? | Yes | **No** — **7+ commits behind** |
| `GET /api/health` | 200 | **200** |
| `GET /auth/status` (invalid license) | 401 JSON | **404 HTML** `Cannot GET /auth/status` |

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

### Why staging is stuck on `9e9d10b`

1. **No staging Coolify webhook / GitHub Action**  
   Pushing `staging` updates GitHub + Vercel FE only. Production Coolify fires on `main` via `COOLIFY_DEPLOY_WEBHOOK_URL`. Staging backend requires **manual Coolify Redeploy**.

2. **Last Coolify build = `9e9d10b`**  
   That revision still contains the P0-3 guard:

   ```ts
   if (data.FRONTEND_URL.includes("staging.leadthur.com")) { /* reject in production */ }
   ```

   Staging Coolify typically sets `NODE_ENV=production` + `FRONTEND_URL=https://staging.leadthur.com` → **`loadEnv()` throws** → `registerRoutes()` never runs → `/health` works, **`/auth/status` 404**.

3. **Fix exists but not deployed**  
   `b2a3576` removes that ban. All Insights→Admin work is after that commit. None of it is on the live staging container.

4. **Cannot redeploy from this agent**  
   No `COOLIFY_STAGING_DEPLOY_WEBHOOK_URL` in repo workflows; no Coolify API token in the workspace; `gh secret list` not available with Coolify staging secrets exposed. **Operator must redeploy in Coolify UI.**

### Operator redeploy checklist (Coolify staging backend)

1. Open Coolify → **staging** backend service (not production).  
2. Confirm Git **branch = `staging`**.  
3. Confirm Dockerfile path `backend/Dockerfile`, Base Directory `/`.  
4. **Redeploy / Force rebuild** (avoid stale image cache if Coolify offers “no cache”).  
5. Wait until healthy.  
6. Verify:

```bash
curl -sS https://staging-backend.leadthur.com/health | jq .gitCommitSha
# expect: d25af0e… or at least starts with b2a3576 / 43fa038 / d25af0e

curl -sS https://staging-backend.leadthur.com/auth/status \
  -H 'x-license-key: invalid' -H 'x-license-email: x@y.com'
# expect: 401 JSON INVALID_LICENSE — NOT 404 HTML
```

7. Confirm Vercel staging FE deployment = `d25af0e`.  
8. Re-run live smoke + P0 scripts against live host (below).

### What was checked from here

| Check | Result |
|-------|--------|
| Coolify dashboard / build logs / container logs | **Unavailable** (no credentials) |
| Deployment hooks for staging | **Not Found** in GHA |
| Branch mapping in Coolify | Inferred: last build from `staging` at `9e9d10b` |
| Image/tag caching | Possible contributor; force rebuild recommended |
| Failed migrations | Not observable; `freeTrialIpCapReady: true` suggests DB reachable |
| Env vars | Cannot read Coolify; infer `FRONTEND_URL` includes staging + `NODE_ENV=production` from 404 pattern |
| Restart history | Not available |

---

## 8. Go / No-Go

### **NO-GO for production**

| Criterion | Status |
|-----------|--------|
| FE + BE same RC1 tip on staging | **FAIL** (BE `9e9d10b`, tip `d25af0e`) |
| Auth API healthy on staging | **FAIL** (404) |
| Search / mailboxes / outreach live smoke | **Not run** (BE routes down + FE SSO) |
| P0 scripts vs **live** staging binary | **Cannot pass** until tip is running |

### **GO** only after

1. Coolify staging BE redeploy to `d25af0e` (or ≥ `b2a3576` with tip preferred).  
2. Health SHA matches tip.  
3. `/auth/status` returns 401 for bad license.  
4. Live P0 + product smoke pass.  
5. FE Vercel SHA confirmed = tip.

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
| 1 | Repo tip `d25af0e` is on `origin/staging` |
| 2 | Frontend expected on tip; SSO blocks public SHA read |
| 3 | Backend live = **`9e9d10b`** — stuck; API routes **down** |
| 4 | Cause: **no staging Coolify auto-deploy** + last manual deploy pre-env-fix |
| 5 | Redeploy **must be done in Coolify** by an operator |
| 6 | **No-Go** production until FE+BE share verified tip |

**Next human action:** Coolify → staging backend → Redeploy from `staging` @ `d25af0e` → ping this thread with new `/health` JSON.
