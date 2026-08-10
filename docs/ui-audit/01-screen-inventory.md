# LeadThur UI Audit — Screen Inventory

**Source:** `/Users/donbamz/LeadRush/frontend` (read-only)  
**Screenshots:** `docs/ui-audit/screenshots/`  
**Drawers / Sheets:** Not Found  
**Next.js middleware.ts:** Not Found (gates are client-side)

---

## How to use this file

Each entry is one designer-facing screen: a route page, an admin SPA section, or a modal overlay. Screenshots for auth-gated product states show the gate page that production redirects to when no license is stored.

---

## 1. Marketing Home

| Field | Detail |
|-------|--------|
| **Screen Name** | Marketing Home |
| **URL** | `/` |
| **Purpose** | Public landing: problem → product → social proof → pricing → CTA |
| **User Type** | Guest |
| **Navigation Path** | Direct / marketing Nav / Footer |
| **Screenshot** | `screenshots/home-desktop.png`, `screenshots/home-mobile.png` |
| **Files Used** | `frontend/app/(marketing)/page.tsx`, `frontend/app/(marketing)/layout.tsx` |
| **React Components** | AnnouncementBar, Nav, Hero, StatsBar, ProblemAgitationSection, FreeTrialInviteSection, EmailSenderSection, DemoVideoSection, UserTestimonialsSection, TrustpilotSection, HowItWorksSection, DifferenceSection, FeatureGridSection, PricingSection, GuaranteeSection, WhoIsForSection, FAQSection, FinalCTASection, Footer |
| **Hooks** | Not Found (composition only) |
| **API Endpoints** | `GET /public/site-scripts` (via root layout) |
| **Database Tables** | `site_settings` (scripts), `blog_posts` (indirect via site) |
| **Primary CTA** | `Get My Client List Now` / `Claim My Lifetime Access` → `#offer` or `/checkout` |
| **Secondary CTA** | `Try Free` → `/freetrial`; `Login` → `/activate` |
| **Forms** | Not Found |
| **Filters** | Not Found |
| **Tables** | Not Found |
| **Cards** | Feature / pricing / testimonial cards |
| **Charts** | Not Found |
| **Dialogs** | Not Found |
| **Drawers** | Not Found |
| **Tabs** | Not Found |
| **Dropdowns** | Not Found |
| **Tooltips** | Not Found |
| **Loading States** | Not Found (static) |
| **Empty States** | Not Found |
| **Error States** | Not Found |
| **Success States** | Not Found |
| **Responsive Behaviour** | Clamp typography; full-width CTAs; TAP_TARGET ≥48px |
| **Accessibility Issues** | Dark marketing site; FAQ accordion — keyboard details not verified in audit |
| **Current UX Problems** | Long single-page scroll; multiple competing CTAs; scarcity copy vs product reality |
| **Suggested Priority** | Critical (acquisition surface) |

---

## 2. Free Trial

| Field | Detail |
|-------|--------|
| **Screen Name** | Free Trial Search |
| **URL** | `/freetrial` |
| **Purpose** | Email-gated 2 free searches; blurred emails; convert to lifetime |
| **User Type** | Guest → Trial |
| **Navigation Path** | Marketing “Try Free” / Final CTA / Blog CTAs |
| **Screenshot** | `screenshots/freetrial-desktop.png`, `screenshots/freetrial-mobile.png` |
| **Files Used** | `frontend/app/freetrial/page.tsx`, `frontend/app/freetrial/layout.tsx` |
| **React Components** | Inline: PaywallValueRow, TrialPhoneValue, LockedContactValue, StarRating, TrialSearchGuidance, TrialExamplePills, TrialSearchHint, LeadRowMobile |
| **Hooks** | useState, useEffect, useCallback, useMemo, useRef |
| **API Endpoints** | `GET /trial/status`, `POST /trial/signup`, `POST /freetrial`, `GET /search/results/:id?trialEmail=` |
| **Database Tables** | `free_trial_signups`, `free_trial_ip_usage`, `search_jobs`, `business_leads` |
| **Primary CTA** | `Start My 2 Free Searches` → `Run free search` → `Get lifetime access for $X` |
| **Secondary CTA** | `Get Full Access`; `Start fresh with a different email` |
| **Forms** | Email gate; business type + location search |
| **Filters** | Not Found (trial shows capped rows) |
| **Tables** | Desktop results grid; mobile cards |
| **Cards** | Mobile lead cards; paywall value rows |
| **Charts** | Not Found |
| **Dialogs** | Not Found (fixed bottom paywall panel) |
| **Drawers** | Not Found |
| **Tabs** | Not Found |
| **Dropdowns** | Not Found |
| **Tooltips** | Not Found |
| **Loading States** | `Loading your free trial...`; `Searching...` |
| **Empty States** | Invalid search guidance / example pills |
| **Error States** | Gate/search validation messages; IP/email limit |
| **Success States** | Partial results with blurred fields |
| **Responsive Behaviour** | `md:hidden` cards / `hidden md:block` table; fixed bottom paywall |
| **Accessibility Issues** | Blurred/locked content may confuse screen readers |
| **Current UX Problems** | Paywall aggressive; emails blurred; separate from paid dashboard UX |
| **Suggested Priority** | Critical |

