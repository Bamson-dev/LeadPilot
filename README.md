# LeadPilot

Premium business discovery and prospecting platform — find businesses, contacts, and export prospect lists for outreach.

## Stack

- **Frontend:** Next.js 15, TypeScript, Tailwind CSS, Framer Motion
- **Backend:** Next.js API routes (SSE streaming)
- **Database:** Supabase PostgreSQL (optional)
- **Discovery engine:** Playwright (server-side Chromium)

## Local setup

```bash
npm install
npm run setup          # install Playwright Chromium
npm run dev            # http://localhost:3000
```

Production-like local test:

```bash
npm run build
npm run start
```

## Environment variables

Copy `.env.example` to `.env.local` (optional for local dev):

| Variable | Required |
|----------|----------|
| `NEXT_PUBLIC_SUPABASE_URL` | No (in-memory search works without) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | No |
| `SUPABASE_SERVICE_ROLE_KEY` | No |

## Deploy to Railway (from GitHub)

1. Push this repo to GitHub (see below).
2. [Railway](https://railway.app) → **New Project** → **Deploy from GitHub repo**.
3. Select your `leadpilot` repository.
4. Railway uses the included `Dockerfile` (Playwright + Next.js).
5. Add environment variables from `.env.example` if using Supabase.
6. Deploy — open the generated public URL.

**Health check:** `GET /api/health` (Playwright + network)

**Note:** Do not use Vercel for the full app — serverless cannot run Playwright reliably. Use Railway, Render, or a VPS.

## Deploy to GitHub

```bash
git add .
git commit -m "Initial LeadPilot release"
git remote add origin https://github.com/YOUR_USER/leadpilot.git
git push -u origin main
```

Or use GitHub CLI: `gh repo create leadpilot --public --source=. --push`

## Routes

| Route | Description |
|-------|-------------|
| `/` | Landing page |
| `/dashboard` | Search & live results |
| `/api/health` | Playwright health check |

## Limits (MVP)

- Max **200** prospects per search
- Max **200** rows per CSV export

## Built by

Bamidele Matthew — [Work With Me](https://wa.link/v2tg5k)
