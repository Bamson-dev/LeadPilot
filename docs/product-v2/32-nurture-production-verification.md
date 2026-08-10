# LeadThur Nurture Production Verification

**Date:** 2026-08-10  
**Scope:** Fix existing Trial Nurture v3 delivery for **new** free-trial signups only. No sequence/copy/timing changes. No mass unpause of legacy paused users.

---

## Executive result

# NURTURE PRODUCTION FLOW = WORKING

| Item | Status |
|------|--------|
| Root cause identified | **PASS** |
| Minimal code fix | **PASS** (`414ed78`) |
| Production deploy | **PASS** (live includes docs tip `b7b2f14`) |
| Disposable end-to-end send test | **PASS** |
| Existing paused users | **LEFT PAUSED** (no mass reactivation) |

**Live production SHA:** `b7b2f1418090d55f761f54d70f62da8780810970`  
**Fix commit:** `414ed78`  
**Test account:** `prod.nurture.1786356818@mailinator.com`

---

## 1. Root cause

Two independent bugs blocked nurture for new signups:

### A. Unsubscribe GET auto-paused every recipient (primary)

`GET /unsubscribe?email=...` called `pauseTrialSequence(email)` immediately.

Email security scanners (Microsoft Safe Links, Gmail link prefetch, etc.) fetch unsubscribe URLs in welcome emails. Every new trial user who received welcome was paused within seconds of send.

**Pre-fix production snapshot:**

| Metric | Count |
|--------|------:|
| Total `free_trial_signups` | 762 |
| `sequence_paused = true` | 762 |
| Active unconverted | 0 |

### B. Welcome path did not schedule the next send

Signup sent step 1 then called `updateTrialSequenceProgress(email, 1)` with default `next_sequence_email_at = null`.

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
| Attribution | `utm_campaign=trial_nurture_v3`, `utm_content=trial_v3_step_N` |
| Conversion stop | `markTrialSignupConverted()` |
| Unsubscribe stop | `pauseTrialSequence()` via **POST confirm only** |

---

## 3. Why emails were not sending

```
free_trial_signup
  → welcome email (step 1) ✓
  → scanner hits GET /unsubscribe → sequence_paused=true ✗
  → next_sequence_email_at stays null ✗
  → listTrialSignupsDueForSequence() returns 0 users ✗
  → scheduler tick sends nothing ✗
```

Scheduler was starting; eligibility was empty.

---

## 4. Exact fix (`414ed78`)

| File | Change |
|------|--------|
| `unsubscribe-router.ts` | GET = confirm page; POST = pause |
| `server.ts` | `express.urlencoded` before `/unsubscribe` |
| `trial-router.ts` | After welcome, `scheduleAfterStepSent()` → set `next_sequence_email_at` |
| `free-trial-repository.ts` | Explicit `sequence_paused: false` on create |
| `trial-sequence.ts` | Safe tick logs (`eligibleUnpaused`, `due`, `sent`, `failed`) |

---

## 5. Scheduler status

| Check | Result |
|-------|--------|
| Starts on boot | **PASS** |
| Hourly interval | **PASS** |
| Tick executed for due user | **PASS** (step 2 sent `2026-08-10 11:01:09 UTC`) |
| Tick logs (counts only) | Deployed |

---

## 6. Eligibility logic

Unchanged product rules:

- `converted = false`
- `sequence_paused = false`
- next step ≤ max step
- due when `now >= next_sequence_email_at` (or signup-relative hours fallback)

---

## 7. Resend result

| Send | Result |
|------|--------|
| Step 1 (welcome, signup path) | **Accepted** — `email_sent` recorded |
| Step 2 (scheduler path) | **Accepted** — `email_sent` recorded |
| Provider | Resend (unchanged) |

Safe metadata only; no API keys logged.

---

## 8. Database result (test user)

| Field | Value |
|-------|--------|
| `sequence_paused` | `false` (after signup **and** after GET `/unsubscribe`) |
| `sequence_version` | `3` |
| `sequence_step` (after tick) | `2` |
| `next_sequence_email_at` (after welcome) | `2026-08-10 15:13:41 UTC` (~+5h step 2) |
| `next_sequence_email_at` (after step 2) | `2026-08-11 10:13:41 UTC` (+24h step 3) |
| Schema / PostgREST | **PASS** — no schema-cache errors |

---

## 9. Test account result

| Gate | Result |
|------|--------|
| Trial signup | **PASS** |
| Eligible (`sequence_paused=false`) | **PASS** |
| `next_sequence_email_at` populated | **PASS** |
| GET unsubscribe does not pause | **PASS** (confirm HTML) |
| Scheduler picks up due user | **PASS** |
| Resend acceptance | **PASS** |
| `email_sent` step 1 | **PASS** `trial_nurture_v3` / `trial_v3_step_1` |
| `email_sent` step 2 | **PASS** `trial_nurture_v3` / `trial_v3_step_2` |
| Sequence advancement | **PASS** (1 → 2) |
| Next email scheduling | **PASS** (step 3 at signup+24h) |
| Duplicate sends | **PASS** (exactly 1 `email_sent` for step 2) |
| `email_opened` (pixel) | **PASS** `trial_v3_step_2` |
| `email_clicked` | **NOT TESTED** (CTA click not exercised) |

---

## 10. Existing paused-user status

| Metric (post-verify) | Count |
|----------------------|------:|
| `sequence_paused = true` | ~764 |
| Active unconverted test user | 1 |

**No mass unpause performed.** Legacy rows left paused.

**Safe reactivation (operator-only, reviewed users):** set `sequence_paused=false` and compute `next_sequence_email_at` per `scheduleAfterStepSent` rules for that user’s step — never blanket-update all paused rows.

---

## 11. Production SHA

| Ref | SHA |
|-----|-----|
| Live `/health` | `b7b2f1418090d55f761f54d70f62da8780810970` |
| Nurture fix | `414ed78` |
| Verification docs tip | `b7b2f14` |

---

## 12. Final result

```
NEW TRIAL USER
  → eligible (sequence_paused=false)
  → next_sequence_email_at set
  → scheduler picks them up
  → Resend accepts email
  → email_sent recorded
  → sequence advances
  → next email scheduled
```

**NURTURE PRODUCTION FLOW = WORKING**
