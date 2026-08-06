# LeadThur V2 — Public Customer Journey Milestone

**Date:** 2026-08-06  
**Scope:** Visual modernization only (Landing → Trial → Checkout → Activation → Dashboard continuity)  
**Status:** Ready for review — **not pushed**

---

## Summary

The public customer journey has been restyled to match RC1 application workspaces using the shared `--lt-*` design tokens, `PublicFunnelShell`, and RC1 UI primitives. **No backend APIs, business logic, conversion flows, or form behavior were changed.**

Application workspaces remain **frozen** (Discovery, Saved Leads, Outreach, Mailboxes, Insights, Affiliate, Billing, Settings, Admin).

---

## Pages Modernized

| Page | Route | Priority | Status |
|------|-------|----------|--------|
| Free Trial | `/freetrial` | P0 | ✅ RC1 restyle complete |
| Landing | `/` | P1 | ✅ Token-aligned wrapper + marketing theme bridge |
| Checkout | `/checkout` | P1 | ✅ RC1 restyle complete |
| Checkout Success | `/checkout/success` | P1 | ✅ RC1 restyle complete |
| Payment Success | `/payment-success` | P1 | ✅ RC1 restyle complete |
| Activate | `/activate` | P1 | ✅ RC1 restyle complete |
| About | `/about` | P2 | ✅ RC1 restyle complete |
| Blog index | `/blog` | P2 | ✅ RC1 nav + components restyle |

---

## New Shared Components

| Component | Path | Purpose |
|-----------|------|---------|
| `PublicFunnelShell` | `frontend/components/public/public-funnel-shell.tsx` | Sticky header, CTA, main, footer for funnel pages |
| `PublicFunnelNav` | same file | Blog/about-style navigation |
| `PublicContentShell` | `frontend/components/public/public-content-shell.tsx` | Nav + content + footer layout |
| `PublicPageFooter` | `frontend/components/public/public-page-footer.tsx` | Shared legal/footer links |
| `PublicSuccessCard` | `frontend/components/public/public-success-card.tsx` | Payment/activation success states |
| `CheckoutTierOnePanel` / `CheckoutTierTwoPanel` | `frontend/components/public/checkout-value-list.tsx` | Checkout value lists |
| Trial UI primitives | `frontend/components/public/freetrial/trial-ui.tsx` | Trial results, paywall, locked contacts |

---

## Component Reuse Report

| RC1 Component | Used On |
|---------------|---------|
| `Panel` / `PanelContent` | Free Trial, Checkout, Activate, Success pages, About, Blog CTA |
| `Button` | All modernized pages |
| `Input` | Free Trial, Checkout, Activate |
| `Alert` / `AlertDescription` | Free Trial, Checkout, Activate |
| `Chip` | About, Blog categories badge |
| `StatusBadge` | Free Trial locked contacts |
| `EmptyState` | Blog empty posts |
| `Skeleton` | Free Trial bootstrap, Checkout success fallback |
| `--lt-*` tokens | All modernized pages |
| `PaywallValueRow` | Free Trial paywall, Checkout tiers |

**Marketing landing sections** continue using existing homepage section components; `theme.ts` now maps to `--lt-*` CSS variables for visual continuity without rewriting section markup.

---

## Free Trial — Functional Preservation Checklist

All preserved exactly as before:

- ✅ Email gate before search
- ✅ 2-search trial limit
- ✅ Search workflow + validation + polling
- ✅ Partial results (15 leads cap)
- ✅ Blurred emails + locked contacts
- ✅ Fixed bottom paywall panel
- ✅ Desktop table + mobile cards
- ✅ Existing trial APIs (`/trial/*`)
- ✅ Example pills + search hints
- ✅ Locked Send/Export CTAs

---

## Checkout / Activate — Functional Preservation

- ✅ Paystack (Nigeria) routing via `detectCountry()`
- ✅ Flutterwave (international) modal flow
- ✅ `/checkout/initialize` and `/checkout/verify` APIs unchanged
- ✅ License activation via `activateLicense()` unchanged
- ✅ Device registration + URL key prefill unchanged
- ✅ Pricing constants (`SALE_PRICE_USD`) unchanged

