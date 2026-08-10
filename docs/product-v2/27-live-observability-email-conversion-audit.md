# LeadThur Live Observability + Email Conversion Audit

**Date:** 2026-08-09  
**Scope:** Read-only audit of Phase 2 / 2.1 observability vs Trial Nurture v3  
**Rules followed:** No code changes, no schema changes, no email/Resend/outreach changes, no commit/push/deploy.

---

## 1. Environment

| Item | Value | Notes |
|------|--------|------|
| Preferred audit env | **Staging** | Per instructions |
| Local branch | `staging` | |
| Local / `origin/staging` HEAD | `9ba61c3` | Includes Phase 2/2.1 + Built for Your Business |
| `origin/main` / tag tip | `bc10b0b` | Merge commit containing Phase 2/2.1 |
| **Live staging backend SHA** | **`79b7392`** | **Pre–Phase 2** (RC1 admin cleanup) |
| Staging API | `https://staging-backend.leadthur.com` | |
| Staging frontend | `https://staging.leadthur.com` | HTTP **302** (Vercel SSO) — FE SHA **NOT VERIFIED** |
| Production API | `https://backend.leadthur.com` | Health **503** at audit time — **NOT VERIFIED** |
| Production frontend | `https://www.leadthur.com` | HTTP 200 — FE SHA **NOT VERIFIED** |
| Supabase MCP connected project | `wffwhktwessvlubndkmj` | SQL timed out; **not confirmed** as LeadPilot Staging/Prod |
| Redis / queue / browser (staging health) | `bullmq`, queued 0, browser `ready`, memory safe | From `/health` only |

### Critical environment finding

Phase 2 observability code exists on git tips (`9ba61c3` / `bc10b0b`), but **staging runtime does not run it**:

| Probe | Expected (Phase 2 live) | Staging observed |
|-------|-------------------------|------------------|
| `POST /public/events` | 202 | **404** |
| `GET /admin/observability/overview` | 401 | **404** |

`3877c2d` (Phase 2) is **not** an ancestor of staging live SHA `79b7392`.

**Consequence:** Live funnel/event counts, admin analytics APIs, and email→revenue joins **cannot be verified on staging runtime**. Remaining findings are primarily **code-path verification** + deploy-state facts.

---

## 2. Current SHAs (summary)

| Ref | SHA | Phase 2/2.1 in binary? |
|-----|-----|-------------------------|
| Git staging tip | `9ba61c3` | Yes (in git) |
| Live staging backend | `79b7392` | **No** |
| Git main / v2.0.0 tip | `bc10b0b` | Yes (in git) |
| Live production backend | **NOT VERIFIED** (503) | Previously reported as `bc10b0b` after Coolify redeploy; **re-verify when healthy** |

---

## 3. Observability architecture (from repository)

| Component | Location | Status in code |
|-----------|----------|----------------|
| `analytics_events` | migrations `039`, `040` | Schema defined |
| `analytics_alerts` | migration `039` | Schema defined |
| `analytics_tech_snapshots` | migration `039` | Schema defined |
| Event taxonomy | `backend/src/observability/event-taxonomy.ts` | Defined |
| Client ingest | `POST /public/events` → `public-events-router.ts` | Implemented |
| Client batching | `frontend/lib/analytics.ts` | Implemented |
| Server track | `trackEvent` in `observability/track.ts` | Implemented |
| Admin APIs | `admin-observability-router.ts` + `admin-observability-polish.ts` | Implemented |
| Funnels / attribution / timeline / cohorts / license / outreach / executive | polish + router | Implemented |
| Alert catalogue + evaluator | `observability/alerts.ts` | Implemented |
| Tech snapshots | written from infra route evaluation | Implemented |

**Live on staging:** architecture **not mounted** (404s).  
**Live DB rows:** **NOT VERIFIED** (MCP SQL timeout / wrong or unavailable project).

---

## 4. Event map (canonical names only)

Legend: **D**=Defined in taxonomy · **F**=Fired in code · **S**=Stored in `analytics_events` when Phase 2 binary + DB present · **U**=Shown in admin APIs

