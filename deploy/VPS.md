# LeadPilot Backend — Contabo VPS Deployment

Architecture: **Vercel (frontend)** + **Contabo VPS (backend)** + **Supabase (database)**

Deploy flow: push to `main` → GitHub Actions → SSH → Docker rebuild → auto restart

---

## One-time VPS setup

SSH into your Contabo VPS as root:

```bash
curl -fsSL https://raw.githubusercontent.com/Bamson-dev/LeadPilot/main/scripts/vps-setup.sh | bash -s /opt/leadpilot
```

Or manually:

```bash
git clone https://github.com/Bamson-dev/LeadPilot.git /opt/leadpilot
cd /opt/leadpilot
cp .env.production.example .env.production
nano .env.production   # fill in Supabase + Vercel URL
chmod +x scripts/deploy-vps.sh
bash scripts/deploy-vps.sh
```

Verify:

```bash
curl http://127.0.0.1:3001/health
# {"status":"ok"}
```

---

## Environment file

On the VPS, create `/opt/leadpilot/.env.production` from:

- [`.env.production.example`](../.env.production.example) (repo root)
- [`deploy/vps.env.example`](./vps.env.example) (downloadable copy)

| Variable | Description |
|----------|-------------|
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_KEY` | Service role key (secret) |
| `FRONTEND_URL` | Vercel app URL (CORS) |
| `SCRAPER_CONCURRENCY` | `2` recommended on 4GB VPS |
| `BACKEND_PORT` | Host port (default `3001`) |

---

## GitHub Actions secrets

Repo → **Settings → Secrets and variables → Actions**

| Secret | Example |
|--------|---------|
| `VPS_HOST` | `123.45.67.89` |
| `VPS_USER` | `root` or deploy user |
| `VPS_SSH_KEY` | Private SSH key (full PEM) |
| `VPS_PORT` | `22` (optional) |
| `VPS_APP_DIR` | `/opt/leadpilot` (optional) |

### Generate deploy key (recommended)

On your Mac:

```bash
ssh-keygen -t ed25519 -C "leadpilot-deploy" -f ~/.ssh/leadpilot_deploy -N ""
ssh-copy-id -i ~/.ssh/leadpilot_deploy.pub root@YOUR_VPS_IP
cat ~/.ssh/leadpilot_deploy   # paste into VPS_SSH_KEY secret
```

---

## Automatic deployment

Every push to `main` that touches `backend/`, `shared/`, or `docker-compose.yml` triggers [`.github/workflows/deploy.yml`](../.github/workflows/deploy.yml):

1. SSH into VPS
2. `git pull` latest `main`
3. `docker compose --env-file .env.production up -d --build`
4. Health check `GET /health`

Manual trigger: **Actions → Deploy Backend to VPS → Run workflow**

---

## Reverse proxy (recommended)

Expose backend via Nginx with HTTPS:

```nginx
server {
    listen 443 ssl;
    server_name api.yourdomain.com;

    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_buffering off;  # required for SSE /search/:id/stream
    }
}
```

Set Vercel `NEXT_PUBLIC_API_URL=https://api.yourdomain.com`

---

## Operations

```bash
cd /opt/leadpilot

# Logs
docker compose --env-file .env.production logs -f backend

# Restart
docker compose --env-file .env.production restart backend

# Rebuild manually
bash scripts/deploy-vps.sh
```

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Chromium crashes | Ensure `shm_size: 512mb` in compose; lower `SCRAPER_CONCURRENCY` to `2` |
| Health check fails | `docker compose logs backend` — check Supabase env vars |
| CORS errors | Set `FRONTEND_URL` to exact Vercel URL (no trailing slash) |
| SSE disconnects | Disable proxy buffering in Nginx |

Verbose health: `curl http://127.0.0.1:3001/health?verbose=1`
