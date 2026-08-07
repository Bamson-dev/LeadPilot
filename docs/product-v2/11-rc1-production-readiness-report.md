# LeadThur V2 RC1 — Production Readiness Release Report

**Date:** 2026-08-05  
**Branch:** `staging` (ahead of origin; includes V2 RC1 workspaces + QA audit)  
**Scope:** Authentication, payments, license, Discovery, Saved Leads, Mailboxes, Outreach, responsive, performance, accessibility, security, navigation, errors/loading, routes/dead code, env/flags, analytics/SEO, build/deploy, migrations, rollback  
**Method:** Read-only code and docs review. **No fixes applied.**

---

## Verdict

### LeadThur V2 RC1 is **not production-ready** until P0 items are closed.

| Layer | Status |
|-------|--------|
| V2 product UI (Discovery → Saved → Outreach → Mailboxes) | **Ready for happy-path RC1** after recent freeze + QA |
| Monetization / metering integrity | **Not ready** — search limit fails open; top-up credits trust metadata |
| Security / data protection | **Not ready** — sensitive tables without RLS; XSS × localStorage license |
| Ops / deploy / rollback | **Not ready** — incomplete env gates, no rollback runbook, weak CI |
| Outreach live send | **Conditional** — only if prod has `MOCK_OUTREACH_SEND` unset |

**Ship recommendation:** Hold production cutover. Run a **P0 remediation sprint**, then a short **go/no-go checklist** (below). Soft-launch (invite-only staging users) is acceptable for UX validation only.

---

## Severity definitions

| Level | Meaning |
|-------|---------|
| **P0** | Must fix before production (security, payment integrity, silent monetization bypass, or catastrophic ops misconfig) |
| **P1** | Fix before or within days of launch (user-blocking false states, auth weakness, deploy gaps) |
| **P2** | Important debt / polish; do not block a controlled soft launch after P0/P1 |
| **P3** | Nice-to-have / hygiene |

---

## Issue register

### P0 — Block production

| ID | Area | Finding | Evidence | Risk |
|----|------|---------|----------|------|
| P0-1 | Discovery / metering | **Search limit middleware fails open** on DB/limit errors — grants search with `licenseId: "unknown"` / 99 remaining | `backend/src/middleware/check-search-limit.ts` L28–38, L70–74, L127–138 | Any Supabase blip → free unlimited searches |
| P0-2 | Payments | **Top-up fulfillment trusts `metadata.credits`** (esp. Flutterwave path) without recomputing from verified amount/tier | `backend/src/services/topup-service.ts` L62–119; FLW client meta in `SearchLimitModal.tsx` | Pay small amount, claim large credits |
| P0-3 | Outreach / ops | **`MOCK_OUTREACH_SEND=1` defaults in env examples**; no hard prod guard | `backend/.env.example`, `.env.staging.example`; `outreach-send-smtp.ts` | Prod misconfig → fake “sent” emails, silent outage |
| P0-4 | Security | **`connected_mailboxes` (and other outreach/user tables) lack RLS**; anon key is a public env pattern | `supabase/migrations/030_outreach_mailboxes.sql` (no RLS); `frontend/utils/env.ts` | Mailbox ciphertext / PII readable if PostgREST grants allow |
| P0-5 | Security | **Stored XSS surface × license in `localStorage`** (blog HTML + site scripts unsanitized) | `blog-content.ts` / `blog-article-view.tsx`; `layout.tsx` site scripts; `lib/license.ts` | Compromised HTML/scripts → full account takeover |
| P0-6 | Security / ops | **Unauthenticated `/admin/test-email`** when `ENABLE_TEST_EMAIL=true` or `FRONTEND_URL` contains staging host | `backend/src/api/admin-router.ts` ~1836–1907 | Open mailer if prod env mis-set |

---

### P1 — Before or immediately after launch

