# LeadThur Nurture Production Verification

**Date:** 2026-08-10  
**Scope:** Fix existing Trial Nurture v3 delivery for **new** free-trial signups only. No sequence/copy/timing changes. No mass unpause of legacy paused users.

---

## Executive result

| Item | Status |
|------|--------|
| Root cause identified | **PASS** |
| Minimal code fix committed | **PASS** (`414ed78` on `main`) |
| Production deploy | **BLOCKED** — GitHub Actions `Deploy Backend` failed: no `COOLIFY_DEPLOY_WEBHOOK_URL` / VPS SSH secrets |
| Live production SHA | `d5d4099` (pre-fix) |
| Fix SHA (not live yet) | `414ed78` |
| Disposable end-to-end send test | **PENDING** deploy to `414ed78` |
| Existing paused users (762) | **UNCHANGED** (intentional — no mass reactivation) |

**NURTURE PRODUCTION FLOW = NOT VERIFIED LIVE** until production runs `414ed78` and one disposable signup completes the real Resend path.

---

## 1. Root cause

Two independent bugs blocked nurture for new signups:

### A. Unsubscribe GET auto-paused every recipient (primary)

`GET /unsubscribe?email=...` called `pauseTrialSequence(email)` immediately.

Email security scanners (Microsoft Safe Links, Gmail link prefetch, etc.) fetch unsubscribe URLs in welcome emails. Every new trial user who received welcome was paused within seconds of send.

**Evidence (production DB, 2026-08-10):**

| Metric | Count |
|--------|------:|
| Total `free_trial_signups` | 762 |
| `sequence_paused = true` | 762 |
| Active unconverted (`sequence_paused = false`) | 0 |
| With `next_sequence_email_at` set (unpaused) | 0 |

Recent signups (including smoke tests) show: `sequence_step = 1`, `last_email_sent_at` populated, `next_sequence_email_at = null`, `sequence_paused = true` shortly after welcome.

**Where pause was set:** `backend/src/api/unsubscribe-router.ts` → `pauseTrialSequence()` on GET.

### B. Welcome path did not schedule the next send

On signup, `trial-router.ts` sent step 1 then called `updateTrialSequenceProgress(email, 1)` with default `nextSequenceEmailAt = null`.

The hourly scheduler (`listTrialSignupsDueForSequence`) only selects `sequence_paused = false`. Even unpaused users relied on `next_sequence_email_at` or signup-relative hours; welcome never wrote the next timestamp.

---

## 2. Existing implementation (unchanged architecture)

| Component | Location |
|-----------|----------|
| Scheduler startup | `backend/src/server.ts` → `startTrialSequenceScheduler()` |
| Hourly tick + post-search | `backend/src/services/trial-sequence.ts` |
| Eligible query | `listTrialSignupsDueForSequence()` — `converted=false`, `sequence_paused=false` |
| Step due logic | `isSequenceStepDue()` in `trial-sequence-schedule.ts` |
| v3 timing | `V3_TRIAL_STEP_HOURS_FROM_SIGNUP` (step 2 = 5h after signup, etc.) |
| Resend send + `email_sent` | `backend/src/services/email.ts` → `sendTrialEmail()` |
| Open pixel | `GET /trial/email-opened` |
| Attribution | `email-nurture-attribution.ts` — `utm_campaign=trial_nurture_v3`, `utm_content=trial_v3_step_N` |
| Conversion stop | `markTrialSignupConverted()` sets `converted=true`, `sequence_paused=true` |
| Unsubscribe stop | `pauseTrialSequence()` (now POST-only confirm) |

---

## 3. Exact fix (`414ed78`)

| File | Change |
|------|--------|
| `backend/src/api/unsubscribe-router.ts` | GET shows confirm page only; POST confirms and pauses |
| `backend/src/server.ts` | `express.urlencoded` before `/unsubscribe` router |
| `backend/src/api/trial-router.ts` | After welcome send, `scheduleAfterStepSent()` → `updateTrialSequenceProgress(..., nextSendAt)` |
| `backend/src/database/free-trial-repository.ts` | `createTrialSignup` explicitly sets `sequence_paused: false`, `sequence_step: 0` |
| `backend/src/services/trial-sequence.ts` | Safe scheduler tick logs: `eligibleUnpaused`, `due`, `sent`, `failed` (no PII) |

**Preserved:** email copy, v3 timing, Resend provider, conversion/unsubscribe semantics, attribution model, admin reporting.

---

## 4. Why emails were not sending (execution path)

```
free_trial_signup
  → welcome email (step 1) ✓
  → scanner hits GET /unsubscribe → sequence_paused=true ✗
  → next_sequence_email_at stays null ✗
  → listTrialSignupsDueForSequence() returns 0 users ✗
  → scheduler tick sends nothing ✗
```

Scheduler **was** starting (`Trial email sequence scheduler started (hourly)`); execution found zero eligible users.

---

## 5. Scheduler status

| Check | Pre-fix (`d5d4099`) | Post-fix (expected) |
|-------|----------------------|---------------------|
| Starts on boot | Yes | Yes |
| Hourly interval | Yes | Yes |
| Startup delay 30s | Yes | Yes |
| Tick logging | Email in logs | Counts only |
| Eligible users | 0 (all paused) | >0 for new signups |

---

## 6. Eligibility logic (unchanged rules)

`listTrialSignupsDueForSequence()`:

- `converted = false`
- `sequence_paused = false`

Per-user in scheduler:

