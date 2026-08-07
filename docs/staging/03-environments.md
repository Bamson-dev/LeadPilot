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
| Feature flags | Staging hostname → demo UI; **no MOCK_* on Coolify** | Demo off; no mock sends |
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
| Auto BE deploy | No | Coolify git-push on `staging` | Yes (`deploy.yml`) |
| Auto FE deploy | No | Vercel on push (if linked) | Vercel on push |
| DB | Dev project | Staging project | Prod project |
| DEMO `/demo` | Yes (NODE_ENV) | Yes (hostname) | No (default) |
| MOCK outreach | Local scripts only | **Forbidden on Coolify** (P0-3) | Must be unset |
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