---

## 3. Checkout (Lifetime)

| Field | Detail |
|-------|--------|
| **Screen Name** | Lifetime Checkout |
| **URL** | `/checkout` |
| **Purpose** | Collect email; Paystack (NG) or Flutterwave (elsewhere) |
| **User Type** | Guest |
| **Navigation Path** | Pricing CTAs / `/get-access` / `/start` redirects |
| **Screenshot** | `screenshots/checkout-desktop.png`, `screenshots/checkout-mobile.png` |
| **Files Used** | `frontend/app/checkout/page.tsx`, `layout.tsx` |
| **React Components** | Inline card UI; Flutterwave SDK modal |
| **Hooks** | useState, useEffect, useMemo, useFlutterwave |
| **API Endpoints** | `POST /checkout/initialize`; Flutterwave client-side |
| **Database Tables** | Creates `license_keys` after webhook (not on screen) |
| **Primary CTA** | `Claim My Lifetime Access - $X` |
| **Secondary CTA** | Not Found |
| **Forms** | Email |
| **Filters / Tables / Cards / Charts** | Single checkout card |
| **Dialogs** | Flutterwave payment overlay (third-party) |
| **Drawers / Tabs / Dropdowns / Tooltips** | Not Found |
| **Loading States** | `Detecting your location...`; `Opening payment...` |
| **Empty / Error / Success** | Invalid email; payment failed; success redirects |
| **Responsive Behaviour** | Centered max-width ~480; 48px tap targets |
| **Accessibility Issues** | Third-party modal a11y depends on Flutterwave |
| **Current UX Problems** | Dual gateways by country may confuse; sparse trust UI on page |
| **Suggested Priority** | Critical |

---

## 4. Checkout Success

| Field | Detail |
|-------|--------|
| **Screen Name** | Checkout Success |
| **URL** | `/checkout/success` |
| **Purpose** | Verify lifetime payment or outreach Paystack return |
| **User Type** | Guest (post-pay); Paid (outreach return) |
| **Navigation Path** | Payment gateway return URL |
| **Screenshot** | `screenshots/checkout-success-desktop.png`, `screenshots/checkout-success-mobile.png` |
| **Files Used** | `frontend/app/checkout/success/page.tsx` |
| **React Components** | Inline; Suspense |
| **Hooks** | useSearchParams, useState, useEffect |
| **API Endpoints** | `POST /checkout/verify`; `fetchOutreachBalance()` |
| **Database Tables** | `license_keys`, `outreach_accounts` (via verify) |
| **Primary CTA** | `Activate My Account →` or `Back to Outreach Billing →` |
| **Secondary CTA** | `Back to leadthur.com` / `Back to dashboard` |
| **Forms / Filters / Tables** | Not Found |
| **Dialogs / Drawers** | Not Found |
| **Loading / Error / Success** | Loading / ok / warn texts for license or balance |
| **Responsive Behaviour** | Centered card |
| **Current UX Problems** | Dual success paths (lifetime vs outreach) on one URL |
| **Suggested Priority** | High |

---

## 5. Payment Success (Legacy)

| Field | Detail |
|-------|--------|
| **Screen Name** | Payment Success (static) |
| **URL** | `/payment-success` |
| **Purpose** | Simple “check email” confirmation |
| **User Type** | Guest |
| **Screenshot** | `screenshots/payment-success-desktop.png`, `screenshots/payment-success-mobile.png` |
| **Files Used** | `frontend/app/payment-success/page.tsx` |
| **API Endpoints** | Not Found |
| **Primary CTA** | Not Found (WhatsApp number in copy) |
| **Current UX Problems** | Overlaps `/checkout/success`; likely legacy |
| **Suggested Priority** | Low |

---

## 6. Activate / Login

