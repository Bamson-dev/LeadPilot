# Fix Vercel 404 — DEPLOYMENT_NOT_FOUND

That error means Vercel has **no successful deployment** at the URL you opened (deleted build, wrong link, or build never finished).

## One-time project settings

In [Vercel Dashboard](https://vercel.com) → your project → **Settings** → **General**:

| Setting | Value |
|---------|--------|
| **Root Directory** | `frontend` |
| **Framework Preset** | Next.js |
| **Node.js Version** | 20.x |

Leave **Build Command** and **Install Command** empty — `frontend/vercel.json` sets them.

## Environment variables

Settings → **Environment Variables** → **Import .env** → upload `deploy/vercel.env.example` (after filling in real values).

Required:

- `NEXT_PUBLIC_API_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

Apply to **Production**, **Preview**, and **Development**.

## Redeploy

1. **Deployments** → latest failed deploy → open **Build Logs** if any failed
2. Click **Redeploy** on `main`, or push a new commit to GitHub
3. Open the URL from **Domains** (e.g. `your-project.vercel.app`) — not an old preview link

## If build still fails

Common fixes:

- Root Directory must be exactly `frontend` (not repo root)
- Run locally from repo root: `npm install && npm run build:frontend`
- Ensure all three `NEXT_PUBLIC_*` env vars are set before deploy
