# LeadThur V2 — Phase 2.2 Email → Revenue Attribution

**Date:** 2026-08-09  
**Scope:** Connect Trial Nurture v3 to Phase 2 / 2.1 observability. Deploy existing observability to staging. Do not rebuild analytics, rewrite the 30-email sequence, or touch customer Gmail outreach.

---

## Executive summary

Phase 2.2 adds **email identity + last-click attribution** on top of the existing `analytics_events` system so LeadThur can answer: which nurture emails get opened, clicked, and eventually associate with search, checkout, payment, activation, and revenue.

**Architecture choice:** reuse Phase 2 ingest (`POST /public/events`), taxonomy (`email_sent` / `email_opened` / `email_clicked`), and admin observability. No second analytics database. No Resend account changes. No sequence copy/timing changes.

**Attribution model:** **last nurture email CTA click** within **30 days**, separate from **first-touch UTM** acquisition attribution.

**Historical limitation:** click attribution is available from Phase 2.2 deployment onward. Historical clicks are not fabricated or backfilled.

---

## Before architecture

```
Trial Nurture v3 (Resend)
  → open pixel → trial_email_opens
  → CTA links without stable nurture UTMs
Phase 2 observability (git)
  → analytics_events / admin APIs
  → staging live binary often lagged → /public/events 404
```

Nurture step → revenue was **not attributable**.

---

## After architecture

```
Nurture send (Resend success)
  → email_sent (+ sequence_version, sequence_step, campaign)
Open pixel (existing)
  → trial_email_opens (preserved)
  → email_opened (analytics)
CTA → LeadThur URL with UTMs
  → email_clicked (client)
  → first-touch UTM unchanged if already set
  → last nurture click stored separately
Search / checkout / payment / activation / outreach
  → existing events
  → Admin Email Revenue joins last email_clicked → conversion (30d window)
```

---

## Event map

| Event | Source | Identity fields |
|-------|--------|-----------------|
| `email_sent` | server after Resend accept | `email_channel=trial_nurture`, `sequence_version`, `sequence_step`, `campaign`, optional `provider_message_id` |
| `email_opened` | trial open pixel | same nurture identity; hour-bucketed idempotency |
| `email_clicked` | client on nurture UTM land | UTMs + `cta` / `utm_term` |
| `search_started` / `search_completed` | existing | first-touch UTMs + `last_nurture_*` properties |
| `checkout_started` | client (Phase 2.1 ownership) | same |
| `payment_completed` | server webhook (authoritative) | amount/currency metadata; revenue join via last click |
| `license_activated` | existing | activation ≠ payment; both reported |
| `first_outreach` | existing | attribution only; Gmail untouched |

Canonical names only — no duplicate event invention.

---

## Email attribution parameters

Applied automatically via `emailButton` when render is inside `withNurtureEmailContext`:

| Param | Value |
|-------|--------|
| `utm_source` | `leadthur` |
| `utm_medium` | `email` |
| `utm_campaign` | `trial_nurture_v3` |
| `utm_content` | `trial_v{version}_step_{step}` |
| `utm_term` | CTA identifier |

Existing query keys are **not overwritten**.

---

## Attribution model

1. **First-touch** — acquisition UTM / `fbclid` / `gclid` / referrer stored once (`lt_analytics_attribution`). Used on product events and the Attribution admin tab.
2. **Last email click** — most recent `email_clicked` for nurture campaign before a conversion, within **30 days**. Powers Email Revenue tab. Does **not** replace first-touch.

This is attribution, not causation.

---

## Attribution window

**30 days** after tracked nurture CTA click (`NURTURE_ATTRIBUTION_WINDOW_DAYS`), unless a tighter product rule already applies to a specific conversion type (none required for v1 of this report).

---

## Funnels (email → revenue)

Email send → open → click → visit (`page_view`) → search → checkout → payment → activation → paid customer → outreach usage.

Admin table columns: Email | Sends | Unique Opens | Clicks | Searches | Checkouts | Purchases | Revenue.

Derived rates (only when denominators exist): open rate, click rate, click-to-search / checkout / purchase, revenue per email / per clicker.

---

## Admin changes

