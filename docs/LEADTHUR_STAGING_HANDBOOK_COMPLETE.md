# LeadThur Staging Handbook — Complete (Easy Copy)

Official staging documentation for LeadThur V2. Read-only audit; no code or infra changes.

---


<!-- ========== 10-staging-readme.md ========== -->

# 10 — Staging README (Official LeadThur V2 Handbook)

**Audience:** Any senior engineer, designer, QA, or AI implementer joining LeadThur V2.  
**Rule for this pack:** Documents how staging **currently** works (read-only audit). Gaps marked **Not Found.**

---

## Quick facts

| | |
|--|--|
| Staging frontend | `https://staging.leadthur.com` (Vercel; may require SSO) |
| Staging backend | `https://staging-backend.leadthur.com` |
| Production frontend | `https://www.leadthur.com` |
| Production backend | `https://backend.leadthur.com` |
| Staging git branch | `staging` |
| Production git branch | `main` |
| Staging DB | Separate Supabase (“LeadPilot Staging”) — ref not committed |
| Production DB | `oytbynwogudfqqaxxrjq` |
| Prod BE deploy | GitHub Actions → Coolify webhook |
| Staging BE deploy automation | **Not Found** in GitHub Actions |

---

## Why staging is mandatory for V2

LeadThur V2 redesigns and features are:

1. Specified and design-approved first  
2. Implemented against the spec (no invented UX)  
3. Deployed to staging  
4. QA + UX approved on staging  
5. Only then promoted to production  

Full process: **[09-redesign-workflow.md](./09-redesign-workflow.md)**

---

## Document map

| File | Purpose |
|------|---------|
| [01-staging-overview.md](./01-staging-overview.md) | What staging is; URLs; services |
| [02-deployment-flow.md](./02-deployment-flow.md) | How deploys work today + gaps |
| [03-environments.md](./03-environments.md) | Dev vs staging vs production |
| [04-feature-flags.md](./04-feature-flags.md) | Env toggles, demo, mocks |
| [05-background-services.md](./05-background-services.md) | API, queues, schedulers, health |
| [06-release-checklist.md](./06-release-checklist.md) | Pre-prod checklist |
| [07-known-limitations.md](./07-known-limitations.md) | SSO, mocks, missing CI |
| [08-qa-process.md](./08-qa-process.md) | Browser/device matrix |
| [09-redesign-workflow.md](./09-redesign-workflow.md) | Official V2 workflow + roles |
| This file | Handbook entrypoint |

Combined copy file: `docs/LEADTHUR_STAGING_HANDBOOK_COMPLETE.md` (if generated).

---

## Day-1 engineer setup

1. Read this README + `09-redesign-workflow.md`.  
2. Get Vercel access to open staging FE (SSO).  
3. Get Coolify access for staging backend redeploys.  
4. Obtain staging Supabase + env values (never use prod keys locally for staging tests).  
5. Clone repo; use branch `staging` for V2 work.  
6. Verify:

```bash
curl -sS https://staging-backend.leadthur.com/health | jq .
bash backend/scripts/verify-deployment.sh https://staging-backend.leadthur.com
```

7. Local: `cp backend/.env.example backend/.env` and `frontend/.env.local.example` → point API at staging **only** if intentional.

---

## Health interpretation

```json
{
  "status": "ok",
  "browser": "ready",
  "queue": { "mode": "bullmq" },
  "gitCommitSha": "...",
  "freeTrialIpCapReady": true,
  "memory": { "safe": true }
}
```

| Field | Meaning |
|-------|---------|
| `status` | Process up |
| `browser` | Playwright pool |
| `queue.mode` | `bullmq` = Redis OK; `inline` = degraded |
| `gitCommitSha` | Deployed commit |
| `freeTrialIpCapReady` | Staging migrations/IP table OK |

---

## Non-negotiables

- Do not invent UX in Cursor.  
- Do not skip staging review.  
- Do not put live payment keys on staging.  
- Do not leave `MOCK_OUTREACH_SEND=1` on production.  
- Do not edit production site scripts without staging rehearsal.

---

## Related docs outside this folder

- `DEPLOYMENT.md` — Coolify/Vercel production ops  
- `deploy/VERCEL.md` — Frontend API URL pitfalls  
- `docs/CORE_FLOWS_CHECKLIST.md` — Legacy core flow order (some Brevo refs outdated)  
- `docs/ui-audit/` — UI inventory for redesign  
- `docs/LEADTHUR_COMPLETE_INTERNAL_DOCUMENTATION.md` — Full product/engineering inventory  

---

## Gaps to fix (ops backlog — not done in this audit)

1. Add GitHub Action: push to `staging` → Coolify staging webhook → verify `staging-backend` health SHA.  
2. Document staging Paystack webhook URL.  
3. Document / relax Vercel Deployment Protection for QA accounts.  
4. Keep staging SHA ≥ production for shared fixes, or cherry-pick deliberately.  
5. Commit a non-secret staging env matrix (project refs redacted).

---

*Handbook ends. Follow 09 for every V2 change.*


---


<!-- ========== 01-staging-overview.md ========== -->

# 01 — Staging Overview

**Sources:** `DEPLOYMENT.md`, `deploy/VERCEL.md`, `backend/.env.example`, `backend/.env.staging.example`, `frontend/next.config.ts`, `frontend/app/demo/page.tsx`, `backend/src/server.ts`, live `GET /health` probes (2026-08-04).

---

## What staging is

Staging is LeadThur’s pre-production environment: a full stack that mirrors production behavior but uses **separate hosts**, a **separate Supabase project** (documented as “LeadPilot Staging”), and staging-oriented toggles (mock outreach sends, demo mode, test payment keys).

It is the intended place to implement, review, and approve **LeadThur V2** work before production.

---

## Why it exists

- Validate search scraping, payments, outreach, licenses, and admin without touching production data or reputation (email/SMS/payment).
- Allow demo mode and safer mocks (`MOCK_OUTREACH_SEND`).
- Let Vercel Preview / `staging` branch frontend talk to `staging-backend.leadthur.com`.

