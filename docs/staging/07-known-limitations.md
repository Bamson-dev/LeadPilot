# 07 — Known Limitations (Staging)

Facts from repo + live probes. Updated RC1 (2026-08-06).

---

## Access / hosting

| Limitation | Detail |
|------------|--------|
| Vercel SSO on staging FE | `staging.leadthur.com` returns 302 → Vercel SSO — anonymous QA blocked unless Deployment Protection disabled or bypassed |
| Staging BE deploy | Coolify git-push trigger on `staging` branch (no GHA job); docs-only commits may skip image rebuild |
| Frontend SHA external probe | Cannot read Vercel deployment commit without dashboard access (SSO) |
| Coolify staging IaC | **Not Found** in repo |

---

## Data / secrets

| Limitation | Detail |
|------------|--------|
| Staging Supabase ref | Placeholder only in `.env.staging.example` — not committed |
| Staging webhook URL | Paystack staging webhook **Not Found** in docs (prod URL only) |
| Shared email providers | If staging uses same Zepto/Resend domain as prod, reputation risk |

---

## Environment / P0-3 (RC1)

| Issue | Detail |
|-------|--------|
| **Stale docs caused outage** | Pre-RC1 handbook recommended `MOCK_OUTREACH_SEND=1` on staging; P0-3 refuses it under `NODE_ENV=production` → health-only backend |
| No mock SMTP on Coolify | Staging must use real Gmail for outreach sends and mailbox connect |
| No `/admin/test-email` on Coolify | Requires non-production + `ENABLE_TEST_EMAIL` |
| Backend `/demo/search` unmounted | `DEMO_MODE` forbidden; frontend `/demo` UI still works on staging hostname |

---

## Product / technical

| Limitation | Detail |
|------------|--------|
| Maps HTML scraping | Fragile; captchas/blocks affect staging and prod equally |
| Inline queue fallback | If Redis missing, single-process only — staging currently has BullMQ |
| Trial nurture scheduler | Runs in staging; can email real users if data + unpaused |
| Client-only FE auth gates | Staging FE can show pages that APIs reject |
| Paystack checkout init | May return 500 if test keys/plans misconfigured (route exists) |

---

## Workarounds in use

1. `RATE_LIMIT_IP_ALLOWLIST` for QA IPs (`DEPLOYMENT.md`).  
2. Demo UI enabled by **frontend hostname** (`demo/page.tsx`) without backend `DEMO_MODE`.  
3. `next.config.ts` auto-selects staging API URL when branch/host is staging.  
4. Local integration scripts use `backend/.env.staging` + in-process mocks with `NODE_ENV=test` only.

---

## Known bugs

Runtime bug tracker in repo: **Not Found**.  
Paystack webhook with invalid signature returning 200 on staging (P1 — pre-existing).
