# LeadThur UI Audit — Component Inventory

**Source:** `frontend/components/**`, `frontend/features/**`  
**Rule:** Based on imports found in the repo. Orphans noted.

---

## Primitives (`components/ui/`)

| Component | Purpose | Props / Variants | Used On | A11y | Problems |
|-----------|---------|------------------|---------|------|----------|
| Button | Primary actions | `variant`, `size` (CVA) | Dashboard, outreach, navbar | Depends on Radix/slot | Fine |
| Dialog | Modal shell (Radix) | DialogContent/Header/Title/Description | export-modal only | Radix focus trap | Underused |
| Input | Text field | standard | Outreach, demo-recording | Native | Fine |
| Progress | Progress bar | standard | search-dashboard, demo-recording | Limited | Fine |

---

## App shell

| Component | Purpose | Props | Used On | Problems |
|-----------|---------|-------|---------|----------|
| navbar | App top bar logo + Dashboard | none | dashboard-gate, search result page | Logo “LP” vs marketing “LT” inconsistency |
| footer | Legal links | none | dashboard-gate, search result page | Duplicate of marketing Footer |

---

## Marketing (`components/marketing/homepage/`)

| Component | Purpose | Used On | Problems |
|-----------|---------|---------|----------|
| theme.ts | Colors, FONT, route consts | All homepage sections | System font ≠ Inter in app layout |
| Nav | Sticky marketing nav | Marketing home | Duplicate of navbar |
| Footer | Marketing footer | Marketing home | No About link (app footer has About) |
| LeadThurLogo | LT badge logo | Nav, Footer | Third logo treatment vs `/logo.png` |
| AnnouncementBar | Top strip | Home | — |
| Hero | Hero | Home | — |
| StatsBar | Stats | Home | — |
| ProblemAgitationSection | Problem | Home | — |
| FreeTrialInviteSection | Trial CTA | Home | — |
| EmailSenderSection | Outreach pitch | Home | — |
| DemoVideoSection | YouTube embed | Home | External dependency |
| UserTestimonialsSection | Testimonials | Home | — |
| TrustpilotSection | Trustpilot images | Home | Static PNGs |
| HowItWorksSection | How it works | Home | — |
| DifferenceSection | Differentiation | Home | — |
| FeatureGridSection | Features | Home | — |
| WhoIsForSection | Audience | Home | — |
| PricingSection | Pricing | Home | — |
| GuaranteeSection | Guarantee | Home | — |
| FAQSection | FAQ accordion | Home | — |
| FinalCTASection | Closing CTA | Home | — |

**Props:** Marketing sections take no props (hardcoded copy).

---

## Dashboard core

| Component | Purpose | Key props | Used On | Problems |
|-----------|---------|-----------|---------|----------|
| dashboard-gate | License gate | none | dashboard page | Client-only auth |
| dashboard-router | Demo vs real | `skipAccessCheck?` | gate | — |
| search-dashboard | Main product UX | none | router | Monolith |
| demo-recording-dashboard | Recording mock | none | router, demo-recording | — |
| welcome-state | Empty examples | `onExampleSearch` | search-dashboard | — |
| live-counter | Animated count | `count`, `isSearching` | search-dashboard | — |
| search-queue-card | Queue position | `queuePosition` | search-dashboard | — |
| region-city-chips | Soft city suggestions | suggestions, onSelect | search-dashboard | — |
| nearby-city-chips | Nearby cities | cities, show, onSelect | dashboard, result page | Hardcoded city list (backend) |
| results-summary-bar | Contact stats | `leads` | result page | — |
| results-actions-bar | Download/clear | exportCount, handlers | dashboard, result | — |
| dashboard-history-sections | History wrapper | isMobile, refreshKey | dashboard, result | — |
| search-history | Past searches | isMobile, refreshKey | history sections | Dual history systems |
| recent-searches-panel | Recent + search again | refreshKey, onSearchAgain | history sections | — |
| onboarding-modal | 4-step onboarding | open, step, onNext, onSkip | dashboard page | localStorage only |
| affiliate-section | Referral UI | none | search-dashboard | Nested in search UI |
| SearchUpgradeBanner | Limit banner | remaining, onUpgradeClick | search-dashboard | — |
| SearchLimitModal | Top-up modal | email, onClose | search-dashboard | — |
| RichEmailEditor | TipTap HTML | value, onChange | admin blog, messaging | Admin only |

