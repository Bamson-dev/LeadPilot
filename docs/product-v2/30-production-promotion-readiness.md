# LeadThur Production Promotion Readiness

**Date:** 2026-08-09  
**Scope:** Resolve final production blockers only. No new features. No merge to `main`. No production deploy from this session.

---

## Executive decision

# NOT READY FOR PRODUCTION PROMOTION

**Progress this session:**

| Blocker | Status |
|---------|--------|
| Branch reconciliation | **RESOLVED (strategy A)** — safe to merge `staging` → `main` when other gates pass |
| Production analytics migrations 039/040 | **FIXED** — applied to production Supabase `oytbynwogudfqqaxxrjq` |
| Production backend 503 | **STILL BLOCKED** — Cloudflare origin unavailable; Coolify not controllable from this environment |
| Coolify / Resend / mock-flag env audit | **NOT VERIFIED** — no Coolify API/UI access |
| Frontend production SHA | **NOT VERIFIED** |
| Payment → activation → revenue | **NOT VERIFIED** (staging initialize PASS; charge not completed) |
| Admin UI | **NOT VERIFIED** |

---

## 1. Branch reconciliation

### SHAs

| Ref | SHA |
|-----|-----|
| `origin/staging` / HEAD | `3bf5f83` |
| Live staging backend | `ca166ca` (Phase 2.2 app; later tip is docs-only) |
| `origin/main` | `bc10b0b` (`v2.0.0`) |
| Merge-base(`staging`,`main`) | `9ba61c3` |
| Rollback tag | `v2.0.0` → `bc10b0b` |

### Common ancestry

`9ba61c3` — includes RC1, Phase 2, Phase 2.1, Built for Your Business.

### Commits only on staging (`main..staging`)

| Commit | Content |
|--------|---------|
| `05ac7fd` | **Phase 2.2** email → revenue attribution |
| `ca166ca` / `669f579` / `3bf5f83` | Phase 2.2 / readiness **docs only** |

### Commits only on main (`staging..main`)

| Commit | Note |
|--------|------|
| `bc10b0b` | Merge commit `v2.0.0` |
| `8a2af24`…`a5f3ff5` (nurture/search series) | Present in history of main but **net tree of `main` == `9ba61c3`** |

### Critical tree fact

```text
git diff --quiet 9ba61c3 main   → YES (identical trees)
git diff main staging           → Phase 2.2 files only (16 paths)
git merge --no-commit staging onto main → CLEAN (exit 0)
```

So the “later nurture/search commits on main” do **not** add unique file content beyond what staging already carries via the shared ancestry at `9ba61c3`. Staging tip = that tree **plus** Phase 2.2.

### Classification

| Work | On staging tip | On main tip |
|------|----------------|-------------|
| RC1 | YES | YES |
| Phase 2 / 2.1 | YES | YES |
| Phase 2.2 | YES | NO |
| Unique search/nurture content beyond Phase 2.2 | Already in shared base | Same base tree |

---

## 2. Promotion strategy

**Chosen: A — `staging` can safely merge into `main`**

Why safe:

1. Merge-base tree equals `main` tip tree.  
2. Staging only adds Phase 2.2 (+ docs).  
3. Dry-run merge had **zero conflicts**.  
4. No force-push / history rewrite required.

**Not chosen now:** actual merge — blocked by production 503 and incomplete functional/env gates.

**When ready:**

```text
git checkout main
git pull origin main
git merge --no-ff staging
git push origin main
# Coolify / GHA redeploy production from main
# Verify /health SHA
```

Do **not** merge until production backend is healthy enough to receive the promoted code.

---

## 3. Production backend 503

| Probe | Result |
|-------|--------|
| `GET https://backend.leadthur.com/health` | **503** body `no available server` |
| Response headers | Cloudflare (`server: cloudflare`, `cf-ray`) |
| Staging backend | **Healthy** `ca166ca` |

### Diagnosis (best available without Coolify UI)

| Hypothesis | Assessment |
|------------|------------|
| A. Auto-deploy disabled | Possible — no staging/prod webhook callable from this agent |
| F. Build/deploy failure / crashed container | **Likely** — CF 503 “no available server” = origin down/unreachable |
| Wrong port / proxy | Possible; consistent with dead origin |
| Application health-only mode | Unlikely — that still returns `/health` 200 |

**This environment has:** no Coolify MCP, no `COOLIFY_*` env, no `gh` CLI for webhook secrets.

**Required operator action:** Coolify → production backend → check Running status, logs, redeploy `main`/`v2.0.0` or tip after merge, confirm port `3000`, Base Directory `/`, Dockerfile `backend/Dockerfile`.

---

## 4. Production environment audit

| Check | Result |
|-------|--------|
| Compare Coolify staging vs production env **names** | **NOT VERIFIED** — no Coolify access |
| Forbidden `MOCK_*` / `DEMO_MODE` / `ENABLE_TEST_EMAIL` on production | **NOT VERIFIED** |
| Required vars documented in `backend/.env.example` / `DEPLOYMENT.md` | Present in docs (`SUPABASE_*`, `FRONTEND_URL`, `RESEND_API_KEY`, `EMAIL_FROM`, Redis/Paystack, etc.) |

---

## 5. Resend production configuration

