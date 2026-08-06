# 04 — Feature Flags & Config Toggles

LeadThur has **no feature-flag service** (LaunchDarkly, etc.). Control is via environment variables, hostname checks, and constants.

**RC1 hardening (P0-3):** `backend/Dockerfile` bakes `NODE_ENV=production`. Coolify staging and production **must not** set the forbidden flags below or the backend boots health-only (API routes disabled).

---

## Forbidden on Coolify staging + production

| Variable | Why forbidden |
|----------|----------------|
| `MOCK_OUTREACH_SEND=1` | Fakes successful sends — refused at boot |
| `MOCK_MAILBOX_SMTP=1` | Skips Gmail verify — refused at boot |
| `ENABLE_TEST_EMAIL=true` | Open test mailer — refused at boot |
| `DEMO_MODE=1` / `true` | Demo API router — refused at boot |

**Symptom if set:** `/health` returns 200 but `/auth/status`, `/balance`, `/checkout` return Express HTML 404. Container log: `Backend configuration failed — /health works, API routes disabled`.

**Staging outreach QA:** use real Gmail SMTP with disposable recipients, or run mock-based scripts locally with `NODE_ENV=test` (not on Coolify).

---

## Allowed environment variables (behavioral)

| Variable | Effect | Staging | Production |
|----------|--------|---------|------------|
| `NODE_ENV` | Baked `production` in Docker image | `production` | `production` |
| `FRONTEND_URL` | CORS + tracking base | `https://staging.leadthur.com` | `https://www.leadthur.com` |
| `NEXT_PUBLIC_DEMO_MODE` | Frontend demo enable (optional) | Off unless needed | Off |
| `OUTREACH_SEND_SKIP_SPACING=1` | Skip send spacing | QA only | Off |
| `RATE_LIMIT_IP_ALLOWLIST` | Bypass IP rate limits | QA IPs | Minimal / empty |
| `REDIS_URL` | BullMQ vs inline | Set | Set |
| Search budget envs | Timeouts, concurrency | May be lower | Tuned for volume |

---

## Hostname / branch detection (code)

| Check | Location | Effect |
|-------|----------|--------|
| Host includes `staging.leadthur` or `staging-` | `frontend/app/demo/page.tsx` | Enable `/demo` **UI** without backend `DEMO_MODE` |
| `VERCEL_GIT_COMMIT_REF === "staging"` | `frontend/next.config.ts` | Point API to staging backend |
| `FRONTEND_URL` includes `staging.leadthur` | `email-template.ts`, `outreach-send-service.ts` | Tracking/base URLs → staging-backend |

**Note:** Frontend demo UI can show on staging hostname while backend `/demo/search` stays unmounted (no `DEMO_MODE`).

---

## Constants (not env flags)

| Constant area | File | Notes |
|---------------|------|-------|
| Lifetime price | `constants/pricing.ts` | $25 / ₦25k |
| Outreach tiers | `constants/outreach-pricing.ts` | Starter/Growth/Scale |
| Trial search caps | free-trial repos | 2/email, 2/IP |
| Scraper defaults | `scraper/utils/constants.ts` | Budgets, max leads |

Changing these requires a code deploy — not a runtime flag.

---

## Demo mode

| Layer | Behavior |
|-------|----------|
| Backend `/demo/search` | Requires `DEMO_MODE=true` — **forbidden on Coolify** (P0-3) |
| Frontend `/demo` | Enabled if env **or** staging host **or** `NODE_ENV=development` |
| `/demo-recording` | Public route for recording mock |

---

## Admin mode

- JWT auth with `ADMIN_EMAIL` / `ADMIN_PASSWORD`
- `/admin/test-email` requires `NODE_ENV !== production` **and** `ENABLE_TEST_EMAIL=true` **and** admin JWT — not available on Coolify staging/production

---

## Database-driven “flags”

| Mechanism | Effect |
|-----------|--------|
| `free_trial_signups.sequence_paused` | Stops nurture for user |
| `license_keys.is_suspended` | Blocks paid access |
| `outreach_accounts.subscription_status` | Outreach entitlement |

These are product state, not deploy flags.