| ID | Area | Finding | Evidence | Risk |
|----|------|---------|----------|------|
| P1-1 | Auth | Device binding **not enforced** on `requireLicense` | `require-license.ts`; device only on activate | Stolen key works from any device |
| P1-2 | Auth | `max_devices` effectively clamped to 4 | `license-repository.ts` | Admin device limits unreliable |
| P1-3 | Auth | License key in localStorage + **SSE query string** | `getLicenseQueryString`, EventSource search stream | Log/proxy leakage |
| P1-4 | Payments | Paystack **invalid signature / missing secret → HTTP 200** | `webhook-router.ts` L51–65 | Silent non-fulfillment; hard to alert |
| P1-5 | Payments | Outreach pack/sub fulfillment weaker amount defense than lifetime | `payment-fulfillment.ts` | Defense-in-depth gap |
| P1-6 | Payments / concurrency | Top-up credit apply and search consume are **non-atomic RMW** | `topup-service.ts`, license consume | Double-credit / over-consume under concurrency |
| P1-7 | Mailboxes / Outreach | **`useOutreach` swallows mailbox fetch errors** → empty list looks like “no mailbox” | `frontend/hooks/useOutreach.ts` | Users reconnect unnecessarily; hides outages |
| P1-8 | Mailboxes | Disconnect failure **silent** in embedded section | `outreach-mailbox-section.tsx` `handleRemove` | User thinks mailbox removed when it isn’t |
| P1-9 | Saved Leads | Hydration errors **skipped silently** | `useSavedLeads.ts` | Missing emails → failed outreach |
| P1-10 | Rate limit | `/auth`, `/trial`, `/public` **not** rate-limited like search; in-memory only | `server.ts`, `rate-limit.ts` | Brute-force activate; weak multi-replica |
| P1-11 | Deploy / env | Prod schema doesn’t require Paystack/FLW/Redis/mailbox crypto; deploy examples incomplete / stale (Brevo vs Zepto) | `config/env.ts`, `deploy/*`, `.env.example` | Boots “healthy” with broken checkout/email/queues |
| P1-12 | Deploy | **No CI lint/test/build**; deploy workflow is Coolify webhook + health SHA only | `.github/workflows/deploy.yml` | Broken builds can reach prod |
| P1-13 | Migrations | Incomplete story: missing numbers, dual `037_*`, few rollbacks, `site_settings` used without clear migration | `supabase/migrations/`, startup migrate subset | Drift / failed deploys |
| P1-14 | Rollback | **No app/DB rollback runbook** in `DEPLOYMENT.md` | `DEPLOYMENT.md` | Cannot safely revert a bad release |
| P1-15 | Frontend | Client-only license gates (flash before API reject) | dashboard pages / staging handbook | Confusing UX; demo path caveats |

---

### P2 — Important polish / debt

| ID | Area | Finding |
|----|------|---------|
| P2-1 | Navigation | Home + Discovery both land on `/dashboard`; Discovery active only on `/dashboard/search*` |
| P2-2 | Navigation | Dual Outreach (Discovery embedded workspace vs `/dashboard/outreach`) |
| P2-3 | Navigation | Dual Mailboxes (dedicated page + Outreach/Discovery tabs) — intentional but confusing |
| P2-4 | Navigation | Sidebar “API” is a non-interactive stub; Affiliate not a first-class route |
| P2-5 | Product | Discovery zero-results weaker than Saved/Outreach `EmptyState` |
| P2-6 | a11y | Embedded Discovery outreach tabs are custom (not `ui/tabs`) |
| P2-7 | Perf | Saved hydration cap 25×200; full Discovery client hydrate via `ssr: false` router |
| P2-8 | Security | CORS still allows localhost + legacy `leadpilot.live` in prod |
| P2-9 | Security | No CSP/Helmet in app (may rely on Cloudflare) |
| P2-10 | Security | `/health/client-ip` diagnostics exposed |
| P2-11 | Payments | Webhook `setImmediate` after 200 — crash can lose fulfillment until manual verify |
| P2-12 | Flags | No formal feature-flag system — only env/hostname toggles |
| P2-13 | SEO | `robots` omits some utility paths (`/suspended`, `/get-access`, etc.) |
| P2-14 | Dead code | `ShellNavId` still includes `insights`; dead mailbox tab event listeners |
| P2-15 | UI debt | WhatsApp modal + demo recording still V1 violet styling |
| P2-16 | Docs | Outreach milestone mailbox URL may still say `?tab=mailboxes` |

---

### P3 — Nice to have

| ID | Area | Finding |
|----|------|---------|
| P3-1 | Auth | HttpOnly session tokens instead of raw license headers |
| P3-2 | Payments | Startup warn on `sk_test` in production; 401 on bad Paystack signature |
| P3-3 | Analytics | No first-party analytics — only admin-injected `site_scripts` |
| P3-4 | DS | Unused exports: `SectionHeader`, `Pagination`, `RadioGroup`, `Switch` |
| P3-5 | UX | Notifications control intentionally disabled |
| P3-6 | Marketing | Orphan routes (`/get-access`, `/start`, `/demo-recording`) — verify intentional |

---

## Area summaries

### Authentication & license activation
Activate stores email + key in **localStorage**; APIs use `x-license-key` / `x-license-email`. Suspension checks work. Device slots exist but are **not enforced** on each request. Activation can succeed with confusing device-slot side effects. **Adequate for soft launch after P0 XSS mitigation; not strong DRM.**

### Payments
Lifetime Paystack/Flutterwave paths validate amounts more carefully. **Search top-ups are weaker** (metadata credits). Outreach checkout depends heavily on webhooks; success page polling may miss failed secret/signature ACKs (HTTP 200). Unique payment references help idempotency, but concurrency RMW remains.

### Discovery / Saved / Outreach / Mailboxes (V2)
Frozen modules are **product-ready for the happy path**: compose, send history, mailbox connect/disconnect, status/export flows reuse real APIs. Empty/loading/error chrome exists. Gaps are **false empties** when APIs fail silently (P1), dual entry points (P2), and Discovery still embedding legacy outreach chrome (P2).

