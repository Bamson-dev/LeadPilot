# LeadThur V2 RC1 — Staging Deployment Verification Report

**Completed:** 2026-08-05 23:47 UTC (2026-08-06 00:47 UTC+1)  
**Objective:** Confirm frontend + backend run the same verified RC1 release on staging  
**Constraint honored:** No features, no UI changes, no backend behavior changes. Resolution was **environment-only**.

---

## Executive summary

Staging backend was serving a **health-only process**: `/health` returned 200 while every application route returned Express's default `Cannot GET …` HTML. Two separate causes, resolved in sequence:

1. **Image lag** — Coolify was still running `9e9d10b`, seven commits behind. Resolved by redeploy.
2. **Environment misconfiguration** — four flags forbidden under `NODE_ENV=production` aborted `loadEnv()`, so `registerRoutes()` never ran. Resolved by deleting them in Coolify.

Backend is now fully operational on the RC1 tip. **Frontend revision and licensed end-to-end flows remain unverified** — see [Outstanding items](#7-outstanding-items).

---

## 1. Git SHA deployed

| Ref | SHA | Contents |
|-----|-----|----------|
| Live backend | `69ed7371ef692e52e9a04813bd96688ddafa5784` | Current `origin/staging` tip |
| RC1 feature-complete tip | `43fa038fd8c343c16042899c4d6a79855f51148f` | Admin Workspace — included |
| RC1 release report | `d25af0e853d36f39a917db97abe6063e8154ddb6` | Included |
| Staging env guard fix | `b2a35765f35d3dfcf62f404e0a04acf447f66040` | Included |

The live SHA is **ahead of** the originally expected `43fa038` because two docs-only commits (`477ed80`, `69ed737`) landed afterward. All RC1 application code is present; no application code differs between `43fa038` and `69ed737`.

**Deployment mechanism finding:** staging backend **does** auto-deploy on push to `staging`. This was proven when docs commit `69ed737` appeared in `/health` without manual action. The earlier conclusion that no staging automation existed was wrong — `.github/workflows/deploy.yml` is indeed production-only, but Coolify has its own git-push trigger on the service. The initial `9e9d10b` lag was a one-off stall, not a structural gap.

## 2. Frontend SHA

**UNVERIFIED.** `https://staging.leadthur.com` returns `302` to `vercel.com/sso-api`. Deployment protection prevents reading the build revision from outside.

Vercel edge is healthy (`x-vercel-id: lhr1::…`). Requires manual confirmation in Vercel → Deployments that branch `staging` is built at `69ed737`.

## 3. Backend SHA

`69ed737` — matches repository tip. Confirmed via `/health`.

## 4. Deployment timestamp

| Event | Time (UTC) |
|-------|-----------|
| Failed boot with bad env | 2026-08-05T19:17:41Z |
| Operator deleted four env vars + restart | ~2026-08-05T23:4xZ |
| First healthy verification | 2026-08-05T23:46:48Z |

## 5. Build status

| Item | Result |
|------|--------|
| Coolify image at tip | **PASS** |
| Route registration | **PASS** — `Backend routes ready` |
| Browser pool | **PASS** — `browser: "ready"` (was `initializing`) |
| Queue backend | **PASS** — `mode: "bullmq"` (Redis connected, not inline fallback) |
| Startup migrations | **PASS** — `freeTrialIpCapReady: true` |
| Local `tsc` / lint / `next build` at tip | **PASS** |

## 6. Health endpoint output

```json
{
  "status": "ok",
  "browser": "ready",
  "deepseek": { "configured": true, "keyFingerprint": "sk-c...925f" },
  "queue": { "running": 0, "queued": 0, "maxConcurrent": 1, "mode": "bullmq" },
  "memory": { "totalGB": "11.7", "usedPercent": 33, "safe": true },
  "timestamp": "2026-08-05T23:46:48.139Z",
  "version": "1.0.0",
  "gitCommitSha": "69ed7371ef692e52e9a04813bd96688ddafa5784",
  "freeTrialIpCapReady": true
}
```

---

## Root cause detail

### Confirmed operator log

```json
{"level":"error","message":"Backend configuration failed — /health works, API routes disabled",
 "timestamp":"2026-08-05T19:17:41.316Z",
 "error":"Invalid environment configuration:
MOCK_OUTREACH_SEND: MOCK_OUTREACH_SEND=1 is forbidden in production (would fake successful sends)
MOCK_MAILBOX_SMTP: MOCK_MAILBOX_SMTP=1 is forbidden in production (would skip Gmail credential verify)
ENABLE_TEST_EMAIL: ENABLE_TEST_EMAIL=true is forbidden in production
DEMO_MODE: DEMO_MODE is forbidden in production"}
```

### Mechanism

`backend/Dockerfile:37` bakes `ENV NODE_ENV=production`, so the P0-3 `superRefine` bans in `backend/src/config/env.ts` apply on staging. With all four flags set, `loadEnv()` threw. `backend/src/server.ts` catches that and logs "API routes disabled" while leaving the module-level `/health` mount active — producing a server that passes Coolify's health check while serving no application routes.

Every console error you saw (`/balance`, `/auth/usage`, `/mailboxes`, `/search/history`, `/checkout`) was a symptom of this single failure, not five separate bugs.

### Fix applied (environment only)

Deleted in Coolify staging backend: `MOCK_OUTREACH_SEND`, `MOCK_MAILBOX_SMTP`, `ENABLE_TEST_EMAIL`, `DEMO_MODE`. Kept `NODE_ENV=production` and `FRONTEND_URL=https://staging.leadthur.com`.

**Consequence:** staging now performs **real Gmail SMTP sends** and **real mailbox credential verification**. Mock-based QA is unavailable on this binary. Use disposable recipients.

---

## Live verification results

### Route registration — all previously-404 paths now correct

| Endpoint | Status | Body |
|----------|--------|------|
| `GET /auth/status` | **401 JSON** | `{"valid":false,"reason":"Invalid license key","code":"INVALID_LICENSE"}` |
| `GET /auth/usage` | **401 JSON** | `{"error":"Invalid license"}` |
| `GET /balance` | **401 JSON** | `{"error":"Invalid license"}` |
| `GET /mailboxes` | **401 JSON** | `{"error":"Invalid license"}` |
| `GET /search/history` | **401 JSON** | `{"error":"Invalid license"}` |
| `GET /sends` | **401 JSON** | `{"error":"Invalid license"}` |
| `GET /affiliate/stats` | **401 JSON** | `{"error":"Invalid license"}` |
| `POST /send` | **401 JSON** | `{"error":"Invalid license"}` |
| `POST /checkout` (outreach) | **401 JSON** | `{"error":"Invalid license"}` |
| `GET /email-templates` | **200 JSON** | template list returned |
| `GET /topup/tiers` | **200 JSON** | full tier catalog |
| `POST /topup/initialize` | **400 JSON** | `{"error":"License, email, and tier are required"}` |
| `POST /checkout/initialize` | **400 JSON** | `{"error":"Email is required"}` |
| `POST /freetrial` | **400 JSON** | `{"error":"Business type and location are required"}` |
| `GET /public/blog/posts` | **200 JSON** | posts returned |
| `GET /public/blog/categories` | **200 JSON** | categories returned |
| `GET /public/site-scripts` | **200 JSON** | Meta Pixel head scripts |
| `GET /admin/stats` | **401 JSON** | `{"error":"Unauthorized"}` |
| `GET /admin/licenses` | **401 JSON** | `{"error":"Unauthorized"}` |
| `GET /admin/blog/posts` | **401 JSON** | `{"error":"Unauthorized"}` |

No Express HTML 404s remain on any real route. Content type is `application/json` throughout.

### P0 gates against the live deployment

| Gate | Check | Result |
|------|-------|--------|
| **P0-6** | `POST /admin/test-email` unauthenticated | **PASS** — 404, endpoint not mounted in production |
| **P0-3** | `/demo/search` after `DEMO_MODE` removal | **PASS** — 404, demo router not mounted |
| **P0-3** | Mocks refused under production | **PASS** — proven by the boot refusal itself |
| Admin auth | All `/admin/*` without JWT | **PASS** — 401 `Unauthorized` |
| Security headers | `/auth/status` response | **PASS** — `x-content-type-options: nosniff`, `x-frame-options: DENY`, `referrer-policy: strict-origin-when-cross-origin`, no `x-powered-by` |
| CORS allowlist | `Origin: https://staging.leadthur.com` | **PASS** — reflected |
| CORS allowlist | `Origin: https://evil.example.com` | **PASS** — not reflected |

### P0 source evidence scripts

Both re-run at tip after the deployment was confirmed healthy:

```text
node backend/scripts/verify-p0-hardening.mjs  → 15 passed
node backend/scripts/verify-p0-xss.mjs        → 6 passed (P0-5)
```

Covers P0-1 metering fail-closed, P0-2 top-up tier verification and underpay rejection, P0-3 production env bans, P0-4 RLS deny-by-default, P0-5 XSS sanitization, P0-6 test-email gating.

---

## 7. Outstanding items

### Blocking a production Go

| # | Item | Owner action |
|---|------|--------------|
| 1 | **Frontend SHA unverified** | Confirm in Vercel that branch `staging` is deployed at `69ed737` |
| 2 | **Licensed end-to-end flows unverified** | Needs a valid staging license key: activation → search → mailbox connect → outreach send |

Item 2 covers license activation, search execution and metering, mailbox connect with real credential verification, and a live outreach send. Unauthenticated gates are confirmed correct, but authenticated success paths have not been exercised against this deployment.

### Non-blocking (P1, pre-existing)

| # | Item | Evidence |
|---|------|----------|
| 1 | `POST /webhooks/paystack` with bogus signature returns **200 `ok`** | Confirmed live this session. Signature likely validated before side effects, but a 2xx on an invalid signature is misleading and should return 4xx |
| 2 | Stale staging docs actively brick deployments | `backend/.env.staging.example` recommends `MOCK_OUTREACH_SEND=1` and claims `NODE_ENV` stays development — contradicted by `Dockerfile:37`. Same advice in `docs/staging/01`, `04`, `07`, and the staging handbook. **This is what caused today's outage** |
| 3 | No mock-based QA path on staging | Consequence of `NODE_ENV=production` + P0-3. Needs a deliberate design decision, not an env hack |
| 4 | No staging job in GitHub Actions | Coolify's own trigger covers it, but the deploy path is undocumented and invisible in CI |
| 5 | Health endpoint hides config failures | Diagnosing today required operator log access. A non-secret readiness signal distinguishing "routes registered" from "health-only" would have cut this to one probe |
| 6 | Container logs `port: 3001` vs Dockerfile default 3000 | Cosmetic; Coolify overrides `PORT` and proxies correctly |
| 7 | Carried forward from RC1 report | Device binding, SSE license query, Paystack items |

---

## 8. Go / No-Go recommendation

### Staging backend: **GO**

Running the RC1 tip with all routes registered, P0 gates enforced, security headers and CORS correct, browser pool ready, and BullMQ connected.

### Production: **NO-GO** — pending two verifications

Not because anything is known broken, but because two required checks are outstanding:

1. Frontend revision confirmation in Vercel (SSO blocks external verification)
2. Licensed end-to-end smoke against this deployment

Neither is expected to fail. Once both are green, this becomes a **GO** for production promotion.

### Additional pre-production requirement

Production Coolify must be audited for the same four flags **before** promoting. If production carries `MOCK_OUTREACH_SEND`, `MOCK_MAILBOX_SMTP`, `ENABLE_TEST_EMAIL`, or `DEMO_MODE`, the backend will refuse to register routes exactly as staging did — and production has no SSO to mask a partial outage. This is now the single highest-value pre-deploy check.

Also confirm production `FRONTEND_URL=https://www.leadthur.com` with no staging substring.
