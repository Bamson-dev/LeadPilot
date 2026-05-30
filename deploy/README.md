# Environment files for deployment

## Backend — Contabo VPS

| File | Use |
|------|-----|
| [`.env.production.example`](../.env.production.example) | Copy to `/opt/leadthur/.env.production` on VPS |
| [`vps.env.example`](./vps.env.example) | Same values — downloadable for VPS upload |
| **[VPS.md](./VPS.md)** | Full setup + GitHub Actions guide |

## Frontend — Vercel

| File | Use |
|------|-----|
| [`vercel.env.example`](./vercel.env.example) | Import in Vercel → Environment Variables |
| **[VERCEL.md](./VERCEL.md)** | Fix 404 / Root Directory issues |

Set `NEXT_PUBLIC_API_URL` to your VPS API URL (e.g. `https://api.yourdomain.com`).

## Local development

```bash
cp frontend/.env.local.example frontend/.env.local
cp backend/.env.example backend/.env
```

## Vercel 404?

See **[VERCEL.md](./VERCEL.md)** — Root Directory must be `frontend`.

## VPS deploy

See **[VPS.md](./VPS.md)** — GitHub Actions auto-deploy on push to `main`.