---

## How it differs from production

| Concern | Staging | Production |
|---------|---------|------------|
| Frontend host | `https://staging.leadthur.com` | `https://www.leadthur.com` |
| Backend host | `https://staging-backend.leadthur.com` | `https://backend.leadthur.com` |
| Git branch (typical) | `staging` | `main` |
| Frontend deploy | Vercel (branch / Preview); demo auto-enabled on staging host | Vercel Production |
| Backend deploy workflow in GitHub | **Not Found** (no staging Coolify workflow) | `.github/workflows/deploy.yml` → Coolify → `backend.leadthur.com` |
| Database | Separate staging Supabase (`YOUR_LEADPILOT_STAGING_REF` in `.env.staging.example`) | `oytbynwogudfqqaxxrjq` (`DEPLOYMENT.md`) |
| Demo UI `/demo` | Enabled on staging hostname | Disabled unless `DEMO_MODE` / `NEXT_PUBLIC_DEMO_MODE` |
| Outreach SMTP | Often mocked (`MOCK_OUTREACH_SEND=1` in examples) | Live Gmail SMTP |
| Admin test email | Auto-enabled when `FRONTEND_URL` contains `staging.leadthur.com` | Requires `ENABLE_TEST_EMAIL=true` |
| Observed search concurrency (`/health`) | `maxConcurrent: 2` (probe) | `maxConcurrent: 5` (probe) |
| Frontend access | **Vercel Deployment Protection / SSO** observed (302 → `vercel.com/sso-api`) | Public |

---

## Frontend URL

- **Canonical:** `https://staging.leadthur.com`
- **Deploy:** Vercel, Root Directory `frontend` (`deploy/VERCEL.md`)
- **API selection:** `next.config.ts` forces `https://staging-backend.leadthur.com` when `VERCEL_GIT_COMMIT_REF=staging` or host looks like staging
- **Access note:** Live probe returned **302 to Vercel SSO** — Staging may require Vercel team login / Deployment Protection bypass for QA browsers

---

## Backend URL

- **Canonical:** `https://staging-backend.leadthur.com`
- **Health:** `GET https://staging-backend.leadthur.com/health` (live: `status: ok`, `queue.mode: bullmq`, browser ready)
- **CORS:** `staging.leadthur.com` is hard-coded in allowlist (`backend/src/server.ts`)

Hosting platform for staging backend: inferred **Coolify on Contabo** (same pattern as production in `DEPLOYMENT.md`). Dedicated staging Coolify service config file in repo: **Not Found.**

---

## Database

| Item | Status |
|------|--------|
| Engine | Supabase Postgres |
| Staging project | Referenced as LeadPilot Staging in `backend/.env.staging.example` — exact project ref **Not Found** in committed files (placeholder `YOUR_LEADPILOT_STAGING_REF`) |
| Production project | `oytbynwogudfqqaxxrjq` (`DEPLOYMENT.md`) |
| Migrations | Same `supabase/migrations/**`; startup migrations via `SUPABASE_DB_PASSWORD` (`run-startup-migrations.ts`) |
| Local staging tests | `USE_REAL_SUPABASE=1` + staging keys in `backend/.env.staging` |

---

## Redis

| Item | Status |
|------|--------|
| Env | `REDIS_URL` |
| Effect | Enables BullMQ for search + outreach queues |
| Without Redis | Inline in-process fallback (`search-queue.ts`, `outreach-send-queue.ts`) |
| Staging live | `/health` reports `queue.mode: "bullmq"` → Redis is configured on staging backend |
| Compose Redis service | **Not Found** in `docker-compose.yml` (Redis is external) |

---

## Queues

| Queue | Purpose | Start |
|-------|---------|-------|
| Search (`leadthur-search-queue`) | Playwright Maps + email enrichment jobs | `initSearchQueue()` on boot |
| Outreach send | SMTP send jobs | `initOutreachSendQueue()` on boot |

Workers run **inside the same Express process** (not separate deployables in repo).

---

## Cron jobs

**OS crontab:** Not Found.

**In-process schedulers** (start on backend boot in `server.ts`):

| Scheduler | Interval | File |
|-----------|----------|------|
| Trial nurture sequence | Hourly + delayed first tick | `trial-sequence.ts` |
| Outreach grace expiry | Hourly | `outreach-grace-scheduler.ts` |
| Search orphan reconcile | ~60s | `search-queue.ts` |

---

## Environment variables

See `03-environments.md` and:

- Staging local test template: `backend/.env.staging.example`
- Backend template: `backend/.env.example`
- Frontend: `frontend/.env.local.example`
- Coolify: copy from `.env.example` (`DEPLOYMENT.md`)

Critical staging-oriented vars:

- `FRONTEND_URL=https://staging.leadthur.com`
- `MOCK_OUTREACH_SEND=1` (recommended in examples until SMTP verified)
- `OUTREACH_TRACKING_BASE_URL=https://staging-backend.leadthur.com` (optional)
- `RATE_LIMIT_IP_ALLOWLIST=...` for QA IPs
- Paystack **test** keys (`sk_test_...` commented in `.env.example`)
- Separate `SUPABASE_URL` / `SUPABASE_SERVICE_KEY` for staging project

Exact Coolify staging env dump: **Not Found** in repo (secrets live in Coolify UI).

---

## Storage

| Item | Status |
|------|--------|
| Object storage (S3/R2) | Not Found |
| Uploads | Multer → base64 in DB (admin images) |
| Playwright browsers | Inside backend container |

---

## Payment providers

| Provider | Staging expectation (from docs/examples) | Production |
|----------|------------------------------------------|------------|
| Paystack | Test keys (`sk_test_...`) | Live keys; webhook `https://backend.leadthur.com/webhooks/paystack` |
| Flutterwave | Supported in code | Live hash/secret |

Staging Paystack webhook URL documentation: **Not Found** (only production URL in `webhook-router.ts` comment / CORE_FLOWS).

---

## Email providers