| Field | Detail |
|-------|--------|
| **Screen Name** | Activate (License Login) |
| **URL** | `/activate` |
| **Purpose** | Email + license key → store credentials → dashboard |
| **User Type** | Guest → Paid |
| **Navigation Path** | Nav Login; post-purchase email; dashboard gate redirect |
| **Screenshot** | `screenshots/activate-desktop.png`, `screenshots/activate-mobile.png` |
| **Files Used** | `frontend/app/activate/page.tsx`, `layout.tsx` |
| **React Components** | Inline form |
| **Hooks** | useRouter, useSearchParams, useState, useEffect |
| **API Endpoints** | `POST /auth/activate` via `activateLicense()` |
| **Database Tables** | `license_keys` (device slots) |
| **Primary CTA** | `Log in` / `Signing in…` |
| **Secondary CTA** | Not Found |
| **Forms** | Email, License key (`?key=` prefill) |
| **Loading / Error / Success** | Signing in; max_devices error; failure alert; redirect |
| **Responsive Behaviour** | `max-w-md` centered |
| **Current UX Problems** | “Login” is license-key activation — unusual mental model |
| **Suggested Priority** | Critical |

---

## 7. Dashboard (Paid Product)

| Field | Detail |
|-------|--------|
| **Screen Name** | Dashboard — Search & Outreach |
| **URL** | `/dashboard` |
| **Purpose** | Core product: search, results, export, WhatsApp AI, email outreach, affiliate |
| **User Type** | Paid (license). Suspended → `/suspended`. Demo `?demo=recording` bypasses license. |
| **Navigation Path** | Activate success; Navbar Dashboard CTA |
| **Screenshot** | `screenshots/dashboard-desktop.png`, `screenshots/dashboard-mobile.png` *(production redirect → `/activate` without license; captures gate)* |
| **Files Used** | `app/dashboard/page.tsx`, `dashboard-gate.tsx`, `dashboard-router.tsx`, `search-dashboard.tsx` |
| **React Components** | SearchUpgradeBanner, AffiliateSection, WelcomeState, OutreachWorkspace, ResultsTable, DashboardHistorySections, OnboardingModal, SearchLimitModal, WhatsappTemplateModal, Navbar, Footer |
| **Hooks** | useSearch, useOutreach, useLeadStatuses, useIsMobile |
| **API Endpoints** | `GET /auth/status`; search start/poll/stream; usage; suggestions; activity; outreach balance/mailboxes/send; WhatsApp templates; AI message; affiliate stats |
| **Database Tables** | `license_keys`, `search_jobs`, `business_leads`, `search_history`, `user_searches`, `lead_statuses`, `whatsapp_templates`, `ai_message_log`, outreach tables, `commissions` |
| **Primary CTA** | `Search`; `Download N Leads`; `Send email (N)` |
| **Secondary CTA** | Clear Results; Top Up; Try Again; city chips; Affiliate copy link |
| **Forms** | Business type + location |
| **Filters** | Rating filter; lead status filter |
| **Tables** | ResultsTable (virtualized); mobile MobileLeadCard |
| **Cards** | Queue card; welcome examples; mailbox cards |
| **Charts** | Not Found |
| **Dialogs** | OnboardingModal, SearchLimitModal, WhatsappTemplateModal |
| **Drawers** | Not Found (OutreachSendPanel is fixed slide-over) |
| **Tabs** | Results / Sends report / Mailboxes |
| **Dropdowns** | Lead status select |
| **Tooltips** | Not Found (contact dots may imply status) |
| **Loading States** | Searching progress; queue position; stream leads |
| **Empty States** | WelcomeState examples; `No potential clients…` |
| **Error States** | Search failed; limit reached; top-up errors |
| **Success States** | Search complete; top-up success banner; send success banner |
| **Responsive Behaviour** | useIsMobile; mobile cards; full-width actions; send panel fullscreen mobile |
| **Accessibility Issues** | Dense UI; heavy table; modal focus traps depend on Radix Dialog usage |
| **Current UX Problems** | Single page does search + CRM + outreach + affiliate; cognitive overload |
| **Suggested Priority** | Critical |

---

## 8. Search Result by ID

| Field | Detail |
|-------|--------|
| **Screen Name** | Persisted Search Results |
| **URL** | `/dashboard/search/[searchId]` |
| **Purpose** | Reopen a past search with outreach tooling |
| **User Type** | Paid |
| **Screenshot** | Not Found as dedicated capture (auth). Behavior same as dashboard results subset. |
| **Files Used** | `app/dashboard/search/[searchId]/page.tsx`, `search-result-client.tsx` |
| **Components** | Navbar, Footer, OutreachWorkspace, ResultsTable, NearbyCityChips, ResultsActionsBar, DashboardHistorySections, WhatsappTemplateModal |
| **Hooks** | useParams, useRouter, useSearchJob, useOutreach, useLeadStatuses, useIsMobile |
| **API Endpoints** | `GET /search/:id`, results/stream; outreach APIs |
| **Primary CTA** | Same as dashboard results |
| **Suggested Priority** | High |

