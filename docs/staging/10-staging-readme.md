# 10 — Staging README (Official LeadThur V2 Handbook)

**Audience:** Any senior engineer, designer, QA, or AI implementer joining LeadThur V2.  
**Rule for this pack:** Documents how staging **currently** works (read-only audit). Gaps marked **Not Found.**

---

## Quick facts

| | |
|--|--|
| Staging frontend | `https://staging.leadthur.com` (Vercel; may require SSO) |
| Staging backend | `https://staging-backend.leadthur.com` |
| Production frontend | `https://www.leadthur.com` |
| Production backend | `https://backend.leadthur.com` |
| Staging git branch | `staging` |
| Production git branch | `main` |
| Staging DB | Separate Supabase (“LeadPilot Staging”) — ref not committed |
| Production DB | `oytbynwogudfqqaxxrjq` |
| Prod BE deploy | GitHub Actions → Coolify webhook |
| Staging BE deploy automation | Coolify git-push on `staging` (no GHA job) |

---

## Why staging is mandatory for V2

LeadThur V2 redesigns and features are:

1. Specified and design-approved first  
2. Implemented against the spec (no invented UX)  
3. Deployed to staging  
4. QA + UX approved on staging  
5. Only then promoted to production  

Full process: **[09-redesign-workflow.md](./09-redesign-workflow.md)**

---

## Document map

| File | Purpose |
|------|---------|
| [01-staging-overview.md](./01-staging-overview.md) | What staging is; URLs; services |
| [02-deployment-flow.md](./02-deployment-flow.md) | How deploys work today + gaps |
| [03-environments.md](./03-environments.md) | Dev vs staging vs production |
| [04-feature-flags.md](./04-feature-flags.md) | Env toggles, demo, mocks |
| [05-background-services.md](./05-background-services.md) | API, queues, schedulers, health |
| [06-release-checklist.md](./06-release-checklist.md) | Pre-prod checklist |
| [07-known-limitations.md](./07-known-limitations.md) | SSO, mocks, missing CI |
| [08-qa-process.md](./08-qa-process.md) | Browser/device matrix |
| [09-redesign-workflow.md](./09-redesign-workflow.md) | Official V2 workflow + roles |
| This file | Handbook entrypoint |

Combined copy file: `docs/LEADTHUR_STAGING_HANDBOOK_COMPLETE.md` (if generated).

---

## Day-1 engineer setup

1. Read this README + `09-redesign-workflow.md`.  
2. Get Vercel access to open staging FE (SSO).  
3. Get Coolify access for staging backend redeploys.  
4. Obtain staging Supabase + env values (never use prod keys locally for staging tests).  
5. Clone repo; use branch `staging` for V2 work.  
6. Verify:

```bash
curl -sS https://staging-backend.leadthur.com/health | jq .
bash backend/scripts/verify-deployment.sh https://staging-backend.leadthur.com
```

7. Local: `cp backend/.env.example backend/.env` and `frontend/.env.local.example` → point API at staging **only** if intentional.

---

## Health interpretation

```json
{
  "status": "ok",
  "browser": "ready",
  "queue": { "mode": "bullmq" },
  "gitCommitSha": "...",
  "freeTrialIpCapReady": true,
  "memory": { "safe": true }
}
```

| Field | Meaning |
|-------|---------|
| `status` | Process up |
| `browser` | Playwright pool |
| `queue.mode` | `bullmq` = Redis OK; `inline` = degraded |
| `gitCommitSha` | Deployed commit |
| `freeTrialIpCapReady` | Staging migrations/IP table OK |

---

## Non-negotiables

- Do not invent UX in Cursor.  
- Do not skip staging review.  
- Do not put live payment keys on staging.  
- Do not set **`MOCK_OUTREACH_SEND`, `MOCK_MAILBOX_SMTP`, `ENABLE_TEST_EMAIL`, or `DEMO_MODE`** on Coolify staging or production (P0-3 — routes will not register).  
- Do not edit production site scripts without staging rehearsal.

---

## Related docs outside this folder

- `DEPLOYMENT.md` — Coolify/Vercel production ops  
- `deploy/VERCEL.md` — Frontend API URL pitfalls  
- `docs/CORE_FLOWS_CHECKLIST.md` — Legacy core flow order (some Brevo refs outdated)  
- `docs/ui-audit/` — UI inventory for redesign  
- `docs/LEADTHUR_COMPLETE_INTERNAL_DOCUMENTATION.md` — Full product/engineering inventory  

---

## Gaps to fix (ops backlog — not done in this audit)

1. Add GitHub Action: push to `staging` → Coolify staging webhook → verify `staging-backend` health SHA.  
2. Document staging Paystack webhook URL.  
3. Document / relax Vercel Deployment Protection for QA accounts.  
4. Keep staging SHA ≥ production for shared fixes, or cherry-pick deliberately.  
5. Commit a non-secret staging env matrix (project refs redacted).

---

*Handbook ends. Follow 09 for every V2 change.*
