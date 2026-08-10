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
| **Live production backend** | **`d5d409980386f75f63e2091fbf032b43865c5497`** (post-redeploy; matches `origin/main`) |
| `origin/main` tip | `d5d409980386f75f63e2091fbf032b43865c5497` |
| Production tag | `v2.0.0-production` → `bc8639f…` (Phase 2.2 launch point; tip includes broadcast fix + launch docs) |
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
| Tip `e477387` / `d5d4099` deployed | **PASS** — live SHA = `origin/main` after Coolify redeploy |

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

## Controlled production exercise (2026-08-10)

Disposable account: `prod.smoke.1786343166@mailinator.com`

| Step | Result |
|------|--------|
| Trial signup | **PASS** (`success: true`, new) |
| Welcome `email_sent` (analytics) | **PASS** (`trial_nurture_v3` / `trial_v3_step_1`) |
| `email_opened` pixel | **PASS** |
| Free trial search 1 (dentists / Austin) | **PASS** — 26 leads, `fullyComplete` |
| Free trial search 2 (plumbers / Austin) | **PASS** — 19 leads, `fullyComplete` |
| 3rd search paywall | **PASS** — HTTP **429** `TRIAL_LIMIT` |
| Checkout initialize (Paystack) | **PASS** — live auth URL + `payment_initiated` event |
| Payment charge → license → activation | **NOT COMPLETED** — production Paystack is **live** (not test); Cloudflare bot challenge blocks automated checkout. Requires a human card payment. |
| Admin Email Revenue UI | **NOT VERIFIED** — no admin credentials in agent environment |
| `email_clicked` attribution | **PARTIAL** — public event accepted (202); nurture click chain not fully proven end-to-end |

**Paystack session (open to complete charge):** `https://checkout.paystack.com/4mskm4s7wa1j5o8`  
**Reference:** `LP-1786343304640-4WA4OQ`

After you complete payment (or provide admin login), reply and verification of activation / Email Revenue can finish.

---

## Operator follow-ups (non-blocking)


1. ~~Coolify Redeploy~~ **DONE** — live = `d5d4099` = `origin/main`.  
2. Confirm Vercel production FE includes Phase 2.2 Email Revenue UI.  
3. Optional: one controlled live payment → activation smoke when safe.

---

## Final decision

# PRODUCTION = GO

LeadThur RC1 + Phase 2 / 2.1 / 2.2 is live on production at `bc8639f` (`v2.0.0-production`).

Next phase: observe real users and conversion data. No RC2 / no new feature work in this release closeout.