| Stream | Provider | Staging note |
|--------|----------|--------------|
| Transactional | ZeptoMail → Resend fallback | Same code path; use non-prod keys / careful sends |
| Nurture / trial sequence | Resend-only | Scheduler runs unless paused in DB |
| Outreach | User Gmail SMTP | Prefer `MOCK_OUTREACH_SEND=1` |

---

## AI providers

| Provider | Use | Health |
|----------|-----|--------|
| DeepSeek | WhatsApp AI, outreach generate, area suggestions | `/health.deepseek.configured` |

---

## Search workers / Google Maps scraping

- Playwright Chromium pool (`browser-pool.ts`)
- Phase 1: Google Maps HTML scrape (not Places API)
- Phase 2: website email enrichment
- Starts via `initSearchQueue` + `initBrowserPoolSafe` on boot
- Staging health: `browser: "ready"` observed

---

## License system

Same model as production: `license_keys`, `/auth/activate`, header auth. Staging DB must be separate so test licenses do not affect production.

---

## Outreach system

Same code: mailboxes, send queue, tracking pixels. Staging tracking base resolves to `staging-backend.leadthur.com` when `FRONTEND_URL` includes `staging.leadthur` (`outreach-send-service.ts`, `email-template.ts`).

---

## Other external services

| Service | Role |
|---------|------|
| Cloudflare | DNS/proxy (documented for production backend; staging DNS details **Not Found** in repo) |
| Nominatim | Geocoding |
| Google Geocoding API | Optional fallback (`GOOGLE_MAPS_API_KEY`) |
| Vercel | Frontend hosting + SSO protection on staging |
| Coolify | Backend container hosting (documented for prod; staging inferred) |
| Contabo VPS | Documented host for Coolify/backend |

---

## Live probe snapshot (2026-08-04)

**Staging backend** `gitCommitSha`: `a340bf5…` · `queue.mode`: bullmq · `maxConcurrent`: 2 · `freeTrialIpCapReady`: true  

**Production backend** `gitCommitSha`: `8a2af24…` · `maxConcurrent`: 5  

Staging is **behind** production on that probe — confirm before assuming staging has latest V2 scheduling fixes.


---


<!-- ========== 02-deployment-flow.md ========== -->

# 02 — Deployment Flow

**Sources:** `.github/workflows/deploy.yml`, `DEPLOYMENT.md`, `deploy/VERCEL.md`, `deploy/README.md`, `deploy/VPS.md`, `scripts/deploy-vps.sh`, `frontend/next.config.ts`, git remotes (`main`, `staging`).

---

## Intended V2 flow (target process)

```text
Product / UX decision
        ↓
Specification (approved)
        ↓
Developer + Cursor on branch
        ↓
Push to GitHub (`staging` or PR → `staging`)
        ↓
Deploy to Staging (frontend Vercel + backend Coolify)
        ↓
QA + UX review on staging
        ↓
Fixes
        ↓
Merge / promote to `main`
        ↓
Production deploy (documented automation)
        ↓
Production verification
```

---

## What the repository currently automates

### Production backend (documented)

```text
Push to GitHub branch `main`
  (paths: backend/**, shared/**, docker-compose.yml, supabase/migrations/**, deploy.yml, scripts/deploy-vps.sh)
        ↓
GitHub Actions: Deploy Backend (`.github/workflows/deploy.yml`)
        ↓
If secret COOLIFY_DEPLOY_WEBHOOK_URL set:
  GET Coolify deploy webhook
Else if VPS_HOST + VPS_SSH_KEY + VPS_USER:
  SSH → /opt/leadthur → git reset --hard origin/main → scripts/deploy-vps.sh
Else:
  Workflow fails (no credentials)
        ↓
Poll https://backend.leadthur.com/health until gitCommitSha matches GitHub SHA
```

Concurrency group: `deploy-backend-production`.

### Production / Preview frontend (documented)

```text
Push to GitHub
        ↓
Vercel Git integration (Root Directory = frontend)
        ↓
Production domain: www.leadthur.com (main)
Preview / staging branch: staging.leadthur.com (when configured)
        ↓
next.config.ts may set NEXT_PUBLIC_API_URL:
  staging branch/host → https://staging-backend.leadthur.com
  else → https://backend.leadthur.com (or configured API URL)
```

### Staging backend automation

| Item | Status |
|------|--------|
| GitHub Actions workflow deploying `staging-backend.leadthur.com` | **Not Found** |
| Documented Coolify staging webhook secret name | **Not Found** |
| Manual Coolify redeploy from dashboard | Inferred operational practice (not in repo) |

**Implication for V2:** Staging backend deploys are **not** codified like production. Engineers must confirm Coolify staging service branch = `staging` (or equivalent) and redeploy manually / via an undocumented webhook until a workflow is added.

---

## Local development path

```text
Developer machine
        ↓
npm run dev:backend  (tsx watch backend/src/server.ts)
npm run dev:frontend (next dev --turbopack)
        ↓
Optional: docker compose --env-file .env.production up --build
        ↓
bash backend/scripts/verify-deployment.sh http://localhost:3000
```

---

## Branch model (observed)

| Branch | Remote | Typical role |
|--------|--------|--------------|
| `main` | `origin/main` | Production |
| `staging` | `origin/staging` | Staging |

PR / protection rules: **Not Found** in repo files (may exist only on GitHub settings).

---

## Coolify (backend) — documented settings

From `DEPLOYMENT.md` (written for production; apply same pattern to staging service if separate):

| Setting | Value |
|---------|-------|
| Base Directory | `/` (monorepo root) |
| Dockerfile | `backend/Dockerfile` |
| Port | `3000` |
| Health Check | `/health` |

Never set Base Directory to `/backend`.

---

## Vercel (frontend) — documented settings

| Setting | Value |
|---------|-------|
| Root Directory | `frontend` |
| Framework | Next.js |
| Node | 20.x |
| Staging API | `NEXT_PUBLIC_API_URL=https://staging-backend.leadthur.com` for Preview/staging |
| Production API | `https://backend.leadthur.com` |

---

## Missing / gaps (explicit)