- `nextStep = sequence_step + 1` while `nextStep <= maxStep`
- Due when `now >= next_sequence_email_at` OR signup-relative hours met

Safeguards retained: converted, paused, unsubscribed (via pause), sequence completion.

---

## 7. Resend

- Resend Pro remains the provider (`RESEND_API_KEY` in Coolify env — not verified in this session).
- No provider changes in fix commit.
- Post-deploy verification must capture: HTTP status, accepted/rejected, message ID (safe metadata only).

---

## 8. Database

| Column | Status |
|--------|--------|
| `next_sequence_email_at` | Exists (migration 037); PostgREST read/write OK |
| Production snapshot | 762 rows, all paused, 0 pending nurture candidates |

---

## 9. Existing paused users (762)

**Do not bulk-unpause.** These were paused by:

1. Unsubscribe prefetch (primary, pre-fix)
2. Legitimate unsubscribe confirms
3. Conversion (`markTrialSignupConverted`)
4. Prior verification/testing pauses

**Safe reactivation (operator-only, per-user or cohort review):**

```sql
-- Example: single user who explicitly wants emails AND has not converted
-- ONLY after confirming they did not intentionally unsubscribe
UPDATE free_trial_signups
SET sequence_paused = false,
    next_sequence_email_at = <computed per scheduleAfterStepSent rules>
WHERE email = '<reviewed-email>'
  AND converted = false
  AND sequence_paused = true;
```

Do **not** run a blanket `UPDATE ... SET sequence_paused = false` on all 762 rows — that would risk mass catch-up sends.

---

## 10. Deploy blocker

Push to `main` succeeded (`414ed78`). GitHub Actions run `31364081285` **failed** at step **Validate deploy configuration**:

- Neither `COOLIFY_DEPLOY_WEBHOOK_URL` nor `VPS_HOST` + `VPS_SSH_KEY` + `VPS_USER` is configured in repo secrets.

Production `/health` still reports `gitCommitSha: d5d409980386f75f63e2091fbf032b43865c5497`.

### Operator action (choose one)

1. **Coolify (fastest):** Log in → production backend service → **Redeploy** from `main` @ `414ed78` (or enable auto-deploy on `main`).
2. **GitHub secret:** Add `COOLIFY_DEPLOY_WEBHOOK_URL` (Coolify → service → Webhooks) and re-run **Deploy Backend** workflow.
3. **Legacy SSH:** Configure `VPS_HOST`, `VPS_USER`, `VPS_SSH_KEY` for `scripts/deploy-vps.sh` path.

After deploy, confirm:

```bash
curl -sS https://backend.leadthur.com/health | jq '.gitCommitSha'
# Must start with 414ed78
```

---

## 11. Post-deploy disposable test plan

Use a **new** address only (e.g. `prod.nurture.<unixtime>@mailinator.com`). Do not reuse customer emails.

### Step 1 — Signup

```bash
EMAIL="prod.nurture.$(date +%s)@mailinator.com"
curl -sS -X POST https://backend.leadthur.com/trial/signup \
  -H 'Content-Type: application/json' \
  -d "{\"email\":\"$EMAIL\"}"
```

### Step 2 — DB checks (Supabase production)

Expect:

| Field | Expected |
|-------|----------|
| `sequence_paused` | `false` |
| `sequence_version` | `3` |
| `sequence_step` | `1` |
| `next_sequence_email_at` | ISO timestamp ~5h after signup (step 2 due) |
| `last_email_sent_at` | set |

### Step 3 — Unsubscribe prefetch regression

```bash
curl -sS "https://backend.leadthur.com/unsubscribe?email=$EMAIL" | head -5
# Must NOT pause; should return confirm HTML
```

Re-check DB: `sequence_paused` still `false`.

### Step 4 — Force step 2 due (scheduler)

```sql
UPDATE free_trial_signups
SET next_sequence_email_at = now() - interval '1 minute'
WHERE email = '<test-email>' AND sequence_paused = false;
```

Wait for scheduler tick (≤1h; startup tick at +30s after redeploy) or restart backend to trigger early tick.

### Step 5 — Verify send + analytics

- Resend dashboard: step 2 accepted
- `analytics_events` (or admin Email Revenue): `email_sent` with `utm_campaign=trial_nurture_v3`, `utm_content=trial_v3_step_2`
- DB: `sequence_step = 2`, new `next_sequence_email_at` for step 3
- Open welcome/step email → `email_opened`; click CTA → `email_clicked`
- No duplicate sends for same step

---

## 12. Verification scripts

```bash
cd backend
node scripts/verify-trial-email-sequence-v3.mjs   # static sequence contract — PASS at fix commit
npx tsc --noEmit -p tsconfig.json                 # PASS at fix commit
# After deploy + env:
# SUPABASE_URL=... SUPABASE_SERVICE_KEY=... node scripts/verify-trial-email-sequence-production.mjs
```

---

## 13. Final result

| Gate | Result |
|------|--------|
| Root cause | **FIXED in code** |
| Fix on `main` | **414ed78** |
| Production live | **d5d4099** — redeploy required |
| New signup nurture path | **PENDING** live verification |
| 762 paused legacy users | **LEFT PAUSED** |

**Success condition (not yet met on production):**

NEW TRIAL USER → eligible → `next_sequence_email_at` → scheduler → Resend → `email_sent` → sequence advances → next email scheduled.

---

## 14. Production SHA reference

| Ref | SHA |
|-----|-----|
| Pre-fix live | `d5d409980386f75f63e2091fbf032b43865c5497` |
| Nurture fix commit | `414ed78` |
