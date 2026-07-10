# Coolify Deployment Guide

## Backend Service Configuration

Go to your Coolify dashboard → LeadThur **backend** service → **Configuration**.

Set these values exactly:

| Setting | Value |
|---------|-------|
| Base Directory | `/` (monorepo root) |
| Dockerfile Path | `backend/Dockerfile` |
| Port | `3000` |
| Health Check Path | `/health` |

**IMPORTANT:** Base Directory must be `/` (the monorepo root).  
Never set it to `/backend`. The Dockerfile copies `/shared` and the root `package.json` — a `/backend` context will fail or build the wrong app.

Do **not** use the frontend Dockerfile or point Coolify at `frontend/`.

## Environment Variables in Coolify

Copy every variable from [`backend/.env.example`](./backend/.env.example) into Coolify → backend service → **Environment Variables**.

Required minimum:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_KEY` (service_role only)
- `FRONTEND_URL` (e.g. `https://www.leadthur.com`)
- `PORT=3000`
- `NODE_ENV=production`

Optional for staging QA (does **not** bypass per-email trial search limits):

- `RATE_LIMIT_IP_ALLOWLIST=162.120.188.117` — comma-separated IPs that skip the per-IP request rate limit on `/freetrial` and other rate-limited routes

## After Deploying

SSH into the Contabo VPS and run:

```bash
docker exec -it <backend-container-name> curl http://127.0.0.1:3000/health
```

Expected response (JSON, **not** Next.js HTML):

```json
{"status":"ok","timestamp":"..."}
```

If you see Next.js HTML, the wrong Dockerfile or Base Directory was used. Fix Coolify settings and redeploy.

## Local test before push

From monorepo root:

```bash
docker compose --env-file .env.production up --build
bash backend/scripts/verify-deployment.sh http://localhost:3000
```

## Cloudflare DNS

`backend.leadthur.com` → A record to Contabo VPS IP, **Proxied** (orange cloud).

`app.set('trust proxy', 1)` is enabled so rate limits and logs see the real client IP behind Cloudflare.

To verify which IP the backend resolves for your browser (after deploy), open DevTools on any page and run:

```javascript
fetch("https://staging-backend.leadthur.com/health/client-ip").then((r) => r.json()).then(console.log)
```

Check `resolvedIp` and `allowlisted`. If `allowlisted` is false, add `resolvedIp` to `RATE_LIMIT_IP_ALLOWLIST` in Coolify (not the IP from a script with a spoofed `X-Forwarded-For` header).

## Vercel (frontend)

| Setting | Value |
|---------|-------|
| Root Directory | `frontend` |
| `NEXT_PUBLIC_API_URL` | `https://backend.leadthur.com` |

See [`deploy/VERCEL.md`](./deploy/VERCEL.md).

## Testing Production

```bash
bash backend/scripts/verify-deployment.sh https://backend.leadthur.com
```

All five tests should pass before connecting the dashboard.

## Long-running search jobs (timeouts)

Search jobs run as **background queue work**, not inside the HTTP request that starts them. These layers must **not** kill a job during Phase 1 background extraction (large cities can take 15+ minutes before Phase 2 email scraping starts).

| Layer | Default risk | What to set |
|-------|----------------|-------------|
| **Application inline queue** | Was 5 min (fixed in code) | No config — jobs run until Phase 1 + Phase 2 budgets complete |
| **BullMQ worker** | Default `lockDuration` 30s caused stalled jobs on long Phase 1 (fixed in code to 15 min) | `REDIS_URL` must be set so BullMQ is used; check `/health` → `queue.mode` is `bullmq` |
| **Docker HEALTHCHECK** | 10s per check only — does **not** kill long jobs | No change needed (`backend/Dockerfile`) |
| **Node HTTP server** | `requestTimeout` 120s — applies to HTTP only, **not** queue workers | No change needed |
| **Coolify / Traefik proxy** | Can timeout idle HTTP connections (SSE `/search/:id/stream`) | In Coolify → backend → **Advanced**, if Traefik timeouts exist set `read timeout` ≥ **600s** for SSE; search **processing** is not proxy-bound |
| **Nginx** (if used in front of Coolify) | `proxy_read_timeout` default 60s breaks SSE | Add `proxy_read_timeout 600s;` and `proxy_buffering off;` in the `location /` block (see [`deploy/VPS.md`](./deploy/VPS.md)) |

After deploy, confirm a large search logs `[search-lifecycle]` stages: `phase1_heartbeat` every 30s → `phase1_complete` → `phase2_attempt_start` → `phase2_first_playwright_tab` → `phase2_complete`.