1. **No GitHub Action** verifies `staging-backend.leadthur.com/health` after push to `staging`.  
2. **No committed Coolify config** (IaC) for staging vs production services.  
3. **Staging Paystack webhook URL** not documented in repo.  
4. **Vercel SSO** on `staging.leadthur.com` blocks anonymous QA browsers (observed 302).  
5. Staging and production backend SHAs can drift (observed).

---

## Verification commands (read-only)

```bash
# Staging backend
bash backend/scripts/verify-deployment.sh https://staging-backend.leadthur.com
curl -sS https://staging-backend.leadthur.com/health | jq .

# Production backend
bash backend/scripts/verify-deployment.sh https://backend.leadthur.com
curl -sS https://backend.leadthur.com/health | jq .

# Client IP allowlist check (staging example in DEPLOYMENT.md)
# In browser on staging FE:
# fetch("https://staging-backend.leadthur.com/health/client-ip").then(r=>r.json()).then(console.log)
```

---

## Release promotion (current practical path)

Until staging CI exists:

1. Develop on feature branch → merge to `staging`.  
2. Ensure Vercel rebuilt staging frontend.  
3. Manually redeploy Coolify **staging** backend (confirm in Coolify UI).  
4. Run staging QA checklist (`06-release-checklist.md`).  
5. Merge `staging` → `main` (or PR).  
6. Rely on GitHub Actions for production backend; Vercel for production frontend.  
7. Verify production `/health` SHA + smoke tests.


---


<!-- ========== 03-environments.md ========== -->

# 03 — Environments

Compare Development, Staging, and Production as evidenced in the repository and live probes.

---

## Development (local)

| Item | Value |
|------|--------|
| Frontend URL | `http://localhost:3000` (Next) |
| Backend URL | `http://localhost:3000` or `3001` if split (CORS allows both) |
| Database | Local/dev Supabase project via `backend/.env` — exact ref **Not Found** (developer-owned) |
| Redis | Optional `REDIS_URL`; else inline queues |
| Queues | Inline or BullMQ if Redis set |
| Env files | `backend/.env` from `.env.example`; `frontend/.env.local` from `.env.local.example` |
| Secrets | Local only; never commit |
| Email | Needs Resend/Zepto keys or sends fail/warn |
| Payments | Typically test keys or unset |
| Cron / schedulers | Same in-process schedulers when backend runs |
| Workers | In-process with API |
| Feature flags | `NODE_ENV=development` enables `/demo`; mocks as set |
| Start | `npm run dev:backend`, `npm run dev:frontend` or `dev:all` |

---

## Staging

| Item | Value |
|------|--------|
| Frontend URL | `https://staging.leadthur.com` |
| Backend URL | `https://staging-backend.leadthur.com` |
| Database | Separate staging Supabase (placeholder in `.env.staging.example`) |
| Redis | Present (health `queue.mode=bullmq`) |
| Queues | BullMQ; observed `maxConcurrent: 2` |
| Env / secrets | Coolify + Vercel dashboards — **Not Found** committed |
| Email | Zepto/Resend configured if keys set; nurture scheduler active unless DB-paused |
| Payments | Documented expectation: Paystack **test** keys |
| Cron | In-process hourly trial + grace; orphan reconcile |
| Workers | In API container; Playwright browsers |
| Feature flags | Staging host → demo on; `MOCK_OUTREACH_SEND` recommended; test-email auto if FRONTEND_URL staging |
| Frontend protection | Vercel SSO / Deployment Protection (observed) |
| Git branch | `staging` |

---

## Production

| Item | Value |
|------|--------|
| Frontend URL | `https://www.leadthur.com` (also `leadthur.com` in CORS) |
| Backend URL | `https://backend.leadthur.com` |
| Database | Supabase `oytbynwogudfqqaxxrjq` |
| Redis | Present (health `queue.mode=bullmq`) |
| Queues | BullMQ; observed `maxConcurrent: 5` |
| Env / secrets | Coolify + Vercel Production |
| Email | Live Zepto + Resend; nurture may be paused via DB |
| Payments | Live Paystack (+ Flutterwave); webhook on production backend |
| Cron | Same schedulers |
| Workers | In API container |
| Feature flags | Demo off unless env; no mock sends in healthy prod |
| Deploy | GitHub Actions on `main` → Coolify webhook; Vercel Production |
| Git branch | `main` |

---

## Side-by-side

| Concern | Development | Staging | Production |
|---------|-------------|---------|------------|
| FE host | localhost | staging.leadthur.com | www.leadthur.com |
| BE host | localhost | staging-backend.leadthur.com | backend.leadthur.com |
| Auto BE deploy | No | **Not Found** in GHA | Yes (`deploy.yml`) |
| Auto FE deploy | No | Vercel on push (if linked) | Vercel on push |
| DB | Dev project | Staging project | Prod project |
| DEMO `/demo` | Yes (NODE_ENV) | Yes (hostname) | No (default) |
| MOCK outreach | Often 1 | Recommended 1 | Should be unset/0 |
| SCRAPER concurrency default | 5 in example | Observed 2 workers | Observed 5 |
| Public FE access | Local | SSO-gated (observed) | Public |

---

## Shared architecture note

All three environments run **one backend process** that includes:

- Express HTTP API  
- Search queue worker  
- Outreach send worker  
- Trial + grace schedulers  
- Playwright browser pool  

There is **no** separate worker service definition in `docker-compose.yml`.


---


<!-- ========== 04-feature-flags.md ========== -->

# 04 — Feature Flags & Config Toggles

LeadThur has **no feature-flag service** (LaunchDarkly, etc.). Control is via environment variables, hostname checks, and constants.

---

## Environment variables (behavioral)

