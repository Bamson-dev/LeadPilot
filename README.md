# LeadPilot

LeadPilot is the **paying customer product** — a business discovery and prospecting platform. It runs as a monorepo with a Next.js frontend (Vercel), Express + Playwright backend (Contabo VPS), and Supabase database.

> **Note:** The sales landing page is a standalone HTML file on WordPress/Elementor. It is **not** part of this repository.

## Architecture

```mermaid
flowchart LR
  User[Customer Browser] --> Vercel[Vercel Frontend]
  Vercel -->|REST + SSE| VPS[Contabo VPS Backend]
  VPS -->|Playwright| Maps[Google Maps]
  VPS -->|fetch| Websites[Business Websites]
  VPS -->|Service Key| Supabase[(Supabase Postgres)]
  Vercel -->|Anon Key| Supabase
```

| Layer | Tech | Deploy |
|-------|------|--------|
| Frontend | Next.js 15, React 19 | Vercel |
| Backend | Express, Playwright | Contabo VPS (Docker + GitHub Actions) |
| Database | Supabase Postgres | Supabase |
| Shared | TypeScript types/utils | npm workspace |

## Folder structure

```
/leadpilot (repo root)
├── frontend/          Next.js app
│   ├── app/           Routes (/ , /dashboard, /demo-recording)
│   ├── components/    UI + dashboard shell
│   ├── features/      results table, CSV export
│   ├── hooks/         useSearch lifecycle
│   ├── services/      API client
│   ├── styles/        globals.css
│   └── utils/         helpers, demo data
├── backend/           Express API + scraper
│   └── src/
│       ├── api/       search + health routers
│       ├── scraper/   Playwright maps + fetch email crawler
│       ├── services/  scraper orchestration
│       ├── queues/    in-memory job queue
│       └── database/  Supabase client + repository
├── shared/            @leadpilot/shared types + utils
├── canvas-ad/         Motion ad tool (separate)
├── motion-video/      Remotion promos (separate)
└── docker-compose.yml
```

## Local development

**Important:** run all commands from the project folder, not your home directory.

```bash
cd ~/LeadRush   # or wherever you cloned the repo
npm install
npm run setup
```

### Prerequisites

- Node.js 20+
- Playwright Chromium (`npm run setup`)
- Supabase project with migration applied

### Without Docker

```bash
npm install
npm run setup

# Shared + backend
cp backend/.env.example backend/.env
# Fill SUPABASE_URL and SUPABASE_SERVICE_KEY

cp frontend/.env.local.example frontend/.env.local
# Set NEXT_PUBLIC_API_URL=http://localhost:3001

npm run build --workspace=@leadpilot/shared
npm run dev:backend    # port 3001
npm run dev            # port 3000
```

### With Docker (local dev)

```bash
cp backend/.env.example backend/.env
docker compose -f docker-compose.dev.yml up --build
```

### Production VPS

See **[deploy/VPS.md](./deploy/VPS.md)** — GitHub Actions auto-deploys backend on push to `main`.

## Environment variables

**Deployment uploads:** download ready-to-fill files from [`deploy/`](./deploy/README.md):

- [`deploy/vercel.env.example`](./deploy/vercel.env.example) → Vercel → **Import .env**
- [`.env.production.example`](./.env.production.example) → VPS → `/opt/leadpilot/.env.production`
- [`deploy/vps.env.example`](./deploy/vps.env.example) → downloadable VPS env template

### Frontend (`frontend/.env.local`)

| Variable | Example |
|----------|---------|
| `NEXT_PUBLIC_API_URL` | `http://localhost:3001` |
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Your anon key |

### Backend (`backend/.env`)

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3001` | HTTP port |
| `NODE_ENV` | `development` | Environment |
| `SUPABASE_URL` | — | Required |
| `SUPABASE_SERVICE_KEY` | — | Required |
| `SCRAPER_CONCURRENCY` | `3` | Parallel scrape jobs |
| `FRONTEND_URL` | `http://localhost:3000` | CORS origin |

## API reference

Base URL: `http://localhost:3001` (local) or your VPS API URL.

### `POST /search`

Start a new search job.

**Request**
```json
{ "query": "restaurants", "location": "Lagos" }
```

**Response** `201`
```json
{ "searchId": "uuid", "status": "pending" }
```

### `GET /search/:id`

Get job status.

**Response**
```json
{
  "id": "uuid",
  "query": "restaurants",
  "location": "Lagos",
  "status": "running",
  "totalFound": 12,
  "processed": 12,
  "createdAt": "...",
  "updatedAt": "...",
  "error": null
}
```

### `GET /search/:id/results?page=1&limit=50`

Paginated business leads.

### `GET /search/:id/stream`

Server-Sent Events stream. Event types: `lead`, `progress`, `phase`, `complete`, `error`.

### `GET /health`

**Response**
```json
{ "status": "ok" }
```

Add `?verbose=1` for playwright/network details.

## Deployment

### Vercel (frontend)

See **[deploy/VERCEL.md](./deploy/VERCEL.md)** if you get `404 DEPLOYMENT_NOT_FOUND`.

1. Import repo at [vercel.com](https://vercel.com)
2. Set **Root Directory** to `frontend`
3. Add environment variables:
   - `NEXT_PUBLIC_API_URL` → your VPS API URL (e.g. `https://api.yourdomain.com`)
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. Deploy

### Contabo VPS (backend)

Full guide: **[deploy/VPS.md](./deploy/VPS.md)**

1. Run `scripts/vps-setup.sh` on the VPS
2. Create `/opt/leadpilot/.env.production` from `.env.production.example`
3. Add GitHub secrets: `VPS_HOST`, `VPS_USER`, `VPS_SSH_KEY`
4. Push to `main` — GitHub Actions deploys automatically

### Supabase

Run migration: `backend/src/database/migrations/001_initial.sql`

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Frontend dev server |
| `npm run dev:backend` | Backend dev server |
| `npm run build` | Build all workspaces |
| `npm run lint` | Lint frontend + backend |
| `npm run setup` | Install Playwright Chromium |
| `npm run check-playwright` | Verify Playwright |

## Design tokens

| Token | Value |
|-------|-------|
| Background | `#07070A` |
| Surface | `#0F0F14` |
| Surface 2 | `#16161E` |
| Accent | `#7C3AED` |
| Accent light | `#A855F7` |
| Green | `#10B981` |
| White | `#F4F4FF` |
| Muted | `#6B6B80` |
