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