| Event | Source | C/S | Trigger | Table | Admin surface | Currently firing on staging live? |
|-------|--------|-----|---------|-------|---------------|-----------------------------------|
| `landing_viewed` | marketing page | Client | Landing mount | analytics_events | overview/funnels | **NO** (ingest 404) |
| `freetrial_viewed` | freetrial page | Client | Page view | analytics_events | overview/funnels | **NO** |
| `trial_email_submitted` | freetrial + trial-router | Both | Signup submit / server signup | analytics_events | overview/funnels | Server path exists in git tip; **live staging BE lacks Phase 2** |
| `trial_started` | freetrial + trial-router | Both | New signup | analytics_events | overview/cohorts/executive | Same |
| `trial_search_started` | search-router | Server | Trial search start | analytics_events | funnels | Same |
| `trial_search_completed` | freetrial page | Client | Trial results ready | analytics_events | funnels | Same |
| `results_displayed` | freetrial page | Client | Results UI | analytics_events | funnels | Same |
| `paywall_viewed` | freetrial page | Client | Paywall | analytics_events | funnels | Same |
| `checkout_started` | checkout page | Client | Checkout page | analytics_events | overview/funnels/alerts | Same |
| `payment_initiated` | checkout page + checkout-router | Both | Pay start / initialize | analytics_events | KPIs | Same — **possible dual emit** |
| `payment_completed` | payment-fulfillment | Server | Successful pay | analytics_events | overview/cohorts/executive | Same |
| `payment_failed` | checkout-router / fulfillment | Server | Fail paths | analytics_events | KPIs | Same |
| `license_activated` | auth-router | Server | Activate success | analytics_events | overview/license-health | Same |
| `license_activation_failed` / `license_invalid` / `license_device_denied` / `duplicate_activation` | auth-router | Server | Activate errors | analytics_events | license-health | Same |
| `dashboard_entered` | activate page | Client | Post-activate | analytics_events | funnels | Same |
| `search_started` | search-router | Server | Paid/trial search | analytics_events | searches/executive | Same |
| `search_completed` / `search_failed` | search-job-lifecycle | Server | Terminal job | analytics_events | searches/quality | Same |
| `search_queued` / `dequeued` / `search_worker_*` | lifecycle | Server | Queue phases | analytics_events | infra | Same |
| `first_search` / `second_search` | search-ordinals | Server | Ordinal helpers | analytics_events | KPIs | Same |
| `csv_export` | csv-export feature | Client | Export | analytics_events | overview | Same |
| `mailbox_connected` / `disconnected` | mailboxes routes | Server | Connect/disconnect | analytics_events | outreach-health | Same |
| `email_sent` / `email_failed` / `first_outreach` | outreach-send-service | Server | Customer outreach SMTP | analytics_events | overview/outreach | Same |
| `email_opened` | outreach-tracking | Server | **Outreach** open pixel | analytics_events | outreach-health | Same |
| `smtp_failure` | outreach-smtp-error | Server | SMTP classify | analytics_events | alerts | Same |
| `webhook_failure` | webhook-router | Server | Pay webhook errors | analytics_events | alerts | Same |
| `exception` | server error handler | Server | Uncaught | analytics_events | errors/alerts | Same |
| `checkout_abandoned` | analytics.ts | Client | Abandon heuristic | analytics_events | alerts/KPIs | Same |
| `second_visit` / `returning_customer` | analytics.ts | Client | Visit heuristics | analytics_events | cohorts | Same |
| `page_view` / `page_exit` / `click` / `dead_click` / `scroll_depth` | behaviour tracker | Client | UX | analytics_events | events | Same |
| `withdrawal_requested` | affiliate-router | Server | Payout request | analytics_events | — | Same |
| `referral_signup` / `referral_conversion` | license-service / repo | Server | Affiliate | analytics_events | — | Same |

### Defined but **no `trackEvent` / `track()` emitter found**

