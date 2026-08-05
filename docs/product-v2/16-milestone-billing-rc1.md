# LeadThur V2 — Milestone Report  
## RC1 Billing Workspace

**Branch:** `staging`  
**Date:** 2026-08-05  
**Route:** `/dashboard/plans` (Account/Billing hub — existing links preserved)  
**Nav label:** Billing (was Account)

---

## Summary

Billing is a UI modernization of the existing plans surface into AppShell + RC1 panels. It unifies **Discovery search credits** (`GET /auth/usage` + existing `SearchLimitModal` top-up) with **Outreach subscriptions/packs** (same `GET /balance` + `POST /checkout` flows as before). No payment, webhook, pricing, or fulfillment logic was changed.

---

## Components completed

| Component | Path |
|-----------|------|
| BillingPageWorkspace | `frontend/components/billing/billing-page-workspace.tsx` |
| Plans page (AppShell wrap) | `frontend/app/dashboard/plans/page.tsx` |

### Reused without inventing
- `SearchLimitModal` for search credit purchase (Paystack NG / Flutterwave else)
- `initializeOutreachSubscriptionCheckout` / `initializeOutreachPackCheckout`
- `fetchOutreachBalance`, `useOutreach`, `getLicenseUsage`
- Same tier/pack NGN amounts and plan-switch block as previous plans page
- `localStorage.leadthur_outreach_checkout` pending checkout blob

### Nav
- Sidebar **Billing** → `/dashboard/plans`
- Mobile bottom tab **Billing** → `/dashboard/plans`
- Credits / Settings gear still land on `/dashboard/plans`

Frozen Discovery / Saved / Outreach / Mailboxes / Insights / Affiliate were not redesigned.

---

## Backend mapping

| UI | Existing capability |
|----|---------------------|
| Search credits / usage | `GET /auth/usage` |
| Purchase search credits | Existing top-up via `SearchLimitModal` → `/topup/initialize` / `initialize-flw` |
| Outreach send balance / plan status | `GET /balance` |
| Subscribe / current plan CTAs | `POST /checkout` `{ type: "subscription", tier }` |
| Buy outreach packs | `POST /checkout` `{ type: "pack", pack_id }` |
| Upgrade/downgrade while another tier active | **Blocked in UI** (unchanged) — no API |
| Cancel subscription | **Not supported** — webhook lifecycle only |
| Billing history / invoices / receipts | **No user API** — honest empty |
| Payment methods vault | **No user API** — honest empty |
| Transactions | **No user API** — honest empty |

---

## Unsupported backend capabilities (omitted)

- In-app invoices / downloadable receipts  
- Payment / purchase history lists  
- Payment method management  
- User-initiated cancel subscription  
- Upgrade / downgrade API (switch blocked while active)  
- Coupons / tax / forecasts / billing analytics  
- Flutterwave for outreach (Paystack only)  
- Unified search+outreach wallet  

---

## Accessibility & responsive

- AppShell + license gate  
- KPI grid 1→2→4; subscription/pack cards stack on mobile  
- Progress labeled for monthly free searches  
- Honest `EmptyState` / `Alert` copy  

---

## QA screenshots

Capture under `docs/product-v2/screenshots/billing-*.png` after license session: usage KPIs, top-up modal, outreach tiers, blocked switch message, empty history panels.

---

## Next

1. ~~Insights~~ 2. ~~Affiliate~~ 3. ~~Billing~~  
4. **Settings**  
5. Admin  
