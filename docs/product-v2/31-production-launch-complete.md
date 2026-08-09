# LeadThur Production Launch Complete

**Date:** 2026-08-09  
**Decision:** **PRODUCTION = GO**

---

## SHAs

| Ref | SHA |
|-----|-----|
| Old production baseline | `bc10b0ba73e56466607e0660141769d562324e80` (`v2.0.0`) |
| Staging tip (at launch) | `edabdd3cfc2a2fcc1650ff479b0ff497224046c8` |
| Phase 2.2 merge on main | `bc8639fa8a9fd0334317900ecbc7fe0b66f1c036` |
| **Live production backend** | **`bc8639fa8a9fd0334317900ecbc7fe0b66f1c036`** |
| `origin/main` tip | `e477387224adca16cdf64fbd0c2f275b0449080a` (broadcast hang fix sync; Coolify redeploy pending) |
| Production tag | `v2.0.0-production` → `bc8639f…` |
| Rollback tag | `v2.0.0` → `bc10b0b` (**unchanged**) |

---

## Merge result

| Step | Result |
|------|--------|
| Dry-run `staging` → `main` | **PASS** (clean) |
| Merge Phase 2.2 | **PASS** → `bc8639f` |
| Push `origin/main` | **PASS** |
| Follow-up broadcast fix on main | **PASS** → `117c4e4` / sync merge `e477387` |
| Force push / history rewrite | **NOT DONE** |

Contains: RC1, Free Trial, public journey, Admin RC1, Phase 2, Phase 2.1, Phase 2.2 email→revenue, nurture/search ancestry, broadcast queue fix on tip.

---

## Deployment result

| Check | Result |
|-------|--------|
| Coolify production healthy | **PASS** |
| `/health` HTTP 200 (×3) | **PASS** |
| Live SHA ≠ `bc10b0b` | **PASS** (`bc8639f`) |
| browser | **ready** |
| queue | **bullmq** |
| memory | **safe** |
| freeTrialIpCapReady | **true** |
| Tip `e477387` deployed | **PENDING** — Redeploy Coolify to pick up broadcast hang fix |

---

## API result (unauthenticated)

| Route | Result |
|-------|--------|
| `GET /auth/status` | **401** JSON |
| `GET /balance` | **401** JSON |
| `GET /auth/usage` | **401** JSON |
| `GET /mailboxes` | **401** JSON |
| `GET /search/history` | **401** JSON |
| `GET /checkout` | **404** Express (no GET; expected) |
| `POST /checkout/initialize` | **400** JSON (`Email is required`) — route live |
| `GET /topup/tiers` | **200** JSON |
| `GET /email-templates` | **200** JSON |
| `GET /public/blog/posts` | **200** JSON |
| `POST /public/events` | **202** |
| `GET /admin/observability/overview` | **401** JSON |
| `GET /admin/observability/email-revenue` | **401** JSON |
| `GET /demo/search` | **404** (disabled) |
| `GET /admin/test-email` | **404** (disabled) |

No HTML 404 auth-bypass shells on protected APIs.

---

## Database result

| Object | Result |
|--------|--------|
| `analytics_events` | **PASS** |
| `analytics_alerts` | **PASS** |
| `analytics_tech_snapshots` | **PASS** |
| `utm_content` / `utm_term` / `fbclid` / `gclid` | **PASS** |
| `free_trial_signups.next_sequence_email_at` | **PASS** |
| Trial rows `sequence_version=3` | **761 / 761** |
| Schema-cache column errors | **None observed** (column present; PostgREST previously verified) |

---

## Email result

| Check | Result |
|-------|--------|
| Trial Nurture v3 in schema/data | **PASS** (all signups v3) |
| Scheduler code enabled on boot | **PASS** (in released tree) |
| Resend env in Coolify UI | **NOT VERIFIED** (no Coolify login) |
| Mass send / full sequence trigger | **NOT DONE** (forbidden) |
| `email_sent` / `opened` / `clicked` live chain | **NOT VERIFIED** (no disposable send this gate) |
| Admin broadcast hang fix | Fixed on `main` tip; **redeploy pending** for live |

---

## Customer journey / payment / activation

| Check | Result |
|-------|--------|
| Controlled end-to-end payment | **PAYMENT = NOT VERIFIED** |
| Activation journey | **NOT VERIFIED** (requires payment) |
| Free-trial → paywall surfaces (API) | Checkout initialize route **live** |

---

## Analytics / Admin

| Check | Result |
|-------|--------|
| Phase 2.2 email-revenue API present | **PASS** (401 unauth) |
| Admin UI / SSO session | **NOT VERIFIED** |
| Funnels / Timeline UI | **NOT VERIFIED** |

---

## Security result

| Check | Result |
|-------|--------|
| Health-only / mock boot mode | **Not active** (full API surface) |
| `MOCK_*` / `DEMO_MODE` / `ENABLE_TEST_EMAIL` Coolify UI | **NOT VERIFIED** (inferred absent from route behavior) |
| Demo search | **Unavailable** (404) |
| Admin auth required | **PASS** |
| CORS credentials header on health | **Present** |
| RLS on analytics tables | **PASS** (prior apply + tables present) |

---

## Tags

| Tag | Target | Status |
|-----|--------|--------|
| `v2.0.0-production` | `bc8639fa8a9fd0334317900ecbc7fe0b66f1c036` | **CREATED + PUSHED** |
| `v2.0.0` (rollback) | `bc10b0b` | **UNCHANGED** |

---

## Operator follow-ups (non-blocking)

1. Coolify **Redeploy** production so live SHA becomes `e477387` (admin broadcast queue fix).  
2. Confirm Vercel production FE includes Phase 2.2 Email Revenue UI.  
3. Optional: one controlled live payment → activation smoke when safe.

---

## Final decision

# PRODUCTION = GO

LeadThur RC1 + Phase 2 / 2.1 / 2.2 is live on production at `bc8639f` (`v2.0.0-production`).

Next phase: observe real users and conversion data. No RC2 / no new feature work in this release closeout.