| Variable | Effect | Typical staging | Typical production |
|----------|--------|-----------------|--------------------|
| `DEMO_MODE=true` | Mounts `/demo` API router | Optional | Off |
| `NEXT_PUBLIC_DEMO_MODE=true` | Frontend demo enable | Optional | Off |
| `MOCK_OUTREACH_SEND=1` | Stub outreach SMTP sends | Recommended | Off |
| `MOCK_OUTREACH_SEND_FAIL_FOR` | Force fail for test recipient | QA only | Off |
| `MOCK_OUTREACH_SEND_HARD_BOUNCE_FOR` | Simulate hard bounce | QA only | Off |
| `MOCK_OUTREACH_SEND_SOFT_FAIL_FOR` / `_CODE` | Soft fail simulation | QA only | Off |
| `MOCK_MAILBOX_SMTP=1` | Skip real SMTP verify on connect | QA only | Off |
| `ENABLE_TEST_EMAIL=true` | Unauthenticated `/admin/test-email` | Optional | Off |
| `OUTREACH_SEND_SKIP_SPACING=1` | Skip send spacing | QA only | Off |
| `RATE_LIMIT_IP_ALLOWLIST` | Bypass IP rate limits | QA IPs | Minimal / empty |
| `REDIS_URL` | BullMQ vs inline | Set | Set |
| `NODE_ENV` | `development` enables demo page | — | `production` |
| `FRONTEND_URL` contains `staging.leadthur.com` | Auto-enables admin test-email path | Yes | No |
| Search budget envs | `PHASE1_DEADLINE_MS`, `BACKGROUND_MAPS_BUDGET_MS`, `SEARCH_JOB_TIMEOUT_MS`, `BULLMQ_LOCK_DURATION_MS`, `SCRAPER_CONCURRENCY`, `WORKER_CONCURRENCY` | May be lower concurrency | Tuned for volume |

---

## Hostname / branch detection (code)

| Check | Location | Effect |
|-------|----------|--------|
| Host includes `staging.leadthur` or `staging-` | `frontend/app/demo/page.tsx` | Enable `/demo` UI without env |
| `VERCEL_GIT_COMMIT_REF === "staging"` | `frontend/next.config.ts` | Point API to staging backend |
| `FRONTEND_URL` includes `staging.leadthur` | `email-template.ts`, `outreach-send-service.ts` | Tracking/base URLs → staging-backend |
| `window.location.hostname === staging.leadthur.com` | `admin/page.tsx` | Demo-related admin UI affordance |

---

## Constants (not env flags)

| Constant area | File | Notes |
|---------------|------|-------|
| Lifetime price | `constants/pricing.ts` | $25 / ₦25k |
| Outreach tiers | `constants/outreach-pricing.ts` | Starter/Growth/Scale |
| Trial search caps | free-trial repos | 2/email, 2/IP |
| Scraper defaults | `scraper/utils/constants.ts` | Budgets, max leads |

Changing these requires a code deploy — not a runtime flag.

---

## Demo mode

| Layer | Behavior |
|-------|----------|
| Backend | `DEMO_MODE=true` → `/demo/search` |
| Frontend `/demo` | Enabled if env **or** staging host **or** `NODE_ENV=development` |
| `/demo-recording` | Public route for recording mock (no license gate on page) |

---

## Development mode

- `NODE_ENV=development`: demo page on; looser local workflows  
- Local `.env` may enable mocks  

---

## Admin mode

- Not a flag: separate JWT auth with env `ADMIN_EMAIL` / `ADMIN_PASSWORD`  
- Staging/prod share same mechanism; different secrets per env  

---

## Hidden / disallowed routes

`robots.ts` disallows `/admin`, `/activate`, `/dashboard`, `/demo` — still reachable by URL.

---

## Experimental features

| Feature | Status |
|---------|--------|
| Demo search | Experimental / sales |
| Mock outreach suite | Staging/QA |
| Admin unauth test-email | Staging/local only path |
| Formal feature-flag framework | **Not Found** |

---

## Database-driven “flags”

| Mechanism | Effect |
|-----------|--------|
| `free_trial_signups.sequence_paused` | Stops nurture for user / default |
| `license_keys.is_suspended` | Blocks paid access |
| `outreach_accounts.subscription_status` | Outreach entitlement |

These are product state, not deploy flags.


---


<!-- ========== 05-background-services.md ========== -->

# 05 — Background Services (Staging)

All services below run in (or alongside) the **staging backend container**, unless noted.

---

## 1. Express API

| Item | Detail |
|------|--------|
| Start | `node dist/server.js` (Docker CMD) / `tsx watch src/server.ts` (dev) |
| Port | `3000` |
| Health | `GET /health`, `GET /api/health`, `GET /health/ready` |
| Staging URL | `https://staging-backend.leadthur.com` |

**Healthy when:** JSON `status: "ok"`, not Next.js HTML; `gitCommitSha` present.

```bash
curl -sS https://staging-backend.leadthur.com/health | jq '{status,browser,queue:.queue.mode,sha:.gitCommitSha,ipCap:.freeTrialIpCapReady}'
```

---

## 2. Search queue + worker (BullMQ or inline)

| Item | Detail |
|------|--------|
| Start | `initSearchQueue()` during `start()` in `server.ts` |
| Redis | Required for BullMQ; else inline fallback |
| Worker | `search-worker.ts` in-process |
| Verify | `/health` → `queue.mode` is `"bullmq"` (staging probe: bullmq) |

Also: orphan reconcile interval inside search-queue.

---

## 3. Outreach send queue + worker

| Item | Detail |
|------|--------|
| Start | `initOutreachSendQueue()` on boot |
| Worker | `outreach-send-worker.ts` |
| Mock | If `MOCK_OUTREACH_SEND=1`, SMTP stubbed |
| Verify | Send test via staging UI/scripts `verify-outreach-staging*.mjs`; check logs |

---

## 4. Redis

| Item | Detail |
|------|--------|
| Start | External process / managed Redis — **Not Found** in compose |
| Config | `REDIS_URL` in Coolify env |
| Verify | Health `queue.mode === "bullmq"` |

---

## 5. Playwright / browser pool

| Item | Detail |
|------|--------|
| Start | `initBrowserPoolSafe()` after routes (retries) |
| Role | Google Maps scrape + email site crawl |
| Verify | `/health.browser === "ready"` |

If `initializing` for long periods, scrapes fail or queue.