---

## Screenshots

Captured locally against `http://localhost:3010`:

```
docs/product-v2/public-journey-screenshots/
├── desktop/
├── tablet/
└── mobile/
```

| Page | Desktop | Tablet | Mobile |
|------|---------|--------|--------|
| Landing | `landing-desktop.png` | `landing-tablet.png` | `landing-mobile.png` |
| Free Trial (gate) | `freetrial-gate-desktop.png` | `freetrial-gate-tablet.png` | `freetrial-gate-mobile.png` |
| Checkout | `checkout-*.png` | same | same |
| Checkout Success | `checkout-success-*.png` | same | same |
| Payment Success | `payment-success-*.png` | same | same |
| Checkout Success | `checkout-success-*.png` | same | same |
| Payment Success | `payment-success-*.png` | same | same |
| Activate | `activate-*.png` | same | same |
| About | `about-desktop.png` | `about-tablet.png` | `about-mobile.png` |
| Blog | `blog-desktop.png` | `blog-tablet.png` | `blog-mobile.png` |

---

## Untouched Backend Functionality

No backend files were modified. The following remain frozen:

- Trial endpoints (`POST /trial/gate`, `/trial/search`, SSE stream, status)
- Checkout (`POST /checkout/initialize`, `POST /checkout/verify`)
- Paystack + Flutterwave webhook handlers
- License activation + device registration
- Blog CMS public API (`/public/blog/posts`)
- Search, licensing, outreach, billing APIs
- All database migrations and RLS policies

---

## Unsupported Backend Improvements (Honest List)

These would require backend or product changes and were **intentionally not attempted**:

| Improvement | Why Not Supported (UI-only scope) |
|-------------|-----------------------------------|
| Unified auth session from trial email → checkout | Requires backend session/licensing bridge |
| Pre-fill checkout email from trial gate | Could be frontend-only localStorage read — deferred to avoid conversion logic changes |
| Real-time paywall lead count from API | Trial cap is frontend-display constant (15); backend returns partial set |
| Blog dark-mode article view | Article template not in scope; index restyled only |
| Landing section-by-section RC1 Panel rewrite | Would be large markup churn; token bridge chosen instead |
| Payment success auto-verify | Page is static confirmation; verify lives on `/checkout/success` |
| A/B test hooks on paywall | Conversion instrumentation unchanged |
| SSR trial state hydration | Existing client bootstrap preserved |

---

## Quality Notes

- **Accessibility:** RC1 focus rings, semantic alerts, `aria-live` on paywall, labeled form inputs
- **Performance:** No new API calls; presentational extractions only
- **Loading states:** Skeleton on trial bootstrap + checkout success suspense
- **Error states:** Alert component on gate, checkout, activate
- **Empty states:** Blog `EmptyState` when no posts
- **Responsive:** Tailwind breakpoints (`md:`, `sm:`) on all updated pages

---

## Files Changed (Frontend Only)

```
frontend/app/freetrial/page.tsx
frontend/app/checkout/page.tsx
frontend/app/checkout/success/page.tsx
frontend/app/payment-success/page.tsx
frontend/app/activate/page.tsx
frontend/app/about/page.tsx
frontend/app/blog/page.tsx
frontend/app/(marketing)/page.tsx
frontend/components/marketing/homepage/theme.ts
frontend/components/public/public-funnel-shell.tsx
frontend/components/public/public-content-shell.tsx
frontend/components/public/public-page-footer.tsx
frontend/components/public/public-success-card.tsx
frontend/components/public/checkout-value-list.tsx
frontend/components/public/freetrial/trial-ui.tsx
docs/product-v2/21-public-journey-milestone.md
docs/product-v2/public-journey-screenshots/**
```

---

## Review Checklist

- [ ] Free Trial: complete email gate → search → locked results → paywall flow
- [ ] Checkout: NG routes to Paystack, non-NG opens Flutterwave
- [ ] Activate: license login reaches dashboard
- [ ] Visual continuity: public pages feel like same product as Discovery
- [ ] No regressions in frozen application workspaces

**Do not push until approved.**
