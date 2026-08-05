# LeadThur V2 — Milestone Report  
## RC1 Affiliate Workspace

**Branch:** `staging`  
**Date:** 2026-08-05  
**Route:** `/dashboard/affiliate`  
**Deep link:** `?view=affiliate` → `/dashboard/affiliate`

---

## Summary

First-class Affiliate workspace using only existing `/affiliate/*` APIs. RC1 AppShell + panels + status badges. Discovery’s embedded `AffiliateSection` is **unchanged** (no Discovery redesign). No projections, leaderboards, charts, or fake payout history.

---

## Components completed

| Component | Path |
|-----------|------|
| AffiliatePageWorkspace | `frontend/components/affiliate/affiliate-page-workspace.tsx` |
| Affiliate page | `frontend/app/dashboard/affiliate/page.tsx` |
| Affiliate API client | `frontend/services/affiliate-api.ts` |
| Shared types | `frontend/types/affiliate.ts` |

### Nav
- Sidebar **Affiliate** → `/dashboard/affiliate`
- Top-nav gift icon → `/dashboard/affiliate`
- `?view=affiliate` redirect

### Reused
`AppShell`, `DiscoveryWorkspaceHeader`, `Panel`, `Alert`, `EmptyState`, `Button`, `StatusBadge`, `Skeleton`, pricing constants, existing affiliate business rules (resolve at 10 digits, min payout, share copy).

---

## Backend mapping

| UI | API |
|----|-----|
| Referral overview KPIs | `GET /affiliate/stats` |
| Referral link + share | `referralLink`, `refCode` |
| Earnings summary | earned / pending / `totalPaidNgn` |
| Referral table | `stats.commissions` (masked email) |
| Bank setup | `GET /banks`, `POST /resolve-account`, `POST /bank-details` |
| Request payout | `POST /request-payout` when `canRequestPayout` |
| Withdrawal history | **Honest empty** — no user payout-history endpoint |

---

## Unsupported backend features (omitted)

- User payout / withdrawal request history (`GET /affiliate/payouts` does not exist)
- Saved bank details on stats response
- Commission projections / forecasts
- Leaderboards / rankings
- Charts / time-series
- Click → trial → paid funnel analytics
- Auto Paystack transfer status for affiliates (admin-only payout flow)

---

## Accessibility & responsive

- Landmark header; labeled KPI region
- Form labels for bank + account
- Desktop table + mobile card list for referrals
- KPI grid 1 → 2 → 4 columns

---

## QA screenshots

Place under `docs/product-v2/screenshots/affiliate-*.png` after a licensed session (staging SSO / local activate). Capture: empty referrals, stats loaded, bank form resolved, payout CTA when eligible.

---

## Next

1. ~~Insights~~  
2. ~~Affiliate~~  
3. **Billing**  
4. Settings  
5. Admin  