- `GET /admin/observability/email-revenue`
- Analytics workspace tab **Email Revenue**
- Outreach health excludes `email_channel=trial_nurture` from nurture pollution of SMTP outreach metrics

---

## Database changes

**None required.** Uses existing `analytics_events` JSON `properties` + UTM columns from Phase 2 / 2.1.

---

## Resend

Unchanged account/domain/keys. LeadThur analytics remain authoritative; optional Resend `messageId` stored in properties only (not exposed publicly).

---

## Performance / safety

Analytics remain fire-and-forget / non-blocking. Failed tracking must not fail search, checkout, payment, activation, outreach, or trial signup.

Idempotency examples:

- sent: `nurture_sent:v{ver}:step{step}:{email}`
- open: hour-bucketed per trial/step
- click: `nurture_click:{session}:{utm_content}:{utm_term}`
- payment: existing `payment_completed:{reference}`

---

## Testing

```bash
node backend/scripts/verify-phase22-email-attribution.mjs
node backend/scripts/verify-observability-phase2.mjs
cd backend && npm run lint
cd frontend && npx tsc --noEmit && npm run build
```

Focused static checks cover UTM merge, sent/open/click wiring, taxonomy allowlist, admin route/UI, and non-rewrite of CTA copy.

---

## Staging deployment

1. Push focused commit to `origin/staging` — **done:** application `05ac7fd`, docs tip `ca166ca`.
2. Coolify staging backend eventually served tip (see recovery section below).
3. Gates (verified 2026-08-09):
   - `GET /health` → `gitCommitSha=ca166cafbbb547f3a123c016d1cb52776dca0922`
   - `POST /public/events` → **202**
   - `GET /admin/observability/*` → **401** unauthenticated (not 404)
   - `GET /admin/observability/email-revenue` → **401**
4. Controlled staging journey completed on a disposable mailinator test signup + synthetic client events (no mass mail, no real outreach, no real charges).

### Live probe (2026-08-09 post-push — initial)

| Check | Expected | Observed |
|-------|----------|----------|
| `origin/staging` | `ca166ca` | **PASS** |
| Live `gitCommitSha` | `ca166ca…` | **FAIL** — still `79b7392…` |
| `POST /public/events` | 202 | **FAIL** — 404 |
| `/admin/observability/*` | 401 | **FAIL** — 404 (old binary) |

### Staging deployment recovery (2026-08-09)

**Git (STEP 1):** `HEAD` / `origin/staging` = `ca166ca`; `05ac7fd` is ancestor. No missing Phase 2.2 commits — no new application commit created.

**Coolify diagnosis (STEP 2):**

| Factor | Finding |
|--------|---------|
| Staging GHA deploy workflow | **Not Found** — only `.github/workflows/deploy.yml` (production `main` + `COOLIFY_DEPLOY_WEBHOOK_URL`) |
| Staging Coolify webhook secret in repo / local env | **Not Found** |
| Coolify IaC in repo | **Not Found** |
| Likely root cause while stuck on `79b7392` | **A + B**: auto-deploy not codified for staging; git-push webhook lag or disabled / delayed trigger (historical Phase 2.1 same symptom) |
| Ruled out after recovery | **E** (wrong commit still live), **G** (old container still active) — live SHA now matches tip |
| Not inspectable from this session | Coolify UI build logs, webhook toggle, path filters |

**Redeploy (STEP 3):** No staging webhook was available to trigger from this environment. Live backend later reported tip SHA without an application code change — Coolify git auto-deploy caught up and/or an operator manual redeploy occurred outside this session.

### Live probe (2026-08-09 recovery — current)

| Check | Expected | Observed |
|-------|----------|----------|
| Deployed SHA | `ca166ca` | **PASS** `ca166cafbbb547f3a123c016d1cb52776dca0922` |
| `/health` | ok + browser ready + bullmq | **PASS** (`browser=ready`, `queue.mode=bullmq`) |
| `POST /public/events` | 202 | **PASS** |
| `/admin/observability/overview` | 401 | **PASS** |
| `/admin/observability/email-revenue` | 401 | **PASS** |
| `verify-deployment.sh` | PASS | **PASS** |
| `verify-phase21-staging-gates.sh` (`EXPECTED_GIT_SHA=ca166ca`) | PASS | **PASS** |
| `verify-observability-phase2.mjs` | PASS | **PASS** |
| `verify-phase22-email-attribution.mjs` | PASS | **PASS** |
| `verify-observability-privacy.mjs` | PASS | **PASS** |
| `verify-p0-hardening.mjs` | PASS | **PASS** |
| `verify-p0-xss.mjs` | PASS | **PASS** |
| `verify-security-fixes.mjs` | PASS | **SKIP** — missing local `supertest` dependency |