| Event | Status |
|-------|--------|
| `business_saved` | Allowed client ingest; **no emitter found** → DEFINED BUT NOT FIRING |
| `business_opened` / `business_details_viewed` | Allowed client; **no emitter found** |
| `email_clicked` | Taxonomy + outreach-health counts; **no emitter found** |
| `email_queued` | Counted in outreach-health; **no emitter found** |
| `template_used` | Allowed client; **no emitter found** |
| `reply_received` | Counted; **no emitter found** |
| `referral_click` | Allowed client; **no emitter found** |
| `search_cancelled` | Allowed client; **no emitter found** |
| `license_expired` | Counted in license-health; **no emitter found** |
| `queue_backlog` / `worker_offline` / `browser_crash` as events | Alert metrics may use counts of these event names; **dedicated emitters not found** (infra uses health + other events) |
| `subscription_renewal` | Taxonomy only; **no emitter found** |
| `api_error` | Taxonomy/alerts; intentional comment: do not spam-emit from alert path |

### Nurture-specific (separate from `analytics_events`)

| Signal | Storage | In analytics_events? |
|--------|---------|----------------------|
| Trial sequence send | Resend API only (no app “sent” row) | **NO** |
| Trial email open | `trial_email_opens` via `/trial/email-opened` | **NO** (does not call `trackEvent`) |
| Trial unsubscribe | `free_trial_signups.sequence_paused` | **NO** |
| Trial convert flag | `free_trial_signups.converted` on payment | **NO analytics event named `trial_converted`** |

---

## 5. Trial funnel

### Intended chain (code)

Landing → Free trial view → Email submit / trial started → Trial search started/completed → Results → Paywall → Checkout started → Payment initiated → Payment completed → License activated → Dashboard → First/second search → CSV export → Mailbox → First outreach → Second visit / returning

### Live stage counts

| Stage | Event(s) | Live count | Conversion rate |
|-------|----------|------------|-----------------|
| All stages | — | **NOT VERIFIED** | Staging ingest **404**; prod health **503**; DB query **NOT VERIFIED** |

### Identity continuity (code design)

| Link | Mechanism | Survives? |
|------|-----------|-----------|
| Client sessions | `sessionId` / `anonymousId` + first-touch attribution in localStorage | Designed yes (when ingest works) |
| Email identity | `user_email_hash` when email known server-side | Designed for server events |
| Trial signup → payment | Same email → `markTrialSignupConverted` | **DB flag yes**; analytics join requires same hash on both event types |
| Nurture step → user | `trial_email_opens.email` + `step` | **Separate table**, not joined to `analytics_events` in APIs reviewed |

### Attribution survival (code design)

Client first-touch UTMs (`utm_source/medium/campaign/content/term`, `fbclid`, `gclid`) persist in browser and attach to client batches. Server payment events do **not** automatically inherit browser UTMs unless separately recorded — **join is hash/time based in admin attribution APIs**, not email-step based.

---

## 6. Email sequence tracking

Confirmed from code (unchanged):

| Item | Value |
|------|--------|
| Sequence | Trial Nurture **v3**, 30 steps |
| Extra | 1 post-search email (step tracking id **100**) |
| Content | `trial-email-content-v3.ts` |
| Send | `sendTrialEmail` / `sendTrialPostSearchEmail` → `sendNurtureEmail` → `sendViaResend` |
| Provider | **Resend only** |
| Scheduler | `trial-sequence.ts` hourly in-process |
| Timing | Hours-from-signup map in v3 (0 … 1085h) + post-search **+3h** |

---

## 7. Email event tracking (provider vs app)

| Capability | Resend Pro (provider) | LeadThur app storage | Linked to conversion analytics? |
|------------|----------------------|----------------------|----------------------------------|
| Sent | Provider-side (Resend dashboard) | **No** `analytics_events` / no sent log for nurture | **NO** |
| Delivered | Provider-side | **NOT FOUND** in app code | **NO** |
| Opened | Provider-side possible | **Yes** — `trial_email_opens` via open pixel | **Partial** — not in `analytics_events` / funnels |
| Clicked | Provider-side possible | **NOT FOUND** (no click redirect; `email_clicked` not emitted) | **NO** |
| Bounced | Provider-side | **NOT FOUND** webhook ingest | **NO** |
| Complained | Provider-side | **NOT FOUND** | **NO** |
| Unsubscribed | — | `sequence_paused` via `/unsubscribe` | **Partial** — not an analytics event |
| Converted | — | `converted` on payment fulfillment | **Partial** — DB flag; not email-step attributed |

