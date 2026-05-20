# Environment files for deployment

Download these from GitHub, fill in your values, then upload to each platform.

## Files

| File | Platform | Upload to |
|------|----------|-----------|
| [vercel.env.example](./vercel.env.example) | Vercel (frontend) | Project → Settings → Environment Variables → **Import .env** |
| [render.env.example](./render.env.example) | Render (backend) | Service → Environment → **Add from .env** |

## Download from GitHub

1. Open the file link above in your browser
2. Click **Raw**
3. Save As → rename to `.env` (or keep the name and upload as-is)

Or clone the repo and copy from the `deploy/` folder:

```bash
cd ~/LeadRush/deploy
cp vercel.env.example vercel.env    # edit values, then upload to Vercel
cp render.env.example render.env    # edit values, then upload to Render
```

## What to fill in

### Vercel (`vercel.env.example`)

| Variable | Where to get it |
|----------|-----------------|
| `NEXT_PUBLIC_API_URL` | Your Render backend URL after deploy, e.g. `https://leadpilot-backend.onrender.com` |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API → Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Project Settings → API → anon public key |

### Render (`render.env.example`)

| Variable | Where to get it |
|----------|-----------------|
| `SUPABASE_URL` | Same Project URL as above |
| `SUPABASE_SERVICE_KEY` | Supabase → Project Settings → API → **service_role** key (secret) |
| `FRONTEND_URL` | Your Vercel URL after deploy, e.g. `https://your-app.vercel.app` |

## Local development

Copy the workspace examples instead:

```bash
cp frontend/.env.local.example frontend/.env.local
cp backend/.env.example backend/.env
```

Use `http://localhost:3001` for `NEXT_PUBLIC_API_URL` and `http://localhost:3000` for `FRONTEND_URL` locally.
