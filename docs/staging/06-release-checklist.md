# 06 — Release Checklist (Staging → Production)

Official checklist before promoting LeadThur V2 work to production.  
Run on **staging** first. Re-run smoke on **production** after deploy.

---

## A. Environment readiness

- [ ] Staging FE reachable (Vercel SSO bypass arranged for QA if needed)
- [ ] Staging BE `GET /health` → `status: ok`, `browser: ready`, `queue.mode: bullmq`
- [ ] Staging `gitCommitSha` matches intended staging commit
- [ ] Staging DB is **not** production Supabase
- [ ] **`MOCK_OUTREACH_SEND`, `MOCK_MAILBOX_SMTP`, `ENABLE_TEST_EMAIL`, `DEMO_MODE` are unset** on Coolify staging
- [ ] Paystack/Flutterwave **test** keys on staging
- [ ] Production deploy credentials: `COOLIFY_DEPLOY_WEBHOOK_URL` or VPS secrets present for `main`

---

## B. Health / infrastructure

- [ ] `bash backend/scripts/verify-deployment.sh https://staging-backend.leadthur.com` all pass
- [ ] `/health/ready` 200
- [ ] `/health/client-ip` shows expected IP; allowlist if QA blocked by rate limit
- [ ] Memory `safe: true`
- [ ] Redis/BullMQ mode confirmed
- [ ] Playwright/browser ready

---

## C. UI / UX

- [ ] Marketing home loads
- [ ] Free trial gate + 1 search completes
- [ ] Checkout page loads (do not charge live cards on staging)
- [ ] Activate with staging license
- [ ] Dashboard search → results stream/poll
- [ ] CSV export
- [ ] Lead status change
- [ ] WhatsApp modal opens
- [ ] Outreach mailbox connect (real Gmail app password)
- [ ] Outreach send (real SMTP — disposable recipient)
- [ ] `/dashboard/plans` checkout init (test mode)
- [ ] Admin login + account lookup
- [ ] No unintended layout regressions vs approved designs

---

## D. Responsive

- [ ] Desktop (~1440)
- [ ] Tablet (~768)
- [ ] Mobile (~390)
- [ ] Critical CTAs tappable (min ~48px)

---

## E. Accessibility (minimum bar)

- [ ] Keyboard reach primary flows (activate, search submit, modal close)
- [ ] Forms have visible labels
- [ ] Focus visible on interactive controls
- [ ] No critical contrast failures on primary text

---

## F. Performance

- [ ] Search returns first leads without UI freeze
- [ ] SSE or poll recovers if stream drops
- [ ] Large result set scroll usable (virtualized table)
- [ ] Admin tables usable (horizontal scroll OK)

---

## G. Payments

- [ ] Staging initialize checkout returns authorization URL / Flutterwave config
- [ ] Webhook target for staging documented and configured in Paystack dashboard (**confirm outside repo if needed**)
- [ ] No production live keys on staging
- [ ] After promote: production webhook still `https://backend.leadthur.com/webhooks/paystack`

---

## H. Search / scraping

- [ ] Paid search job completes to `fullyComplete`
- [ ] Emails enrich (or predicted) without crash
- [ ] Trial limits: 2/email and IP cap behave
- [ ] Queue does not stall (watch Coolify logs / health queue depth)

---

## I. Outreach

- [ ] Mailbox connect path works under current mock/live setting
- [ ] Send queues and appears in Sends report
- [ ] Open pixel URL points at staging-backend when on staging
- [ ] Bounce/mock paths if testing bounce handling

---

## J. License / affiliate / admin

- [ ] Activate stores license; dashboard gate passes
- [ ] Suspended flow (if tested) lands on `/suspended`
- [ ] Affiliate stats load for licensed user
- [ ] Admin generate-access / lookup / suspend (staging only)
- [ ] Blog public read; admin edit on staging if changed

---

## K. Email / analytics

- [ ] Transactional test send (welcome/access) if changed
- [ ] Trial sequence **paused or carefully tested** (avoid blasting)
- [ ] Site scripts: test on staging before production save (admin warning exists in UI)

---

## L. Promotion to production

- [ ] Staging QA signed off
- [ ] UX / design approval recorded
- [ ] Merge to `main`
- [ ] GitHub Actions production backend deploy green
- [ ] Vercel production frontend updated
- [ ] `https://backend.leadthur.com/health` SHA matches release
- [ ] Production smoke: activate/search OR documented critical path
- [ ] Monitor Coolify logs 30–60 minutes post-release

---

## Scripts that help (staging)

Located under `backend/scripts/`:

- `verify-deployment.sh`
- `verify-outreach-staging.mjs` / `verify-outreach-staging-live.mjs`
- `verify-trial-limit-staging.mjs`
- `verify-staging-migrations.mjs`
- `verify-mailbox-flow.mjs` (uses `.env.staging`)

Run only against staging credentials.