---

## 9. Outreach Plans / Billing

| Field | Detail |
|-------|--------|
| **Screen Name** | Outreach Plans |
| **URL** | `/dashboard/plans` |
| **Purpose** | Buy outreach subscription or credit packs (not search credits) |
| **User Type** | Intended Paid — **no page-level license redirect found** |
| **Screenshot** | `screenshots/dashboard-plans-desktop.png`, `screenshots/dashboard-plans-mobile.png` |
| **Files Used** | `frontend/app/dashboard/plans/page.tsx` |
| **Hooks** | useOutreach, useMemo, useState |
| **API Endpoints** | Outreach checkout initialize; `GET /balance/` |
| **Database Tables** | `outreach_accounts`, `outreach_paystack_plans`, credit transactions |
| **Primary CTA** | `Subscribe` / `Buy credits` |
| **Secondary CTA** | `Back to dashboard` |
| **Cards** | 3 subscription + 3 pack cards; balance stats |
| **Current UX Problems** | Missing hard auth gate; “plans” naming vs search top-ups confusion |
| **Suggested Priority** | High |

---

## 10. Admin Console (shell)

| Field | Detail |
|-------|--------|
| **Screen Name** | Admin Console |
| **URL** | `/admin` |
| **Purpose** | Ops: licenses, trials, payouts, messaging, blog, scripts |
| **User Type** | Admin |
| **Screenshot** | `screenshots/admin-desktop.png`, `screenshots/admin-mobile.png` (login gate if no token) |
| **Files Used** | `frontend/app/admin/page.tsx`, `components/admin/*` |
| **Primary CTA** | `Sign in` |
| **Suggested Priority** | High |

### Admin SPA sections (count as screens)

| # | Section | Purpose | Priority |
|---|---------|---------|----------|
| 10a | Admin Login | Email/password → JWT | Critical |
| 10b | Queue Status Bar | Live search queue metrics | Medium |
| 10c | Activation Tracker | Signup/activation chart | Medium |
| 10d | Global Scripts | head/body script injection | High (security-sensitive) |
| 10e | Overview KPIs | Stat cards | Medium |
| 10f | Recent Users | Last signups table | Medium |
| 10g | Affiliate Payouts | Processing / Mark Paid | High |
| 10h | Free Trial Activity | Collapsible trial KPIs | Medium |
| 10i | Trial Signups | Signup list | Medium |
| 10j | Email Performance | Sequence open rates | Medium |
| 10k | Trial Broadcast | One-off trial emails | Medium |
| 10l | Account Lookup | License manage actions | Critical |
| 10m | Direct Messaging | Single / broadcast HTML email | High |
| 10n | Blog Manager | CMS list + editor | High |
| 10o | Generate Access | Manual license grant | High |
| 10p | Recent Licenses | License inventory table | Medium |

---

## 11. Suspended

| Field | Detail |
|-------|--------|
| **Screen Name** | Suspended Account |
| **URL** | `/suspended` |
| **Purpose** | Blocked account holding; poll for restore |
| **User Type** | Paid (suspended) |
| **Screenshot** | `screenshots/suspended-desktop.png`, `screenshots/suspended-mobile.png` |
| **Primary CTA** | `Contact Support on WhatsApp` |
| **API** | `GET /auth/status` every 10s |
| **Suggested Priority** | Medium |

---

## 12. About

| Field | Detail |
|-------|--------|
| **URL** | `/about` |
| **User Type** | Guest |
| **Screenshot** | `screenshots/about-desktop.png`, `screenshots/about-mobile.png` |
| **Primary CTA** | `Try LeadThur Free →` |
| **Suggested Priority** | Low |

---

## 13. Privacy

| Field | Detail |
|-------|--------|
| **URL** | `/privacy` |
| **Screenshot** | `screenshots/privacy-desktop.png`, `screenshots/privacy-mobile.png` |
| **Suggested Priority** | Low |

---

## 14. Terms

| Field | Detail |
|-------|--------|
| **URL** | `/terms` |
| **Screenshot** | `screenshots/terms-desktop.png`, `screenshots/terms-mobile.png` |
| **Suggested Priority** | Low |

---

## 15. Blog Index

| Field | Detail |
|-------|--------|
| **URL** | `/blog` |
| **Screenshot** | `screenshots/blog-desktop.png`, `screenshots/blog-mobile.png` |
| **API** | `GET /public/blog/posts` |
| **Tables / Cards** | Post card grid; category pills |
| **Suggested Priority** | Medium |