Open pixel linkage (when open recorded):

- email  
- sequence step (1–30 or 100)  
- open_count / timestamps in `trial_email_opens`  
- **Not** linked to `analytics_events`, checkout, or payment in one timeline API without custom join  

---

## 8. Email → search attribution

**Question:** Which nurture email caused a return search?

| Check | Result |
|-------|--------|
| UTM on nurture CTA links | **NOT FOUND** — links are bare `leadthur.com/...`, `paystack.shop/...`, `pdigitalhq.com/...` |
| Sequence step in URL | **NOT FOUND** |
| Campaign / tracking ID in links | **NOT FOUND** |
| Open → next `search_started` join by time+email | **Possible offline** with `trial_email_opens` + hashed server search events; **not built** as product metric |

**Verdict:** **NOT CURRENTLY ATTRIBUTABLE** in-product.

Missing: tagged links (utm_content=step_N or similar), and/or analytics event on nurture send/open joined to search.

---

## 9. Email → payment attribution

**Question:** Which email influenced purchase?

Chain breaks:

1. No nurture `email_sent` in `analytics_events`  
2. Opens isolated in `trial_email_opens`  
3. No click tracking / no UTM on CTAs  
4. `payment_completed` has email hash but **no sequence_step property** from nurture  

**Verdict:** **NOT CURRENTLY ATTRIBUTABLE** to a specific sequence step.

Can approximate: trial user paid (`converted=true`) vs opened steps — **manual SQL only**, not admin “email → revenue” report.

---

## 10. Email → outreach attribution

Nurture open → dashboard → search → mailbox → outreach:

| Step | Trackable in Phase 2 design? |
|------|------------------------------|
| Nurture open | `trial_email_opens` only |
| Search / mailbox / `email_sent` (outreach) | `analytics_events` when Phase 2 live |
| Join nurture step → outreach | **NOT CURRENTLY ATTRIBUTABLE** |

Customer Gmail outreach remains separate SMTP system (untouched).

---

## 11. Attribution (Phase 2.1)

| Field | Stored on analytics_events (migration 040) | Client first-touch |
|-------|--------------------------------------------|--------------------|
| `utm_content` | Yes | Yes (`analytics.ts`) |
| `utm_term` | Yes | Yes |
| `fbclid` / `gclid` | Yes | Yes |

Admin: `/admin/observability/attribution`.

**Breaks for nurture:** nurture emails do not stamp these params. Landing ads can persist first-touch; nurture clicks start a new session without campaign tags → **email campaign attribution gap**.

---

## 12. Customer timeline

API: admin timeline (polish) reads `analytics_events` by identity filters.

| Check | Result |
|-------|--------|
| Staging live timeline | **NOT VERIFIED** — observability routes 404 |
| Safe staging account walkthrough | **NOT VERIFIED** — no Phase 2 ingest; SSO on FE |
| Would include nurture opens? | **No** — opens not in `analytics_events` |

---

## 13. Admin dashboard verification

| Surface | Depends on | Staging live |
|---------|------------|--------------|
| `/admin/analytics` observability tabs | `/admin/observability/*` | **FAIL** (404) |
| `/admin/dashboard` executive cards | `/admin/observability/executive` etc. | **FAIL** on staging live BE |
| Trial email performance panel | `trial_email_opens` via admin APIs | May work on older admin routes if present on `79b7392` — **NOT VERIFIED** end-to-end |

DB vs API vs UI count reconciliation: **NOT VERIFIED** (no live Phase 2 APIs on staging).

---

## 14. Funnel accuracy (code ownership)