---

## Results / leads

| Component | Purpose | Key props | Used On | Problems |
|-----------|---------|-----------|---------|----------|
| features/results/results-table | Live virtualized table | leads, filters, selection, outreach | dashboard, result, demo | Large surface |
| features/export/csv-export | CSV helpers | exportToCSV | dashboard, history, api | — |
| email-cell | Email display/copy | lead, onCopy | results-table | — |
| copy-button | Clipboard | value, copyId | email-cell, mobile card | — |
| website-link | Truncated URL | website | cards/table | — |
| contact-dots | Presence indicators | lead | results-table | Meaning not labeled |
| mobile-lead-card | Mobile row | lead, handlers | results-table | — |
| lead-status-select | Pipeline status | leadId, status, onChange | cards/table | — |
| pipeline-summary | Status filter chips | leads, filter, onChange | results-table | — |
| rating-filter | Star filter | value, onChange | results-table | — |
| whatsapp-template-modal | WA + AI | lead, email, credits | dashboard, result, demo | — |
| leads-table | Older table | leads, isLoading | **Unused** | Duplicate / orphan |
| export-modal | Export dialog | open, count, onDownload | **Unused** | Orphan |

---

## Outreach

| Component | Purpose | Key props | Used On | Problems |
|-----------|---------|-----------|---------|----------|
| outreach-workspace | Tabs: Results/Sends/Mailboxes | large prop surface | dashboard, result | Complex |
| outreach-section | Deprecated alias | — | re-export | Dead alias |
| results-outreach-shell | Deprecated alias | — | **Unused** | Orphan |
| outreach-top-bar | Balance summary | balance, mailboxes | workspace | — |
| outreach-search-box | Search inputs | fields + handlers | workspace | — |
| outreach-mailbox-section | Mailbox manage | mailboxes, max, onChanged | workspace | — |
| outreach-guided-mailbox-connect | Gmail connect wizard | onConnected, onCancel | mailbox section | Wizard |
| outreach-send-panel | Compose + send | open, selectedLeads, … | workspace, demo | Not a drawer |
| outreach-send-success-banner | Post-send | result, onDismiss | workspace | — |
| outreach-sends-report | Sends history | refreshKey, isActive | workspace | — |
| outreach-balance-banner | Balance banner | balance, hasMailbox | **Unused** | Orphan |

---

## Admin

| Component | Purpose | Props | Used On |
|-----------|---------|-------|---------|
| account-lookup | License ops | onSessionExpired, prefillEmail | admin page |
| blog-manager | Blog CMS | — | admin page |
| direct-messaging | HTML email send | onSessionExpired | admin page |
| queue-status-bar | Queue metrics | enabled | admin page |
| trial-insights-tabs | Trial tabs shell | onSessionExpired | admin page |
| trial-signups-panel | Signups table | onSessionExpired | insights |
| trial-email-performance-panel | Open rates | onSessionExpired | insights |
| trial-broadcast-panel | Broadcast composer | onSessionExpired | admin page |

---

## Blog

| Component | Purpose | Props | Used On |
|-----------|---------|-------|---------|
| blog-article-view | Article + related | post, content, headings, related | blog/[slug] |
| blog-post-card | Card | post, variant | blog index, article |

---

## Duplicate components

| Pair | Recommendation for redesign |
|------|-----------------------------|
| `navbar` vs marketing `Nav` | Unify design system nav with context variants |
| `footer` vs marketing `Footer` | Unify; include consistent legal + About |
| `leads-table` vs `results-table` | Delete leads-table |
| Logo LP / LT / logo.png | One brand mark |
| Deprecated outreach aliases | Delete |

## Unused components

- `export-modal.tsx`
- `leads-table.tsx`
- `outreach-balance-banner.tsx`
- `results-outreach-shell.tsx`

## Accessibility (cross-cutting)

- Dark-only UI; contrast not systematically audited
- Contact dots / icons lack visible text alternatives in places
- Modal a11y: Radix Dialog only used by unused ExportModal; custom modals may lack focus trap
- Tables: virtualized — ensure header associations for redesign

## Totals

| Metric | Count |
|--------|-------|
| Component files under components/ + features/ | ~80 |
| Unused / orphan | 4 |
| Deprecated re-exports | 2 |
| Marketing sections | 18 |
| Admin panels | 8 |