### Responsive / accessibility / performance
RC1 shell is responsive (sidebar / bottom tabs / details drawer-dialog). Status is generally not color-only. Remaining issues: custom tabs a11y, tablet density, Saved hydration caps, full client Discovery hydrate — **P2**, not ship blockers after P0/P1.

### Security
Highest residual risks: **fail-open metering**, **top-up integrity**, **RLS gaps on mailbox secrets**, **XSS × localStorage**. Rate limits incomplete on auth. Webhook signature failures acknowledged with 200.

### Navigation / routes / dead code
Primary V2 routes exist and match shell (`/dashboard`, `/saved`, `/outreach`, `/mailboxes`, `/plans`). Insights removed from nav. Dead V1 components removed in QA commit. Remaining stubs: insights type, API span, dual surfaces.

### Environment / feature flags
No LaunchDarkly-style flags. Critical toggles: `MOCK_OUTREACH_SEND`, `MOCK_MAILBOX_SMTP`, `DEMO_MODE`, `ENABLE_TEST_EMAIL`, staging hostname. **Prod must be verified by hand.**

### Analytics / SEO
Root metadata + `robots.ts` + `sitemap.ts` present. Analytics only via CMS/admin scripts. Not a RC1 blocker.

### Build / deployment
Frontend: Vercel (`frontend/`). Backend: Coolify + GitHub Action health check. **No automated quality CI.** Staging handbook notes BE SHA drift / SSO caveats.

### Database migrations / rollback
Migrations 001–037 exist with numbering quirks and sparse rollbacks (outreach 030/031 optional drops). **No documented rollback strategy** for app or full DB. Startup auto-migrate is a partial subset.

---

## What is already solid

1. V2 RC1 UI freeze + design-system tokens after QA pass (`fd1a866` and prior milestone commits)
2. License activation UX and suspended-account handling
3. Paystack HMAC verification path exists (when secret is set)
4. Lifetime payment amount validation stronger than top-up path
5. Outreach send queue, mailboxes, sends report wired to real backend
6. Staging handbook + product-v2 milestones document known limitations honestly
7. Real secrets appear gitignored (examples only tracked)

---

## Go / no-go checklist (before prod)

### Must be true (P0)

- [ ] `checkSearchLimit` fails **closed** (503) on license/limit DB errors  
- [ ] Top-up fulfillment derives credits from **server-side tier + verified amount**, ignores client `credits`  
- [ ] Prod Coolify: `MOCK_OUTREACH_SEND` unset/off; `MOCK_MAILBOX_SMTP` unset; `DEMO_MODE` off; `ENABLE_TEST_EMAIL` unset; `FRONTEND_URL=https://www.leadthur.com` (no staging substring)  
- [ ] RLS (deny-by-default) on `connected_mailboxes` and other non-RLS user/outreach tables; confirm anon cannot select secrets  
- [ ] Blog HTML sanitized (or no arbitrary HTML); site scripts reviewed / restricted  
- [ ] Smoke: activate → search → save → connect Gmail → queue send → appear in send history (live SMTP)

### Should be true (P1)

- [ ] Paystack webhook secret matches live dashboard; invalid signature visible in monitoring (prefer non-200)  
- [ ] Vercel: `NEXT_PUBLIC_FLUTTERWAVE_PUBLIC_KEY`, API URL, Paystack public key set  
- [ ] Redis / mailbox encryption key / Zepto (or current mail provider) set for outreach  
- [ ] `useOutreach` surfaces fetch errors (no silent empty)  
- [ ] Written rollback: previous Coolify image + Vercel promotion + DB restore/point-in-time  
- [ ] CI: at least `tsc` + lint on PR  

---

## Suggested remediation order

1. **P0-1** Fail-closed search metering  
2. **P0-2** Top-up credit integrity  
3. **P0-3 / P0-6** Prod env audit (MOCK_*, test-email, FRONTEND_URL)  
4. **P0-4** RLS on sensitive tables  
5. **P0-5** XSS sanitization / script policy  
6. **P1** Auth hardening, webhook ACK behavior, useOutreach errors, CI + rollback docs  
7. **P2** Nav dual-surface consolidation (post soft launch)

---

## Final recommendation

| Question | Answer |
|----------|--------|
| Is V2 UI RC1 quality for operators? | **Yes** (happy path), with known dual-entry and error-swallow polish |
| Is the platform production-ready? | **No** |
| Can we soft-launch to internal testers on staging? | **Yes** |
| Can we cut over www.leadthur.com? | **No — close P0 first** |

**Estimated gate:** After P0 remediation + checklist smoke, reconsider go/no-go. Do not treat V2 UI completion as equivalent to production readiness.

---

*Report only. No code or config was changed for this audit.*