| Event | Ownership | Duplication risk |
|-------|-----------|------------------|
| `checkout_started` | Client only | Low |
| `payment_initiated` | Client + server | **PARTIAL risk** — both emit |
| `payment_completed` | Server only | Low |
| `license_activated` | Server only | Low |
| `search_started` | Server | Low |
| `search_completed` / `search_failed` | Lifecycle success flag (2.1 polish) | Correct in tip; **not live on staging BE** |
| `csv_export` | Client | Low |
| `email_opened` | Outreach pixel only (not nurture) | Nurture opens elsewhere |
| `trial_email_submitted` / `trial_started` | Client + server on signup | **Possible double** on new signup |

Executive conversion: `distinct(payment_completed) / distinct(trial_started)` style ratios — **not** license-only, **not** email-step.

---

## 15. Conversion definitions

| Term | Actual definition in code |
|------|---------------------------|
| Trial conversion (DB) | `free_trial_signups.converted = true` on payment fulfillment |
| Payment conversion (analytics) | `payment_completed` event |
| License activation | `license_activated` on successful activate |
| Paid customer (cohorts) | Distinct email hashes with `payment_completed` |
| First paid search | `first_search` / `search_started` after license — ordinal helper |

These are **not identical**. Executive uses trial_started vs payment_completed / activated hashes — **approximate**, not nurture-step conversion.

---

## 16. Resend integration verification

| Check | Result |
|-------|--------|
| `RESEND_API_KEY` | Used in `email.ts` |
| `EMAIL_FROM` | Resend from (default `access@leadthur.com`) |
| Nurture | Resend-only |
| Transactional fallback | Zepto → Resend |
| Admin trial broadcast | Resend-only |
| Sequence / post-search | Resend-only |
| Resend delivery webhooks → LeadThur observability | **NOT FOUND** |
| Resend Pro features wired in app | **NOT FOUND** beyond API send |

---

## 17. Technical monitoring

| Metric | Design | Staging live |
|--------|--------|--------------|
| API latency | Middleware + snapshots | **NOT CONNECTED** on live staging BE |
| Search duration | Events / quality APIs | **NOT CONNECTED** live |
| Queue / Redis / browser | `/health` + infra route | Health **LIVE**; observability infra **NOT CONNECTED** |
| Search failures | `search_failed` | Code yes; live ingest no |
| SMTP / webhook failures | Events | Code yes; live ingest no |
| Memory / queue mode | `/health` | **LIVE** on staging |

---

## 18. Alerts

Catalogue keys exist (`search_failure_spike`, `smtp_failure_spike`, `redis_disconnected`, `queue_backlog`, `browser_crash_loop`, `webhook_failure`, `activation_failure`, `search_duration_spike`, `worker_offline`, `checkout_abandonment_high`, `api_error_spike`).

Evaluation runs when infra/overview paths execute on a Phase 2 binary.

**Staging live:** alert evaluation via observability **NOT CONNECTED** (404).  
Ack/resolve: implemented in polish router — **NOT VERIFIED** live.

---

## 19. Data quality

| Issue | Evidence |
|-------|----------|
| Staging cannot store client events | `/public/events` **404** |
| Taxonomy events without emitters | See §4 |
| Nurture opens outside analytics | `trial_email_opens` only |
| Possible client/server double counts | `trial_*` signup, `payment_initiated` |
| Live duplicates / timezone / orphans | **NOT VERIFIED** (no queryable Phase 2 dataset on staging) |

---

## 20. Direct answers

### Can LeadThur currently tell which emails, searches, and acquisition sources produce paying customers?

**PARTIALLY** (design) / **NO** for live staging right now.

- **Acquisition UTMs → revenue:** designed in Phase 2.1 when binary + DB live; **not verifiable on staging runtime**.  
- **Which nurture email:** **NO** — no step tags, no send events, opens siloed.  
- **Which searches:** **YES in code** (`search_*` events) when Phase 2 is live.

