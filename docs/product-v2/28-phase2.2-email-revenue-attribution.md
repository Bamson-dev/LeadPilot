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

1. Push focused commit to `origin/staging` — **done:** `05ac7fd` (`feat(v2): add email to revenue attribution`).
2. Confirm Coolify backend redeploys to the new SHA (manual redeploy if webhook lag — prior Phase 2.1 stuck on `79b7392`).
3. Gates:
   - `GET /health` → expected `gitCommitSha` starting `05ac7fd`
   - `POST /public/events` → **202**
   - `GET /admin/observability/*` → **401** unauthenticated (not 404)
4. Controlled journey on safe test accounts only (no mass mail, no real prospect outreach).

### Live probe (2026-08-09 post-push)

| Check | Expected | Observed |
|-------|----------|----------|
| `origin/staging` | `05ac7fd` | **PASS** |
| Live `gitCommitSha` | `05ac7fd…` | **FAIL** — still `79b7392…` |
| `POST /public/events` | 202 | **FAIL** — 404 |
| `/admin/observability/*` | 401 | **FAIL** — 404 (old binary) |

**Action required:** Manual Coolify redeploy of staging backend to `05ac7fd` (or current `staging` tip). Attribution smoke tests blocked until SHA matches.

---

## Live verification checklist

- [ ] Observability live (202 / 401)
- [ ] `email_sent` after nurture send
- [ ] `email_opened` after pixel
- [ ] `email_clicked` after CTA land
- [ ] Search / checkout retain first-touch + last_nurture props
- [ ] Payment/activation join on Email Revenue when data exists
- [ ] No duplicate `payment_completed` for one reference
- [ ] Gmail outreach unchanged
- [ ] Resend config unchanged

---

## Known limitations

- External Paystack Shop CTAs do not hit LeadThur until return/visit; LeadThur-hosted CTAs drive `email_clicked`.
- Server payment webhooks may lack first-touch UTMs on the payment row; Email Revenue uses last-click join by email hash.
- No historical click backfill.
- Staging may require **manual Coolify redeploy**.

---

## Remaining work

| Priority | Item |
|----------|------|
| P0 | Confirm staging Coolify SHA matches tip; rerun live journey |
| P1 | Optional redirect wrapper for external checkout CTAs (only if product accepts) |
| P2 | Richer rate cards / step filter UI in admin |

---

## Final GO / NO-GO

| Gate | Status |
|------|--------|
| Code (TS, build, static verify) | **GO** — commit `05ac7fd` on `origin/staging` |
| Staging live observability | **NO-GO** — Coolify still serving `79b7392`; `/public/events` 404 |
| Live attribution journey | **BLOCKED** until redeploy |

**Overall: NO-GO for live Phase 2.2 validation** until staging backend SHA = `05ac7fd` (or later tip) and gates pass.