| Check | Result |
|-------|--------|
| Change Resend account | **NOT DONE** (forbidden) |
| Production `RESEND_API_KEY` / sender vars live | **NOT VERIFIED** (Coolify) |
| Code: nurture = Resend-only | **PASS** |
| Code: transactional Zepto → Resend fallback | Unchanged |

---

## 6. Production migrations — FIXED

**Target:** Lead Rush production Supabase `oytbynwogudfqqaxxrjq` (documented in `DEPLOYMENT.md`).

| Migration | Result |
|-----------|--------|
| `analytics_observability` (039) | **PASS** — applied `20260809133527` |
| `analytics_attribution_polish` (040) | **PASS** — applied `20260809133651` |

### Post-apply verification

| Object | Result |
|--------|--------|
| `analytics_events` | **PASS** exists |
| `analytics_alerts` | **PASS** exists |
| `analytics_tech_snapshots` | **PASS** exists |
| `utm_content` / `utm_term` / `fbclid` / `gclid` | **PASS** |
| RLS enabled | **PASS** |
| `revoke` anon/authenticated | **PASS** (in 039 SQL) |

### Remaining schema gap (not in this blocker list but noted)

Production still lacks `free_trial_ip_usage` migration that staging has. Track as P1 after backend recovery.

---

## 7. Production route verification

**BLOCKED** — backend 503. Cannot verify `/public/events` 202 or observability 401 on production until origin is up.

Staging re-confirmed: `/public/events` 202; health `ca166ca`.

---

## 8. Production security

| Check | Result |
|-------|--------|
| Static P0 hardening / Phase 2.2 scripts | **PASS** (repo) |
| Live production security probes | **NOT VERIFIED** (503) |

---

## 9. Frontend production

| Check | Result |
|-------|--------|
| `https://www.leadthur.com` | HTTP 200 (site responds) |
| Exact Vercel production git SHA | **NOT VERIFIED** (no Vercel token / SSO) |
| Phase 2.2 Email Revenue UI on production FE | **NOT VERIFIED** (requires FE deploy of staging tip after promote) |

**FRONTEND SHA = NOT VERIFIED**

---

## 10. Payment → activation → revenue

| Step | Staging | Production |
|------|---------|------------|
| Checkout initialize | **PASS** (prior + route 400 without email) | **NOT VERIFIED** (503) |
| Payment completed / webhook | **NOT VERIFIED** | **NOT VERIFIED** |
| Activation / paid search / revenue join | **NOT VERIFIED** | **NOT VERIFIED** |

**PAYMENT → ACTIVATION → REVENUE = NOT VERIFIED**

---

## 11. Email → revenue

| Check | Staging | Production |
|-------|---------|------------|
| UTM model / last-click / 30-day window | **PASS** (Phase 2.2 live) | **NOT VERIFIED** (backend down; schema ready) |
| First-touch separate from last-click | **PASS** | **NOT VERIFIED** |

---

## 12. Admin

**ADMIN UI = NOT VERIFIED** (SSO / no credentials)  
**ADMIN API on staging = PASS** (401 unauth)

---

## 13. Rollback

| Item | Value |
|------|--------|
| Tag | `v2.0.0` |
| Commit | `bc10b0b` |
| Procedure | Coolify production → deploy/redeploy commit or tag `v2.0.0` / `bc10b0b`; verify `/health` |
| Tag moved this session | **NO** |

---

## 14. Promotion status

**Not executed.** Preconditions unmet (production origin down).

---

## 15. Update to gate 29

| Item from gate 29 | Update |
|-------------------|--------|
| Production analytics tables missing | **FIXED** |
| Branch divergence unknown risk | **Clarified** — safe merge staging→main |
| Production 503 | **Still FAIL** |
| Payment/FE/Admin/Coolify env | Still **NOT VERIFIED** |

---

## Final scorecard

| Gate | Result |
|------|--------|
| Branch reconciliation | PASS (strategy A documented) |
| Production backend healthy | FAIL (503) |
| Production migrations 039/040 | PASS |
| Production env / Resend / mocks | NOT VERIFIED |
| Production routes / observability | NOT VERIFIED |
| Security (static) | PASS |
| Security (live prod) | NOT VERIFIED |
| Frontend SHA | NOT VERIFIED |
| Payment → activation → revenue | NOT VERIFIED |
| Email → revenue (staging) | PASS |
| Email → revenue (production) | NOT VERIFIED |
| Admin UI | NOT VERIFIED |
| Rollback tag | PASS |
| Merge/promote executed | NOT APPLICABLE |

---

## Remaining operator checklist (P0)

1. **Coolify:** restore production backend container; confirm `/health` 200 + `gitCommitSha`.  
2. **Coolify env:** confirm no `MOCK_*` / `DEMO_MODE` / `ENABLE_TEST_EMAIL`; confirm `RESEND_API_KEY`, `EMAIL_FROM`, Redis, Supabase, Paystack names present.  
3. After healthy: smoke `/public/events` 202, observability 401, core JSON routes.  
4. Merge `staging` → `main` (strategy A); redeploy production to new SHA.  
5. Confirm Vercel production FE SHA includes Phase 2.2 admin UI.  
6. Safe payment → activation journey; Email Revenue association.  
7. Optional: apply `free_trial_ip_usage` on production if still missing.

---

## Final verdict

**NOT READY FOR PRODUCTION PROMOTION**

Migrations and branch strategy are unblocked. Production origin 503 and remaining verification gaps still block GO.