| Question | Answer |
|----------|--------|
| Where trial users drop out? | **PARTIALLY** — funnel events exist in code; **not live on staging** |
| Which email steps drive searches? | **NO** |
| Which email steps drive purchases? | **NO** |
| Which acquisition sources drive revenue? | **PARTIALLY** — UTM attribution APIs exist; needs live Phase 2 + data |
| Which users reached outreach? | **PARTIALLY** — `mailbox_connected` / `first_outreach` / `email_sent` in code |
| Which searches failed? | **PARTIALLY** — `search_failed` in code; not on staging live BE |
| Why users failed to convert? | **NO** as a causal model — only stage drop-offs if funnel live; no email-step or qualitative reason |

---

## 21. Scorecard

| Area | Status | Evidence |
|------|--------|----------|
| Trial tracking | **PARTIAL** | Events in tip; staging BE pre-Phase-2 |
| Search tracking | **PARTIAL** | Emitters in tip; not live staging |
| Search success tracking | **PARTIAL** | Lifecycle success/fail in tip |
| Email sent tracking (nurture) | **NOT IMPLEMENTED** | Resend only; no analytics event |
| Email open tracking (nurture) | **PARTIAL** | `trial_email_opens` pixel; not analytics funnel |
| Email click tracking (nurture) | **NOT IMPLEMENTED** | No click track; `email_clicked` unused |
| Email bounce tracking (nurture) | **NOT IMPLEMENTED** | No Resend webhook ingest |
| Email unsubscribe tracking | **PARTIAL** | Pauses sequence; not analytics event |
| Email → search attribution | **FAIL** | No UTM/step on links |
| Email → checkout attribution | **FAIL** | Chain broken |
| Email → payment attribution | **FAIL** | Chain broken |
| Email → activation attribution | **FAIL** | Chain broken |
| Email → conversion attribution | **FAIL** | Only coarse `converted` flag |
| UTM attribution | **PARTIAL** | Code+schema present; staging ingest down |
| Customer timeline | **PARTIAL** | API in tip; staging 404 |
| Cohorts | **PARTIAL** | API in tip; staging 404 |
| Revenue analytics | **PARTIAL** | `payment_completed` based; staging 404 |
| Outreach tracking | **PARTIAL** | SMTP outreach events in tip |
| Technical monitoring | **PARTIAL** | `/health` live; obs infra not on staging |
| Alerts | **PARTIAL** | Catalogue in tip; not live staging |
| Executive dashboard | **PARTIAL** | Wired in tip; staging BE cannot serve APIs |

---

## 22. Recommendations (do not implement here)

### P0

1. **Redeploy staging backend** to git tip (`9ba61c3` / at least Phase 2 SHA) so `/public/events` and `/admin/observability/*` exist — otherwise Phase 2/2.1 cannot be measured at all on staging.  
2. **Restore/verify production health** (was 503 during audit) and confirm SHA still matches `v2.0.0` / `bc10b0b`.  
3. **Nurture → revenue attribution gap:** without tagged CTAs or send/open events in `analytics_events`, email-step ROI cannot be answered — treat as P0 product intelligence gap (implementation later).

### P1

4. Emit or join nurture **sent/open/unsubscribe** into observability (or documented warehouse join of `trial_email_opens` ↔ payments).  
5. Resolve **dual emit** risk on `payment_initiated` / trial signup client+server.  
6. Wire or remove **dead taxonomy** events (`email_clicked`, `business_saved`, etc.) to avoid false admin zeros.

### P2

7. Resend webhook → bounce/complaint ingest (only if product needs ESP-level quality).  
8. Click tracking for nurture CTAs.  
9. Connect Supabase MCP / reporting to the **correct** staging project for repeatable audits.

---

## Final verdict

**LeadThur has a substantial Phase 2/2.1 observability system in git, and a complete Trial Nurture v3 on Resend — but they are not currently connected into one measurable email→revenue system on staging.**

- Staging live backend is still **`79b7392`** → observability endpoints **404**.  
- Nurture tracking is **Resend send + app open pixel table**, not funnel analytics.  
- **Email-step → search/payment attribution is not implemented.**

Until staging (and healthy production) run the Phase 2 binary **and** nurture steps are attributable, the answer to “which emails produce paying customers?” remains **NO** for sequence steps, and only **PARTIALLY** for generic acquisition UTMs / coarse trial→paid flags.
