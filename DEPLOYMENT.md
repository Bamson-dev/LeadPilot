# Coolify Deployment Guide

## Backend Service Configuration

Go to your Coolify dashboard → LeadPilot **backend** service → **Configuration**.

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
- `FRONTEND_URL` (e.g. `https://www.leadpilot.live`)
- `PORT=3000`
- `NODE_ENV=production`

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

`backend.leadpilot.live` → A record to Contabo VPS IP, **Proxied** (orange cloud).

`app.set('trust proxy', 1)` is enabled so rate limits and logs see the real client IP behind Cloudflare.

## Vercel (frontend)

| Setting | Value |
|---------|-------|
| Root Directory | `frontend` |
| `NEXT_PUBLIC_API_URL` | `https://backend.leadpilot.live` |

See [`deploy/VERCEL.md`](./deploy/VERCEL.md).

## Testing Production

```bash
bash backend/scripts/verify-deployment.sh https://backend.leadpilot.live
```

All five tests should pass before connecting the dashboard.