---

## 6. Trial email scheduler

| Item | Detail |
|------|--------|
| Start | `startTrialSequenceScheduler()` — hourly |
| Role | Nurture sequence + post-search emails |
| Verify | Logs `Trial email sequence scheduler started`; DB `sequence_paused`; staging Resend/Zepto activity |

**Caution:** Staging can email real addresses if signups exist and sequence not paused.

---

## 7. Outreach grace scheduler

| Item | Detail |
|------|--------|
| Start | `startOutreachGraceScheduler()` — hourly |
| Role | Expire grace-period outreach accounts |
| Verify | Boot log; account status transitions |

---

## 8. Startup migrations

| Item | Detail |
|------|--------|
| Start | `runStartupMigrations()` if `SUPABASE_DB_PASSWORD` set |
| Role | IP usage table, sequence columns, v3 migration/backfill |
| Verify | `/health.freeTrialIpCapReady === true`; Coolify logs |

---

## 9. Paystack outreach plan ensure

| Item | Detail |
|------|--------|
| Start | `ensureOutreachPaystackPlans()` if `PAYSTACK_SECRET_KEY` set |
| Verify | Boot logs; `outreach_paystack_plans` rows |

---

## 10. Frontend (Vercel)

| Item | Detail |
|------|--------|
| Start | Vercel deployment of `frontend` |
| Not | Does not run queues/scrapers |
| Verify | Open `https://staging.leadthur.com` (may require Vercel SSO) |

---

## Health checklist (staging)

| Check | Command / action | Pass |
|-------|------------------|------|
| API up | `curl …/health` | `status: ok` |
| Not FE | Body has no Next.js | Pass |
| Browser | `browser: ready` | Pass |
| Queue | `queue.mode: bullmq` | Pass |
| Memory | `memory.safe: true` | Pass |
| IP cap | `freeTrialIpCapReady: true` | Pass |
| DeepSeek | `deepseek.configured` if AI needed | Pass |
| Commit | SHA matches intended staging deploy | Pass |
| Ready | `GET /health/ready` | 200 |

```bash
bash backend/scripts/verify-deployment.sh https://staging-backend.leadthur.com
```

---

## What is NOT a separate staging service

- Dedicated cron container — **Not Found**  
- Dedicated worker Dyno/service — **Not Found**  
- Separate email worker — **Not Found**  
- Redis in docker-compose — **Not Found**


---


<!-- ========== 06-release-checklist.md ========== -->

# 06 — Release Checklist (Staging → Production)

Official checklist before promoting LeadThur V2 work to production.  
Run on **staging** first. Re-run smoke on **production** after deploy.

---

## A. Environment readiness

- [ ] Staging FE reachable (Vercel SSO bypass arranged for QA if needed)
- [ ] Staging BE `GET /health` → `status: ok`, `browser: ready`, `queue.mode: bullmq`
- [ ] Staging `gitCommitSha` matches intended staging commit
- [ ] Staging DB is **not** production Supabase
- [ ] `MOCK_OUTREACH_SEND` intentional (on for safe QA / off for live SMTP test)
- [ ] Paystack/Flutterwave **test** keys on staging
- [ ] Production deploy credentials: `COOLIFY_DEPLOY_WEBHOOK_URL` or VPS secrets present for `main`

---

## B. Health / infrastructure

- [ ] `bash backend/scripts/verify-deployment.sh https://staging-backend.leadthur.com` all pass
- [ ] `/health/ready` 200
- [ ] `/health/client-ip` shows expected IP; allowlist if QA blocked by rate limit
- [ ] Memory `safe: true`
- [ ] Redis/BullMQ mode confirmed
- [ ] Playwright/browser ready

---

## C. UI / UX

- [ ] Marketing home loads
- [ ] Free trial gate + 1 search completes
- [ ] Checkout page loads (do not charge live cards on staging)
- [ ] Activate with staging license
- [ ] Dashboard search → results stream/poll
- [ ] CSV export
- [ ] Lead status change
- [ ] WhatsApp modal opens
- [ ] Outreach mailbox connect (mock or real)
- [ ] Outreach send (mock or real)
- [ ] `/dashboard/plans` checkout init (test mode)
- [ ] Admin login + account lookup
- [ ] No unintended layout regressions vs approved designs

---

## D. Responsive

- [ ] Desktop (~1440)
- [ ] Tablet (~768)
- [ ] Mobile (~390)
- [ ] Critical CTAs tappable (min ~48px)

---

## E. Accessibility (minimum bar)

- [ ] Keyboard reach primary flows (activate, search submit, modal close)
- [ ] Forms have visible labels
- [ ] Focus visible on interactive controls
- [ ] No critical contrast failures on primary text

---

## F. Performance

- [ ] Search returns first leads without UI freeze
- [ ] SSE or poll recovers if stream drops
- [ ] Large result set scroll usable (virtualized table)
- [ ] Admin tables usable (horizontal scroll OK)

---

## G. Payments

- [ ] Staging initialize checkout returns authorization URL / Flutterwave config
- [ ] Webhook target for staging documented and configured in Paystack dashboard (**confirm outside repo if needed**)
- [ ] No production live keys on staging
- [ ] After promote: production webhook still `https://backend.leadthur.com/webhooks/paystack`

---

## H. Search / scraping

- [ ] Paid search job completes to `fullyComplete`
- [ ] Emails enrich (or predicted) without crash
- [ ] Trial limits: 2/email and IP cap behave
- [ ] Queue does not stall (watch Coolify logs / health queue depth)

---

## I. Outreach

- [ ] Mailbox connect path works under current mock/live setting
- [ ] Send queues and appears in Sends report
- [ ] Open pixel URL points at staging-backend when on staging
- [ ] Bounce/mock paths if testing bounce handling

---

## J. License / affiliate / admin

- [ ] Activate stores license; dashboard gate passes
- [ ] Suspended flow (if tested) lands on `/suspended`
- [ ] Affiliate stats load for licensed user
- [ ] Admin generate-access / lookup / suspend (staging only)
- [ ] Blog public read; admin edit on staging if changed