---

## 16. Blog Post

| Field | Detail |
|-------|--------|
| **URL** | `/blog/[slug]` |
| **Screenshot** | Not Found (slug-dependent; capture per article during redesign) |
| **Components** | blog-article-view, blog-post-card |
| **Suggested Priority** | Medium |

---

## 17–18. Blog Category / Tag Redirects

| URL | Behavior | Screenshot |
|-----|----------|------------|
| `/blog/category/[slug]` | → `/blog?category=` | Not Found (instant redirect) |
| `/blog/tag/[slug]` | → `/blog?tag=` | Not Found (instant redirect) |

**Suggested Priority:** Low

---

## 19–20. Redirect Stubs

| URL | Target | Screenshot |
|-----|--------|------------|
| `/get-access` | `/checkout` | Not Found (instant redirect) |
| `/start` | `/checkout` | Not Found (instant redirect) |

---

## 21. Demo

| Field | Detail |
|-------|--------|
| **URL** | `/demo` |
| **Access** | Staging / `DEMO_MODE` / development; else “Page not found.” |
| **Screenshot** | `screenshots/demo-desktop.png`, `screenshots/demo-mobile.png` |
| **Suggested Priority** | Low (sales tooling) |

---

## 22. Demo Recording

| Field | Detail |
|-------|--------|
| **URL** | `/demo-recording` |
| **Purpose** | Auto-play dashboard mock for recordings |
| **Component** | DemoRecordingDashboard |
| **Screenshot** | Not Found (not captured in this run) |
| **Suggested Priority** | Low |

---

## Non-route overlays (count as screens)

### Onboarding Modal

| Field | Detail |
|-------|--------|
| **Name** | OnboardingModal |
| **URL** | Overlay on `/dashboard` |
| **Purpose** | 4-step first-run: Welcome → business → city → watch results |
| **CTAs** | `Next →` / `Got it. Let me search →`; `Skip` |
| **Screenshot** | Not Found (requires paid session + first visit) |
| **File** | `components/dashboard/onboarding-modal.tsx` |
| **Priority** | High |

### Search Limit / Top-up Modal

| Field | Detail |
|-------|--------|
| **Name** | SearchLimitModal |
| **Purpose** | Sell search credit packs when limit hit |
| **CTAs** | Per-tier `Top Up Now` |
| **API** | `/topup/initialize`, `/topup/initialize-flw` |
| **Screenshot** | Not Found (requires paid limit state) |
| **Priority** | High |

### WhatsApp Template Modal

| Field | Detail |
|-------|--------|
| **Name** | WhatsappTemplateModal |
| **Purpose** | Niche templates + AI generate + open WhatsApp |
| **File** | `whatsapp-template-modal.tsx` |
| **Screenshot** | Not Found (requires results + click) |
| **Priority** | High |

### Outreach Send Panel (slide-over)

| Field | Detail |
|-------|--------|
| **Name** | OutreachSendPanel |
| **Purpose** | Compose AI/template email; queue send |
| **Not** | Dialog / Drawer (fixed panel; full-screen mobile) |
| **Screenshot** | Not Found (requires selection) |
| **Priority** | Critical |

### Export Modal

| Field | Detail |
|-------|--------|
| **Name** | ExportModal |
| **Status** | **Unused / orphan** — CSV exports directly |
| **File** | `export-modal.tsx` |
| **Priority** | Low (remove or wire up) |

### Flutterwave Payment Overlay

| Field | Detail |
|-------|--------|
| **Name** | Flutterwave SDK modal |
| **Used on** | Checkout, SearchLimitModal |
| **Priority** | High |

### Admin confirm overlays

Trial broadcast confirm modal; `window.confirm` for payouts, delete blog, broadcast; Account Lookup inline Confirm Suspend / Reset.

---

## Totals

| Metric | Count |
|--------|-------|
| Route pages (`page.tsx`) | 22 |
| Admin SPA sections (incl. login) | 16 |
| Non-route modals / overlays (incl. orphan ExportModal) | 8 |
| **Total inventoried screens** | **46** |
| Drawers / Sheets | 0 (Not Found) |
| Wizards | 2 (Onboarding 4-step; Guided mailbox connect) |
| Desktop+mobile screenshot pairs captured | 15 routes (30 PNGs) |

### Screenshot notes

- `/dashboard` without license redirects to `/activate` — screenshots show activate gate.
- `/dashboard/plans` loaded without redirect (auth gap).
- Auth-only states (full dashboard, onboarding, WhatsApp modal, send panel): screenshot Not Found in this capture set.