### Controlled journey + analytics_events

| Step | Result |
|------|--------|
| Trial signup (disposable mailinator test address) | **PASS** HTTP 200 `success:true` |
| Nurture step-1 send → `email_sent` | **PASS** (`utm_content=trial_v3_step_1`, `email_channel=trial_nurture`) |
| Open pixel `/trial/email-opened` | **PASS** HTTP 200 `image/gif` → `email_opened` |
| Synthetic CTA land `email_clicked` | **PASS** UTMs `leadthur` / `email` / `trial_nurture_v3` / `trial_v3_step_1` |
| First-touch vs last-click | **PASS** — smoke session kept first-touch `facebook`/`acq_test` on `page_view`/`search_*` while `email_clicked` carried nurture UTMs; `last_nurture_step=1` on search events |
| `search_started` / `search_completed` ingest | **PASS** accepted 202 and present in `analytics_events` |
| UTM helper (local, no code change) | **PASS** appends required params; does not overwrite existing `utm_source`; window = 30 days |
| Real payment / activation / outreach send | **NOT RUN** (safe scope — no real charge / no prospect outreach) |
| Admin UI `/admin/analytics` Email Revenue tab | **PARTIAL** — API route live (401 unauth). Authenticated UI not exercised (no admin creds in `.env.staging`; FE `staging.leadthur.com` returns Vercel SSO 302) |
| Email Revenue data presence | **PASS at DB layer** — nurture campaign rows for step 1 include sent/opened/clicked; historical clicks still not fabricated |

### Regression spot-checks

| Surface | Observed |
|---------|----------|
| Health / ready | 200 |
| Trial status route registered | 400 without email (not 404) |
| Observability routes registered | 401 (not 404) |
| Application code / sequence / Resend / Gmail | **Unchanged** this session (docs-only update) |

---

## Live verification checklist

- [x] Observability live (202 / 401)
- [x] `email_sent` after nurture send
- [x] `email_opened` after pixel
- [x] `email_clicked` after CTA land
- [x] Search events retain first-touch + last_nurture props
- [ ] Payment/activation join on Email Revenue when data exists (not exercised — no safe payment)
- [x] No application duplicate conversion logic changed this session
- [x] Gmail outreach unchanged
- [x] Resend config unchanged

---

## Known limitations

- External Paystack Shop CTAs do not hit LeadThur until return/visit; LeadThur-hosted CTAs drive `email_clicked`.
- Server payment webhooks may lack first-touch UTMs on the payment row; Email Revenue uses last-click join by email hash.
- No historical click backfill.
- Staging Coolify deploy is still not codified in GitHub Actions (P1 ops gap).
- Authenticated Admin UI verification blocked by missing local admin creds + Vercel SSO on staging FE.

---

## Remaining work

| Priority | Item |
|----------|------|
| P1 | Add `COOLIFY_STAGING_DEPLOY_WEBHOOK_URL` + GHA on `staging` with SHA gate (closes recurring stuck-SHA risk) |
| P1 | Authenticated Admin Email Revenue / Timeline UI confirmation when admin session available |
| P2 | Optional safe staging payment → activation attribution exercise |

---

## Final GO / NO-GO

| Gate | Status |
|------|--------|
| Code (TS, build, static verify) | **GO** — `05ac7fd` / tip `ca166ca` on `origin/staging` |
| Staging live observability | **GO** — SHA `ca166ca`, `/public/events` 202, observability 401 |
| Live attribution journey (send/open/click/search) | **GO** — events in `analytics_events` with first-touch ≠ last nurture click |
| Full payment→revenue live proof | **NOT EXERCISED** (safe scope) |

**Overall: STAGING = GO** for Phase 2.2 observability + email attribution ingest on staging.

Payment→activation→revenue end-to-end remains an optional follow-up when safe staging payment testing is available.