---

## K. Email / analytics

- [ ] Transactional test send (welcome/access) if changed
- [ ] Trial sequence **paused or carefully tested** (avoid blasting)
- [ ] Site scripts: test on staging before production save (admin warning exists in UI)

---

## L. Promotion to production

- [ ] Staging QA signed off
- [ ] UX / design approval recorded
- [ ] Merge to `main`
- [ ] GitHub Actions production backend deploy green
- [ ] Vercel production frontend updated
- [ ] `https://backend.leadthur.com/health` SHA matches release
- [ ] Production smoke: activate/search OR documented critical path
- [ ] Monitor Coolify logs 30–60 minutes post-release

---

## Scripts that help (staging)

Located under `backend/scripts/`:

- `verify-deployment.sh`
- `verify-outreach-staging.mjs` / `verify-outreach-staging-live.mjs`
- `verify-trial-limit-staging.mjs`
- `verify-staging-migrations.mjs`
- `verify-mailbox-flow.mjs` (uses `.env.staging`)

Run only against staging credentials.


---


<!-- ========== 07-known-limitations.md ========== -->

# 07 — Known Limitations (Staging)

Facts from repo + live probes. Temporary workarounds noted where documented.

---

## Access / hosting

| Limitation | Detail |
|------------|--------|
| Vercel SSO on staging FE | `staging.leadthur.com` returned 302 → Vercel SSO — anonymous QA blocked unless Deployment Protection disabled or bypassed |
| No GHA staging backend deploy | Only production `deploy.yml` exists; staging Coolify redeploy may be manual |
| Staging BE SHA drift | Probe showed staging `a340bf5` vs production `8a2af24` — staging may lack latest fixes |
| Coolify staging IaC | **Not Found** in repo |

---

## Data / secrets

| Limitation | Detail |
|------------|--------|
| Staging Supabase ref | Placeholder only in `.env.staging.example` — not committed |
| Staging webhook URL | Paystack staging webhook **Not Found** in docs (prod URL only) |
| Shared email providers | If staging uses same Zepto/Resend domain as prod, reputation risk |

---

## Mocks / shortcuts

| Shortcut | Purpose | Risk if left on in prod |
|----------|---------|-------------------------|
| `MOCK_OUTREACH_SEND=1` | Skip real SMTP | Fake “successful” sends |
| `MOCK_MAILBOX_SMTP=1` | Skip SMTP verify | Invalid mailboxes accepted |
| Mock bounce/fail envs | QA bounce paths | Distorts metrics |
| `ENABLE_TEST_EMAIL` / staging FRONTEND_URL | Test email endpoints | Abuse if exposed on prod |
| `RATE_LIMIT_IP_ALLOWLIST` | QA bypass | Weakens abuse protection if too broad |
| Demo mode on staging host | Sales demos | OK on staging; must stay off prod |

---

## Product / technical

| Limitation | Detail |
|------------|--------|
| Maps HTML scraping | Fragile; captchas/blocks affect staging and prod equally |
| Inline queue fallback | If Redis missing, single-process only — staging currently has BullMQ |
| Lower concurrency | Staging observed `maxConcurrent: 2` vs prod 5 |
| Trial nurture scheduler | Runs in staging; can email real users if data + unpaused |
| No light mode | Dark-only FE |
| Client-only FE auth gates | Staging FE can show pages that APIs reject |
| Dual success URLs | `/payment-success` vs `/checkout/success` |
| Legacy Brevo vars | Still in some env examples / CORE_FLOWS; current code uses Zepto/Resend |

---

## Missing services (vs idealized staging)

| Ideal | Reality |
|-------|---------|
| Automated staging deploy pipeline | Partial (FE via Vercel; BE Not Found in GHA) |
| Isolated email subdomain | **Not Found** in docs |
| Seeded QA accounts doc | **Not Found** |
| Staging status page | **Not Found** (use `/health`) |
| Feature-flag console | **Not Found** |

---

## Workarounds in use

1. `RATE_LIMIT_IP_ALLOWLIST` for QA IPs (`DEPLOYMENT.md`).  
2. `MOCK_OUTREACH_SEND=1` until Gmail SMTP verified (`backend/.env.example`).  
3. Demo enabled by hostname so Vercel Preview env scoping is less fragile (`demo/page.tsx` comment).  
4. `next.config.ts` auto-selects staging API URL when branch/host is staging.

---

## Known bugs

Runtime bug tracker in repo: **Not Found** (no committed issue list).  
Treat production incident notes (email bounce, migration scheduling) as requiring staging verification before resume — see engineering incident history outside this folder.


---


<!-- ========== 08-qa-process.md ========== -->

# 08 — QA Process (LeadThur V2)

Every feature that ships through staging must pass this process before production approval.

---

## Principles

1. **Staging is the source of truth for “done.”** Production is promotion, not discovery.  
2. **No silent UX invention.** QA validates against approved specs/mockups.  
3. **Real devices when possible;** otherwise Chrome DevTools device mode + one real phone.  
4. **Failures block release** unless Product Owner accepts a documented waiver.

---

## Test matrix (required)

| Dimension | Required coverage |
|-----------|-------------------|
| Desktop | ~1440×900 |
| Tablet | ~768×1024 |
| Mobile | ~390×844 |
| Chrome | Latest stable |
| Safari | Latest stable (macOS/iOS) |
| Firefox | Latest stable |
| Edge | Latest stable |
| Theme | Dark (only mode today); if light added later, both |
| Loading | Spinners/progress for search, checkout, admin |
| Errors | Invalid input, 4xx/5xx, payment fail, search fail |
| Offline | Disconnect mid-search; UI should not crash |
| Slow network | Chrome throttling “Slow 3G” on search + activate |
| Accessibility | Keyboard primary path; labels; focus; contrast spot-check |
| Keyboard | Tab/Enter/Escape on modals and forms |
| Performance | Search usable; no multi-second UI lock on results scroll |

---

## Feature-type checklists

### UI-only / redesign

