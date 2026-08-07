# 01 — Staging Overview

**Sources:** `DEPLOYMENT.md`, `deploy/VERCEL.md`, `backend/.env.example`, `backend/.env.staging.example`, `frontend/next.config.ts`, `frontend/app/demo/page.tsx`, `backend/src/server.ts`, live `GET /health` probes (2026-08-04).

---

## What staging is

Staging is LeadThur’s pre-production environment: a full stack that mirrors production behavior but uses **separate hosts**, a **separate Supabase project** (documented as “LeadPilot Staging”), and **Paystack test keys** where applicable.

**RC1 note:** Staging Coolify runs the same hardened `NODE_ENV=production` image as production. Mock outreach/mailbox flags and `DEMO_MODE` / `ENABLE_TEST_EMAIL` **must stay unset** or the API will not register routes.

It is the intended place to implement, review, and approve **LeadThur V2** work before production.

---

## Why it exists

- Validate search scraping, payments, outreach, licenses, and admin without touching production data or reputation (email/SMS/payment).
- Exercise real Gmail SMTP and mailbox verification on staging (same as production binary).
- Let Vercel Preview / `staging` branch frontend talk to `staging-backend.leadthur.com`.

---

## How it differs from production

| Concern | Staging | Production |
|---------|---------|------------|
| Frontend host | `https://staging.leadthur.com` | `https://www.leadthur.com` |
| Backend host | `https://staging-backend.leadthur.com` | `https://backend.leadthur.com` |
| Git branch (typical) | `staging` | `main` |
| Frontend deploy | Vercel (branch / Preview); demo auto-enabled on staging host | Vercel Production |
| Backend deploy workflow in GitHub | **Not Found** (Coolify git-push trigger on service) | `.github/workflows/deploy.yml` → Coolify → `backend.leadthur.com` |
| Database | Separate staging Supabase (`YOUR_LEADPILOT_STAGING_REF` in `.env.staging.example`) | `oytbynwogudfqqaxxrjq` (`DEPLOYMENT.md`) |
| Demo UI `/demo` | Enabled on staging **hostname** (frontend) | Disabled unless env |
| Outreach SMTP | **Real Gmail SMTP** (MOCK_* forbidden under production NODE_ENV) | Live Gmail SMTP |
| Admin test email | **Not available** (requires non-prod + ENABLE_TEST_EMAIL) | Not available (P0-6) |
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

Critical staging Coolify vars (see `04-feature-flags.md` for forbidden list):

- `FRONTEND_URL=https://staging.leadthur.com`
- **Do not set** `MOCK_OUTREACH_SEND`, `MOCK_MAILBOX_SMTP`, `ENABLE_TEST_EMAIL`, `DEMO_MODE`
- `OUTREACH_TRACKING_BASE_URL=https://staging-backend.leadthur.com` (optional)
- `RATE_LIMIT_IP_ALLOWLIST=...` for QA IPs
- Paystack **test** keys (`sk_test_...`)
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
| Outreach | User Gmail SMTP | Real SMTP (use disposable test recipients) |

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
