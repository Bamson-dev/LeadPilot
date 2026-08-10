# LeadThur UI / Product Inventory (Redesign Blueprint)

**Purpose:** Complete UX and product inventory so another team can redesign LeadThur **without opening the source code**.  
**Method:** Read-only inspection of `/Users/donbamz/LeadRush/frontend` (+ email/services for lifecycle).  
**App code modified:** None.  
**Date of capture:** Screenshots from production `https://www.leadthur.com` (desktop 1440×900, mobile 390×844).

---

## Document index

| File | Contents |
|------|----------|
| [01-screen-inventory.md](./01-screen-inventory.md) | Every screen, modal, admin section |
| [02-component-inventory.md](./02-component-inventory.md) | Reusable UI components |
| [03-user-flows.md](./03-user-flows.md) | End-to-end flows + Mermaid |
| [04-navigation.md](./04-navigation.md) | Nav, footer, redirects, protection |
| [05-design-audit.md](./05-design-audit.md) | Visual / UX scores |
| [06-admin-inventory.md](./06-admin-inventory.md) | Admin SPA sections |
| [07-api-to-screen-map.md](./07-api-to-screen-map.md) | APIs per screen |
| [08-database-to-ui-map.md](./08-database-to-ui-map.md) | Tables → UI fields |
| [09-feature-matrix.md](./09-feature-matrix.md) | Feature status matrix |
| [10-assets.md](./10-assets.md) | Logos, images, fonts, video |
| [11-email-templates.md](./11-email-templates.md) | All system emails |
| [12-implementation-notes.md](./12-implementation-notes.md) | Architecture constraints for redesign |
| [screenshots/](./screenshots/) | Desktop + mobile PNGs |

Related deeper engineering doc (optional): `docs/LEADTHUR_COMPLETE_INTERNAL_DOCUMENTATION.md`

---

## Totals

| Metric | Count |
|--------|-------|
| Route pages | 22 |
| Admin SPA sections (incl. login) | 16 |
| Non-route overlays / modals / panels | 8 |
| **Total screens inventoried** | **46** |
| Reusable component files (components + features) | ~80 |
| Unused / orphan components | 4 |
| Drawers / Sheets | **0 (Not Found)** |
| Wizards | 2 (onboarding; mailbox connect) |
| Primary user flows documented | 10 |
| Public screenshot pairs captured | 15 routes × 2 = **30 PNGs** |
| Dialogs (product) | Onboarding, SearchLimit, WhatsApp, Flutterwave, admin confirms; Radix Dialog only on unused ExportModal |
| Forms (major) | Activate, checkout, trial gate, search, top-up, plans, mailbox, admin ops, blog, messaging |
| Admin pages (logical) | 16 sections on one URL |
| API route groups touching UI | ~15 mounts (auth, trial, search, checkout, topup, outreach, admin, public, affiliate, …) |
| DB tables appearing in UI | ~20 (see 08) |

---

## Screenshots

Saved under `docs/ui-audit/screenshots/`:

| Route | Desktop | Mobile | Notes |
|-------|---------|--------|-------|
| `/` | home-desktop.png | home-mobile.png | |
| `/about` | about-*.png | | |
| `/freetrial` | freetrial-*.png | | Email gate / trial UI |
| `/checkout` | checkout-*.png | | |
| `/activate` | activate-*.png | | |
| `/blog` | blog-*.png | | |
| `/privacy` | privacy-*.png | | |
| `/terms` | terms-*.png | | |
| `/payment-success` | payment-success-*.png | | |
| `/checkout/success` | checkout-success-*.png | | |
| `/dashboard` | dashboard-*.png | | **Redirected to `/activate`** (no license) |
| `/dashboard/plans` | dashboard-plans-*.png | | Loaded without license redirect |
| `/admin` | admin-*.png | | Login gate if logged out |
| `/suspended` | suspended-*.png | | |
| `/demo` | demo-*.png | | May show not-found in prod |

**Not captured (auth or dynamic):** full logged-in dashboard, onboarding modal, WhatsApp modal, send panel, blog slug articles, `/demo-recording`, admin logged-in sections. Marked **Not Found** / note in screen inventory.

---

## Biggest UX problems

1. **Cognitive overload on `/dashboard`** — search, results, CRM, WhatsApp, outreach, affiliate, top-up compete in one surface.  
2. **License-key “login”** — unusual mental model vs email/password SaaS.  
3. **Trial UI ≠ paid UI** — two different results systems and paywall patterns.  
4. **No product IA (sidebar)** — tabs buried inside outreach workspace only.  
5. **Inconsistent chrome** — dual Nav/Footer/Logo/fonts (marketing vs app).  
6. **Plans page weakly gated** — `/dashboard/plans` lacks the same client redirect as `/dashboard`.  
7. **Admin is an endless scroll** — no section nav; destructive `window.confirm`.  
8. **Always-dark purple aesthetic** — limited flexibility; accessibility unverified.

---

## Biggest technical risks (affect redesign)

1. Client-only auth gates (localStorage) — UI can show pages APIs reject.  
2. Search is long-running scrape — redesign must keep async progress/SSE model.  
3. Admin site-scripts = full XSS power.  
4. Outreach depends on Gmail app passwords — high setup friction.  
5. Follow-up engine exists in DB/backend with weak first-class UI.

---

## Biggest design opportunities

1. True app shell: Search | Leads | Outreach | Billing | Affiliate | Account.  
2. Unified results component for trial + paid (progressive unlock).  
3. Business detail drawer/page (today: row only).  
4. Onboarding that ends in first successful search, not four tips.  
5. One payment/billing hub (lifetime vs search credits vs outreach).  
6. Design system (type, color, button, modal, drawer, table, form).

---

## Most important screens

1. `/` Marketing home  
2. `/freetrial`  
3. `/checkout`  
4. `/activate`  
5. `/dashboard` (search + results)  
6. Outreach send panel  
7. `/dashboard/plans`  
8. Admin Account Lookup  

## Least important screens

1. `/payment-success` (legacy)  
2. `/get-access`, `/start` (redirects)  
3. `/demo`, `/demo-recording`  
4. Orphan ExportModal  
5. Blog category/tag redirect routes  

---

## Redesign priority

### Phase 1 — Foundations (Critical)

- Design system tokens (type, color, spacing, components)  
- App shell + navigation IA  
- Unify marketing/app brand chrome  
- Redesign Activate + Checkout + Trial conversion path  
- Protect Plans like Dashboard  

### Phase 2 — Core product (High)

- Split Dashboard into Search / Results / Outreach spaces  
- Shared results table/cards + business detail pattern  
- Formal Drawer for compose; Modal system for confirms  
- Onboarding → first search success metric  
- Billing hub (credits + outreach)  

### Phase 3 — Growth & ops (Medium)

- Affiliate as proper page  
- Admin sidebar + safer confirms + script sandboxing  
- Blog visual refresh  
- Email template redesign aligned with product CTAs  

### Phase 4 — Differentiation (Lower)

- Follow-up campaign manager UI  
- Light mode (optional)  
- Password/session auth (product + eng)  
- Remove orphans / legacy routes  

---

## How a designer should work from this pack

1. Read **01** + **03** + **05** first.  
2. Open **screenshots/** for visual baseline.  
3. Use **09** to know what must remain vs cut.  
4. Use **11** for lifecycle email redesign.  
5. Use **12** so mocks respect auth, SSE search, and hosting constraints.  
6. Do **not** invent sidebar/detail pages as “existing” — they are **Not Found** today unless Phase 2 adds them.

---

*End of UI audit README.*