- [ ] Matches approved design (spacing, type, CTAs)  
- [ ] No broken marketing↔app chrome  
- [ ] Responsive matrix above  
- [ ] Empty / loading / error / success states  

### Search / scraping

- [ ] Start search, see queue/progress  
- [ ] Leads appear via SSE or poll  
- [ ] `fullyComplete` end state  
- [ ] Export CSV  
- [ ] Trial limits if trial-facing  

### Payments

- [ ] Initialize with **test** keys only on staging  
- [ ] Success and failure paths  
- [ ] License row / outreach balance updates  

### Outreach

- [ ] Confirm mock vs live SMTP setting  
- [ ] Connect mailbox path  
- [ ] Send + Sends report  
- [ ] Tracking URL host = staging-backend  

### Admin

- [ ] Login  
- [ ] Changed panel only + one regression smoke (lookup)  
- [ ] No production site-scripts edits from staging confusion  

---

## Roles in QA

| Role | Responsibility |
|------|----------------|
| Implementer (Cursor/dev) | Self-test on staging; attach SHA + notes |
| QA Lead | Matrix execution; log defects |
| Designer / UX | Visual & interaction approval on staging URL |
| Product Architect | Scope / waiver decisions |
| Production Owner | Final go/no-go for `main` promote |

---

## Defect severity

| Severity | Definition | Release rule |
|----------|------------|--------------|
| Blocker | Data loss, payment wrong env, cannot activate/search | No release |
| Major | Core flow broken on one major browser | No release unless waiver |
| Minor | Cosmetic / edge | May ship with ticket |
| Nit | Polish | Backlog |

---

## Evidence to attach before approval

1. Staging FE URL + BE `/health` JSON (SHA)  
2. Short screen recording or screenshots of happy path  
3. Checklist ticks for this feature type  
4. List of known issues / waivers  

---

## Explicit non-goals for QA

- Do not run destructive admin tools against production.  
- Do not unpause nurture on staging without a plan.  
- Do not use live Paystack keys on staging.


---


<!-- ========== 09-redesign-workflow.md ========== -->

# 09 — Redesign Workflow (LeadThur V2) — MOST IMPORTANT

This is the **official** process for every LeadThur V2 redesign and feature.

---

## Pipeline

```text
Product Decision
        ↓
UX Design (Figma / specs — outside Cursor inventing UI)
        ↓
Design Approval (Designer + Product Architect)
        ↓
Technical Specification (APIs, states, constraints)
        ↓
Cursor / Developer Implementation (against the spec only)
        ↓
Deploy to Staging (frontend + backend)
        ↓
QA Review (08-qa-process.md matrix)
        ↓
UX Review (on staging URL, not localhost alone)
        ↓
Fixes (still on staging)
        ↓
Final Approval (Product Architect + Production Owner)
        ↓
Production Release (main + verify health)
```

---

## Hard rules for Cursor / implementers

1. **Cursor must never invent UX.**  
   No new layouts, IA, copy hierarchy, or interaction patterns unless they appear in an approved specification or design.

2. **Cursor must never redesign layouts without specifications.**  
   Bugfixes that preserve existing UX are OK. Visual redesigns require Design Approval first.

3. **Every redesign must be reviewed on staging before production.**  
   Localhost-only approval is insufficient.

4. **Staging is the contract.**  
   If it is not on staging, it is not releasable.

5. **Do not “improve” marketing or dashboard aesthetics ad hoc.**  
   File a product decision instead.

---

## Responsibilities

| Role | Owns | Does not |
|------|------|----------|
| **Product Architect** | Problem, priority, acceptance criteria, waivers | Pixel design in Cursor chats without designer |
| **Designer** | Visual/UX specs, design system, staging visual sign-off | Deploying production |
| **Cursor (AI implementer)** | Code matching the approved spec; staging-ready PR | Inventing UX; skipping staging |
| **Developer** | Reviews AI diffs; owns merge quality; env correctness | Silent scope expansion |
| **QA** | Matrix testing on staging; defect log | Design invention |
| **Production Owner** | Go/no-go to `main`; Coolify/Vercel production; incidents | Skipping checklist |

---

## Artifacts required at each gate

| Gate | Artifact |
|------|----------|
| Product Decision | Written problem + success metric |
| Design Approval | Linked mockups / written UX notes |
| Technical Spec | Endpoints, states, empty/error/loading, mobile behavior |
| Implementation | PR + staging SHAs |
| QA | Checklist + evidence |
| UX Review | Written approve/reject on staging |
| Production | Release checklist (`06`) complete |

---

## What “reviewed on staging” means

- Open **`https://staging.leadthur.com`** (with SSO access if required).  
- Confirm API traffic hits **`https://staging-backend.leadthur.com`**.  
- Confirm backend `/health.gitCommitSha` matches the build under test.  
- Exercise the changed flow on desktop + mobile.  
- Designer signs off **in writing** (PR comment, Linear, Notion, etc.).

---

## Mapping to current tooling (honest)

| Step | Current support |
|------|-----------------|
| Spec → code | Cursor in repo |
| FE → staging | Vercel on `staging` branch |
| BE → staging | Coolify staging service — **automation Not Found in GHA** |
| FE → production | Vercel on `main` |
| BE → production | GHA `deploy.yml` + Coolify webhook |
| QA automation | Manual + `backend/scripts/verify-*.mjs` |

Until staging backend CI exists, Production Owner must confirm Coolify staging redeploy as part of the Implementation → Staging step.

---

## Anti-patterns (forbidden)

- Shipping UI straight to `main` / production domains for “just a small redesign.”  
- Using production admin to “try” experimental scripts.  
- Enabling `MOCK_OUTREACH_SEND` on production.  
- Approving designs only from Storybook/localhost when staging exists.  
- Cursor expanding scope (“while here, I also redesigned pricing”).

---

## Minimal template for a V2 change request

```text
Title:
Problem:
Approved design link:
Technical notes (API/state):
Staging FE URL:
Staging BE SHA:
QA result:
UX approval:
Prod owner approval:
```


---

*End of staging handbook.*
