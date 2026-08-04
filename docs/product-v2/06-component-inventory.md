# LeadThur V2 — Component Inventory

**Role:** Lead Frontend Architect / Design System Auditor  
**Scope:** Read-only audit of the existing LeadThur frontend  
**Date:** 2026-08-04  
**Status:** Source of truth for LeadThur V2 implementation planning  

**Rules applied:** No code modified. No components created. No refactors. Everything below is based on the current repository under `frontend/`.

**Audited paths:**
- `frontend/components/`
- `frontend/features/`
- `frontend/app/`
- `frontend/hooks/`
- `frontend/lib/`
- `frontend/services/`
- `frontend/styles/globals.css`

**Totals (repo reality):**
| Area | Count |
|------|------:|
| `.tsx` under `components/` | 77 |
| `.tsx` under `features/` | 1 (`results-table.tsx`) |
| Design-system primitives (`components/ui/`) | 4 |
| True orphan components | 5 |
| App `page.tsx` routes | 22 |
| Toast / Sheet / Drawer / Avatar / Badge / Skeleton / Tooltip / Popover / Accordion / Select / Command primitives | **0** |

---

## How to read this document

For every reusable UI unit, fields mean:

| Field | Meaning |
|-------|---------|
| **Reusable Score** | 1–10 fitness as a shared design-system building block today |
| **Can it remain?** | Safe to keep as-is for V2 Phase 1 |
| **Improve?** | Needs API / a11y / visual standardization |
| **Merge?** | Candidate to unify with another existing component |
| **Deprecate?** | Dead, superseded, or should be removed before V2 |

**Disposition labels (Design System Coverage):**
- **KEEP** — Ready enough; keep unchanged for Phase 1
- **KEEP WITH IMPROVEMENTS** — Keep concept; standardize API/visuals
- **REPLACE** — Rebuild behind a proper primitive or pattern
- **REMOVE** — Orphan / deprecated; delete after consumer cleanup

---

# 1. Design tokens & non-component UI foundations

These are not React components but constrain every surface.

| Asset | Path | Purpose | Design-system note |
|-------|------|---------|-------------------|
| Global theme | `frontend/styles/globals.css` | `--color-background`, `--color-surface`, `--color-accent` (#7c3aed), Inter via `--font-sans`, `.glass`, `.skeleton`, pulse/fade animations | Dark-first; violet accent |
| Marketing tokens | `frontend/components/marketing/homepage/theme.ts` | `C` colors, `FONT` (system stack), `TAP_TARGET`, route consts | **Diverges** from Inter + globals.css |
| Hooks (behavior only) | `frontend/hooks/*` | `useSearch`, `useSearchJob`, `useOutreach`, `useLeadStatuses`, `useCopyToClipboard`, `useIsMobile` | Not UI; consumers own markup |
| Lib helpers | `frontend/lib/*` | lead selection/status, rating filter, blog, license, device, whatsapp | Logic only |
| Services | `frontend/services/*` | `api`, `auth-api`, `admin-api`, `outreach-api` | Network only |
| CSV export | `frontend/features/export/csv-export.ts` | Export helper used by actions bar | Logic only |

**Implication:** V2 cannot treat “one theme” as already solved. Marketing (`theme.ts` + system font) and app (`globals.css` + Inter) are two parallel systems.

---

# 2. Component catalog by category

## 2.1 Buttons

### Button
| Field | Detail |
|-------|--------|
| **File** | `frontend/components/ui/button.tsx` |
| **Purpose** | Shared CTA / action control (CVA + Radix Slot) |
| **Props** | `variant?`, `size?`, `asChild?`, plus native button attrs |
| **Variants** | `default`, `outline`, `ghost`, `glow` |
| **Sizes** | `default` (h-10), `sm` (h-8), `lg` (h-12), `icon` (h-10 w-10) |
| **States** | hover, focus-visible (violet ring), disabled |
| **Dependencies** | `@radix-ui/react-slot`, `class-variance-authority`, `cn` |
| **Used on** | Outreach panels, results actions, search history, navbar, results table, demo recording, export-modal (orphan) |
| **Responsive** | Size props only; no mobile-specific variants |
| **A11y** | Focus ring; relies on native/button semantics; `asChild` for links |
| **Reusable score** | **8** |
| **Remain?** | Yes |
| **Improve?** | Yes — broaden variants (destructive, secondary, link); document as sole CTA |
| **Merge?** | No — *absorb* raw `<button>` usage into this |
| **Deprecate?** | No |
| **Disposition** | **KEEP WITH IMPROVEMENTS** |

### Duplicate / inline buttons (not components)
Raw `<button>` dominates: marketing Nav/Hero/FAQ, freetrial, activate, checkout, admin page + panels, WhatsappTemplateModal, SearchLimitModal, OnboardingModal, plans page.  
**Unify:** Mandate `ui/Button` (or a future marketing Button variant) for all CTAs.

---

## 2.2 Inputs / Forms

### Input
| Field | Detail |
|-------|--------|
| **File** | `frontend/components/ui/input.tsx` |
| **Purpose** | Text field primitive |
| **Props** | `React.ComponentProps<"input">` |
| **Variants / sizes** | Single style: h-11, rounded-lg, white/10 border |
| **States** | hover, focus-visible, disabled |
| **Dependencies** | `cn` |
| **Used on** | outreach-send-panel, outreach-search-box, outreach-guided-mailbox-connect, demo-recording-dashboard |
| **Responsive** | Full width |
| **A11y** | Native input; label responsibility on parent |
| **Reusable score** | **7** |
| **Remain?** | Yes |
| **Improve?** | Yes — add error/success states, sizes, label pairing |
| **Merge?** | Absorb raw inputs on activate/checkout/freetrial/admin |
| **Deprecate?** | No |
| **Disposition** | **KEEP WITH IMPROVEMENTS** |

### LeadStatusSelect
| Field | Detail |
|-------|--------|
| **File** | `frontend/components/dashboard/lead-status-select.tsx` |
| **Purpose** | Pipeline status dropdown per lead |
| **Props** | `leadId`, `status`, `onChange`, `fullWidth?` |
| **Variants** | fullWidth vs compact |
| **States** | controlled status |
| **Dependencies** | lead-status lib |
| **Used on** | mobile-lead-card, results-table |
| **Responsive** | `fullWidth` for mobile cards |
| **A11y** | Native `<select>` (verify labels) |
| **Reusable score** | **6** |
| **Disposition** | **KEEP WITH IMPROVEMENTS** (promote to `ui/Select` later) |

### RichEmailEditor
| Field | Detail |
|-------|--------|
| **File** | `frontend/components/RichEmailEditor.tsx` |
| **Purpose** | TipTap HTML editor for admin email/blog |
| **Props** | `value`, `onChange`, `placeholder?` |
| **Used on** | direct-messaging, blog-manager |
| **Reusable score** | **5** (admin-scoped) |
| **Disposition** | **KEEP** (admin); do not force into product UI |

### Inline forms (page-owned, not components)
| Surface | Pattern |
|---------|---------|
| `app/activate` | License key + raw input/button |
| `app/checkout` | Email + pay CTA |
| `app/freetrial` | Trial search form + paywall sheet |
| `app/admin` | Login + many panel forms |
| `app/dashboard/plans` | Period toggle + CTA |

**Missing form primitives:** Label, Textarea, Checkbox, Radio, Switch, FormField, FieldError — **do not exist**.

---

## 2.3 Cards

| Component | Path | Purpose | Props | Score | Disposition |
|-----------|------|---------|-------|------:|-------------|
| BlogPostCard | `components/blog/blog-post-card.tsx` | Blog list/featured card | `post`, `variant?: default\|featured` | 7 | **KEEP WITH IMPROVEMENTS** |
| SearchQueueCard | `components/dashboard/search-queue-card.tsx` | Queue position during search | `queuePosition` | 5 | **KEEP** |
| MobileLeadCard | `components/dashboard/mobile-lead-card.tsx` | Lead as card on mobile | lead + copy/status/select props | 7 | **KEEP WITH IMPROVEMENTS** |
| WelcomeState | `components/dashboard/welcome-state.tsx` | Empty/example search state | `onExampleSearch` | 6 | **KEEP WITH IMPROVEMENTS** (seed Empty State library) |

Marketing homepage sections act as large “cards/sections” but are page-bound (no props). Treat as **marketing blocks**, not design-system cards.

**No generic Card / MetricCard / StatCard / PricingCard primitive exists.** Pricing lives inside `PricingSection` only.

---

## 2.4 Tables / Data Grid

### ResultsTable
| Field | Detail |
|-------|--------|
| **File** | `frontend/features/results/results-table.tsx` |
| **Purpose** | Primary leads data grid (desktop table + mobile cards) |
| **Props** | `leads`, `isLoading`, `isMobile?`, filters, statuses, selection, outreach send hooks, rating filter, etc. (large surface) |
| **Variants** | Desktop table vs MobileLeadCard list |
| **States** | loading, empty, filtering, selection, email scraping in progress |
| **Dependencies** | Button, ContactDots, CopyButton, EmailCell, LeadStatusSelect, MobileLeadCard, PipelineSummary, RatingFilter, WebsiteLink |
| **Used on** | search-dashboard, search-result-client, DemoPageContent |
| **Responsive** | Explicit `isMobile` branch |
| **A11y** | Mixed; checkboxes/selection need audit |
| **Reusable score** | **6** (powerful but monolithic) |
| **Remain?** | Yes as product feature |
| **Improve?** | Yes — split chrome vs cells; extract DataTable shell |
| **Merge?** | Supersedes LeadsTable |
| **Deprecate?** | No |
| **Disposition** | **KEEP WITH IMPROVEMENTS** |

### LeadsTable (orphan)
| Field | Detail |
|-------|--------|
| **File** | `frontend/components/dashboard/leads-table.tsx` |
| **Purpose** | Older leads table |
| **Props** | `leads`, `isLoading` |
| **Used on** | **None** |
| **Reusable score** | **1** |
| **Disposition** | **REMOVE** |

Admin uses **page-inline HTML tables** (not shared table components).

---

## 2.5 Badges / Avatars / Status indicators

| Item | Exists? | Notes |
|------|---------|-------|
| Badge primitive | **No** | Status colors inline in PipelineSummary / LeadStatusSelect / marketing chips |
| Avatar | **No** | — |
| ContactDots | **Yes** — `dashboard/contact-dots.tsx` | Visual contact-availability dots on leads; props: `lead` |
| LiveCounter | **Yes** — animated count during search | Not a badge |

**ContactDots** — Score **6** — **KEEP WITH IMPROVEMENTS** (could become StatusDots/Badge family).

---

## 2.6 Alerts / Toast / Banner

| Component | Path | Purpose | Props | Score | Disposition |
|-----------|------|---------|-------|------:|-------------|
| SearchUpgradeBanner | `components/SearchUpgradeBanner.tsx` | Trial/limit upgrade strip | searches/credits remaining, onUpgradeClick | 6 | **KEEP WITH IMPROVEMENTS** |
| OutreachSendSuccessBanner | `dashboard/outreach-send-success-banner.tsx` | Post-send success | result, recipientCount, onDismiss | 6 | **KEEP WITH IMPROVEMENTS** |
| OutreachBalanceBanner | `dashboard/outreach-balance-banner.tsx` | Balance/mailbox warning | balance, hasMailbox, loading? | 2 | **REMOVE** (orphan; superseded by OutreachTopBar) |
| OutreachTopBar | `dashboard/outreach-top-bar.tsx` | Balance + mailbox summary bar | balance, mailboxes, loading? | 6 | **KEEP WITH IMPROVEMENTS** |
| AnnouncementBar | `marketing/homepage/AnnouncementBar.tsx` | Marketing top strip | none | 4 | **KEEP** (marketing-only) |

**Toast / Sonner / AlertDialog:** do not exist. Feedback is banners, inline text, or modals.

---

## 2.7 Dialog / Modal / Drawer / Sheet / Popover

### Dialog (Radix)
| Field | Detail |
|-------|--------|
| **File** | `frontend/components/ui/dialog.tsx` |
| **Purpose** | Accessible modal shell |
| **Exports** | Dialog, Trigger, Portal, Overlay, Close, Content, Header, Title, Description |
| **Used on** | **export-modal only** (orphan) |
| **Reusable score** | **8** (underused) |
| **Disposition** | **KEEP** — adopt for all modals |

### ExportModal (orphan)
| Field | Detail |
|-------|--------|
| **File** | `frontend/components/dashboard/export-modal.tsx` |
| **Purpose** | Confirm CSV download via Dialog |
| **Props** | `open`, `onOpenChange`, `count`, `onDownload` |
| **Used on** | **None** (export via ResultsActionsBar + csv-export) |
| **Disposition** | **REMOVE** (or revive if Dialog-based confirm is desired) |

### Custom modals (parallel systems)
| Component | Path | Pattern | Score | Disposition |
|-----------|------|---------|------:|-------------|
| OnboardingModal | `dashboard/onboarding-modal.tsx` | Fixed overlay, raw buttons | 4 | **REPLACE** → Dialog |
| SearchLimitModal | `SearchLimitModal.tsx` | Fixed overlay | 4 | **REPLACE** → Dialog |
| WhatsappTemplateModal | `dashboard/whatsapp-template-modal.tsx` | `role="dialog"` overlay | 5 | **REPLACE** → Dialog |
| OutreachSendPanel | `dashboard/outreach-send-panel.tsx` | Portal slide-over (`fixed inset-0`) | 6 | **KEEP WITH IMPROVEMENTS** → future Sheet/Drawer |
| Freetrial paywall | `app/freetrial/page.tsx` inline | Bottom sheet panel | 3 | **REPLACE** → Sheet when introduced |

**Drawer / Sheet / Popover / Tooltip:** **missing**.

---

## 2.8 Dropdown / Tabs / Accordion / Navigation

| Component | Path | Notes | Disposition |
|-----------|------|-------|-------------|
| Nav (marketing) | `marketing/homepage/Nav.tsx` | Sticky marketing nav + mobile menu; no props | **KEEP WITH IMPROVEMENTS**; merge strategy with Navbar |
| Navbar (app) | `components/navbar.tsx` | App shell; uses Button | **KEEP WITH IMPROVEMENTS** |
| Footer (marketing) | `marketing/homepage/Footer.tsx` | Marketing footer | **MERGE** with app Footer |
| Footer (app) | `components/footer.tsx` | Legal links (includes About) | **MERGE** |
| LeadThurLogo | `marketing/homepage/LeadThurLogo.tsx` | `size?: sm\|md` | **KEEP WITH IMPROVEMENTS** — single logo system |
| FAQSection | marketing | Accordion-like FAQ via raw buttons | **KEEP** marketing; extract Accordion later |
| TrialInsightsTabs | `admin/trial-insights-tabs.tsx` | Admin tab shell | **KEEP** admin |
| OutreachWorkspace tabs | inside outreach-workspace | Results / Mailbox / Sends | Feature-owned tabs, not primitive |

**No** Sidebar, Pagination, Breadcrumb, Command Palette primitives.

---

## 2.9 Search / Filters / Chips

| Component | Path | Purpose | Key props | Score | Disposition |
|-----------|------|---------|-----------|------:|-------------|
| OutreachSearchBox | `dashboard/outreach-search-box.tsx` | Business + location search | controlled fields, onSearch, isMobile? | 7 | **KEEP WITH IMPROVEMENTS** → Global Search pattern |
| RatingFilter | `dashboard/rating-filter.tsx` | Star rating filter | value, onChange, counts, isMobile? | 7 | **KEEP** |
| PipelineSummary | `dashboard/pipeline-summary.tsx` | Status filter chips + counts | leads, statuses, filter handlers | 7 | **KEEP WITH IMPROVEMENTS** |
| NearbyCityChips | `dashboard/nearby-city-chips.tsx` | Nearby city suggestions | cities, show, onSelectCity | 6 | **KEEP** |
| RegionCityChips | `dashboard/region-city-chips.tsx` | Soft region city suggestions | suggestions, message?, onSelectCity | 6 | **MERGE** consider with NearbyCityChips |
| RecentSearchesPanel | `dashboard/recent-searches-panel.tsx` | Recent searches + search again | refreshKey, onSearchAgain | 6 | **KEEP WITH IMPROVEMENTS** |
| SearchHistory | `dashboard/search-history.tsx` | Past searches list | isMobile?, refreshKey, onViewResults? | 6 | **KEEP WITH IMPROVEMENTS**; clarify vs RecentSearchesPanel |
| DashboardHistorySections | `dashboard/dashboard-history-sections.tsx` | Wraps history panels | isMobile?, refreshKey, onSearchAgain | 5 | **KEEP** |

**Duplication:** SearchHistory vs RecentSearchesPanel overlap; two chip components for cities; freetrial has its own example pills inline.

---

## 2.10 Loading / Skeleton / Progress

| Item | Path | Notes | Disposition |
|------|------|-------|-------------|
| Progress | `ui/progress.tsx` | Radix progress; used in search-dashboard + demo-recording | **KEEP** |
| `.skeleton` CSS | `styles/globals.css` | Shimmer class; not a React component | Promote to Skeleton component later |
| Inline spinners / “Searching…” | search-dashboard, results-table | Ad hoc | **REPLACE** with shared Loading |

---

## 2.11 Charts

**None** in frontend components. Admin trial performance is tabular/panel UI, not chart primitives.

---

## 2.12 Business / Lead cards & cells

| Component | Path | Purpose | Props (summary) | Score | Disposition |
|-----------|------|---------|-----------------|------:|-------------|
| MobileLeadCard | `dashboard/mobile-lead-card.tsx` | Mobile lead row/card | lead, copy, status, select, template | 7 | **KEEP WITH IMPROVEMENTS** |
| EmailCell | `dashboard/email-cell.tsx` | Email display + copy | lead, copiedId?, onCopy? | 7 | **KEEP** |
| WebsiteLink | `dashboard/website-link.tsx` | Truncated website link | website, className?, maxLength? | 7 | **KEEP** |
| CopyButton | `dashboard/copy-button.tsx` | Copy-to-clipboard control | value, copyId, copiedId, onCopy, alwaysVisible?, variant? | 8 | **KEEP** |
| ContactDots | `dashboard/contact-dots.tsx` | Contact channel dots | lead | 6 | **KEEP WITH IMPROVEMENTS** |

---

## 2.13 Outreach / Mailbox components

| Component | Path | Purpose | Score | Disposition |
|-----------|------|---------|------:|-------------|
| OutreachWorkspace | `dashboard/outreach-workspace.tsx` | Tabbed outreach shell | 7 | **KEEP WITH IMPROVEMENTS** |
| OutreachMailboxSection | `dashboard/outreach-mailbox-section.tsx` | Mailbox list/connect | 6 | **KEEP WITH IMPROVEMENTS** |
| OutreachGuidedMailboxConnect | `dashboard/outreach-guided-mailbox-connect.tsx` | Guided Gmail connect | 6 | **KEEP** |
| OutreachSendPanel | `dashboard/outreach-send-panel.tsx` | Compose / send slide-over | 6 | **KEEP WITH IMPROVEMENTS** |
| OutreachSendsReport | `dashboard/outreach-sends-report.tsx` | Sends history/report | 6 | **KEEP** |
| OutreachTopBar | `dashboard/outreach-top-bar.tsx` | Balance/mailbox chrome | 6 | **KEEP WITH IMPROVEMENTS** |
| OutreachSendSuccessBanner | `dashboard/outreach-send-success-banner.tsx` | Success feedback | 6 | **KEEP WITH IMPROVEMENTS** |
| OutreachSection | `dashboard/outreach-section.tsx` | Deprecated re-export of Workspace | 1 | **REMOVE** |
| ResultsOutreachShell | `dashboard/results-outreach-shell.tsx` | Deprecated re-export of Workspace | 1 | **REMOVE** |
| OutreachBalanceBanner | `dashboard/outreach-balance-banner.tsx` | Orphan banner | 2 | **REMOVE** |

---

## 2.14 Dashboard / Search product shell

| Component | Path | Purpose | Score | Disposition |
|-----------|------|---------|------:|-------------|
| DashboardGate | `dashboard/dashboard-gate.tsx` | License gate wrapper | 5 | **KEEP WITH IMPROVEMENTS** |
| DashboardRouter | `dashboard/dashboard-router.tsx` | Demo vs live dashboard | 5 | **KEEP** |
| SearchDashboard | `dashboard/search-dashboard.tsx` | Main product monolith | 4 | **KEEP WITH IMPROVEMENTS** (split for V2) |
| DemoRecordingDashboard | `dashboard/demo-recording-dashboard.tsx` | Recording mock UI | 4 | **KEEP** (demo-only) |
| ResultsActionsBar | `dashboard/results-actions-bar.tsx` | Export / clear | 7 | **KEEP** |
| ResultsSummaryBar | `dashboard/results-summary-bar.tsx` | Contact stats summary | 6 | **KEEP WITH IMPROVEMENTS** → Metric/Stat pattern |
| LiveCounter | `dashboard/live-counter.tsx` | Live result count | 6 | **KEEP** |
| AffiliateSection | `dashboard/affiliate-section.tsx` | Referral UI inside dashboard | 5 | **KEEP WITH IMPROVEMENTS** |
| OnboardingModal | `dashboard/onboarding-modal.tsx` | First-run steps | 4 | **REPLACE** |

---

## 2.15 Admin components

| Component | Path | Purpose | Score | Disposition |
|-----------|------|---------|------:|-------------|
| AccountLookup | `admin/account-lookup.tsx` | User/account lookup | 5 | **KEEP** (admin) |
| BlogManager | `admin/blog-manager.tsx` | CMS blog CRUD UI | 5 | **KEEP** |
| DirectMessaging | `admin/direct-messaging.tsx` | Admin email send | 5 | **KEEP** |
| AdminQueueStatusBar | `admin/queue-status-bar.tsx` | Queue health | 5 | **KEEP** |
| TrialBroadcastPanel | `admin/trial-broadcast-panel.tsx` | Trial broadcast | 5 | **KEEP** |
| TrialInsightsTabs | `admin/trial-insights-tabs.tsx` | Trial analytics tabs | 5 | **KEEP** |
| TrialEmailPerformancePanel | `admin/trial-email-performance-panel.tsx` | Email metrics | 5 | **KEEP** |
| TrialSignupsPanel | `admin/trial-signups-panel.tsx` | Signup list | 5 | **KEEP** |

Admin UI does **not** use `ui/Button` / `ui/Input` consistently; page owns login chrome.

---

## 2.16 Blog / Marketing / Trial / Checkout / Activation

### Blog
| Component | Path | Disposition |
|-----------|------|-------------|
| BlogArticleView | `components/blog/blog-article-view.tsx` | **KEEP WITH IMPROVEMENTS** |
| BlogPostCard | `components/blog/blog-post-card.tsx` | **KEEP WITH IMPROVEMENTS** |

### Marketing homepage sections
All under `components/marketing/homepage/`; **no props**; consumed by `app/(marketing)/page.tsx`.

| Component | Disposition |
|-----------|-------------|
| AnnouncementBar, Hero, StatsBar, ProblemAgitationSection, FreeTrialInviteSection, EmailSenderSection, DemoVideoSection, UserTestimonialsSection, TrustpilotSection, HowItWorksSection, DifferenceSection, FeatureGridSection, WhoIsForSection, PricingSection, GuaranteeSection, FAQSection, FinalCTASection | **KEEP** for marketing; extract shared CTA/typography in Phase 2–3 |
| Nav, Footer, LeadThurLogo | **KEEP WITH IMPROVEMENTS** / merge with app shell |

### Trial / Checkout / Activation
| Surface | Components used | Note |
|---------|-----------------|------|
| `/freetrial` | Almost entirely **page-inline** UI | Highest duplication risk |
| `/checkout`, `/checkout/success`, `/payment-success` | Page-inline | No shared Checkout components |
| `/activate` | Page-inline | No Activation form component |
| `/get-access`, `/start` | Redirect/helper pages | Minimal UI |
| `/dashboard/plans` | Page-inline pricing CTAs | Duplicates marketing PricingSection messaging |

---

# 3. Page dependency map

| Page / route | Primary components | Duplicated / page-local UI | Should become global |
|--------------|-------------------|----------------------------|----------------------|
| `/` marketing | All homepage sections + Nav/Footer/Logo | Raw buttons, system font | Button, Logo, Footer, typography |
| `/about`, `/terms`, `/privacy` | Mostly static / app footer patterns | Inconsistent chrome | Shared PageLayout, Footer |
| `/blog`, `/blog/[slug]`, category/tag | BlogPostCard, BlogArticleView | — | Card, PageHeader |
| `/freetrial` | **None from design system** | Full custom form, chips, paywall sheet, tables | Input, Button, Sheet, EmptyState, SearchBox |
| `/activate` | None | License form | Input, Button, FormField |
| `/checkout` (+ success) | None | Email + pay CTA | CheckoutForm, Button |
| `/dashboard` | DashboardGate → Router → SearchDashboard (+ OnboardingModal) | Monolith composition | PageHeader, Search, ResultsTable, Banner |
| `/dashboard/search/[searchId]` | Navbar, Footer, OutreachWorkspace, ResultsTable, history, chips, Whatsapp modal | Selection state duplicated vs dashboard | Shared Results layout |
| `/dashboard/plans` | None | Period toggle + CTAs | PricingCard, Button |
| `/demo` | DemoPageContent → ResultsTable, RatingFilter, OutreachSendPanel, banners | Mirrors dashboard wiring | Shared results/outreach hooks UI |
| `/demo-recording` | DemoRecordingDashboard | Uses Button/Input/Progress | Keep isolated |
| `/admin` | All admin/* + RichEmailEditor | Raw buttons, tables, login | AdminLayout, Table, Button |
| `/suspended` | Minimal | — | Alert/Banner |
| `/get-access`, `/start`, `/payment-success` | Minimal / redirect | — | — |

### Components duplicated across pages
| Pattern | Where duplicated | Unify into |
|---------|------------------|------------|
| Lead selection + ResultsTable wiring | search-dashboard, search-result-client, DemoPageContent | Shared ResultsWorkspace container |
| Export actions | ResultsActionsBar (live) vs ExportModal (dead) | ResultsActionsBar only |
| Nav/Footer/Logo | marketing vs app | AppShell + MarketingShell sharing Logo/Footer tokens |
| Search + city chips | dashboard + result page | SearchModule |
| Upgrade / limit UX | SearchUpgradeBanner, SearchLimitModal, freetrial paywall | BillingGate family |
| History | SearchHistory + RecentSearchesPanel | Single RecentSearches |

---

# 4. Component duplication & unification plan (do not implement)

## Duplicate buttons
- `ui/Button` vs hundreds of raw `<button>` + marketing inline styles.  
- **Unify:** Button as sole control; marketing may get `variant="marketing"` later.

## Duplicate cards
- BlogPostCard vs glass info blocks in outreach/freetrial vs WelcomeState.  
- **Unify:** `Card` primitive + content slots.

## Duplicate tables
- ResultsTable (live) vs LeadsTable (orphan) vs admin HTML tables.  
- **Unify:** DataTable shell; admin optional later.

## Duplicate dialogs
- Radix Dialog (unused in product) vs OnboardingModal / SearchLimitModal / WhatsappTemplateModal / freetrial sheet / OutreachSendPanel portal.  
- **Unify:** Dialog for centered modals; Sheet for slide-overs.

## Duplicate forms
- Activate, checkout, freetrial, admin login, mailbox connect, compose — each hand-styled.  
- **Unify:** Input + Textarea + FormField + Label.

## Duplicate search inputs
- OutreachSearchBox vs freetrial search UI vs demo-recording inputs.  
- **Unify:** SearchField / SearchBox.

## Duplicate badges
- Pipeline status colors, contact dots, chip styles — inline.  
- **Unify:** Badge + StatusBadge.

## Duplicate layouts
- Marketing Nav/Footer vs app Navbar/Footer; no shared PageHeader.  
- **Unify:** shells + PageHeader.

## Duplicate loading / empty
- Progress + `.skeleton` + ad hoc text; WelcomeState + empty table messages + admin empties.  
- **Unify:** Skeleton, Spinner, EmptyState.

## Duplicate icons / animations / typography / spacing
- Logo: “LT” / “LP” / `/logo.png` treatments.  
- Animations: globals.css pulses vs marketing motion.  
- Fonts: Inter (app) vs system FONT (marketing theme.ts).  
- Spacing/radius: rounded-lg vs ad hoc radii; violet shadows inconsistent.  
- **Unify:** token file + Logo component + motion tokens.

---

# 5. Design system coverage matrix

| Component / pattern | Disposition |
|---------------------|-------------|
| ui/Button | **KEEP WITH IMPROVEMENTS** |
| ui/Input | **KEEP WITH IMPROVEMENTS** |
| ui/Dialog | **KEEP** (adopt widely) |
| ui/Progress | **KEEP** |
| CopyButton, EmailCell, WebsiteLink, RatingFilter | **KEEP** / **KEEP WITH IMPROVEMENTS** |
| ResultsTable | **KEEP WITH IMPROVEMENTS** |
| OutreachWorkspace family (active) | **KEEP WITH IMPROVEMENTS** |
| Marketing sections | **KEEP** (scope-limited) |
| BlogPostCard / BlogArticleView | **KEEP WITH IMPROVEMENTS** |
| Admin panels | **KEEP** (admin island) |
| Navbar + marketing Nav | **KEEP WITH IMPROVEMENTS** → merge strategy |
| Footer + marketing Footer | **REPLACE** via single Footer |
| LeadThurLogo | **KEEP WITH IMPROVEMENTS** |
| SearchUpgradeBanner / success banners | **KEEP WITH IMPROVEMENTS** |
| OnboardingModal, SearchLimitModal, WhatsappTemplateModal | **REPLACE** (Dialog-based) |
| OutreachSendPanel | **KEEP WITH IMPROVEMENTS** → Sheet |
| SearchDashboard monolith | **KEEP WITH IMPROVEMENTS** (decompose) |
| ExportModal, LeadsTable, OutreachBalanceBanner, OutreachSection, ResultsOutreachShell | **REMOVE** |
| Freetrial / checkout / activate inline UI | **REPLACE** with shared primitives |

---

# 6. Missing components required for LeadThur V2

*Document only — do not create.*

### Foundations
- Label, Textarea, Checkbox, Radio, Switch, Select, FormField, FieldError, HelperText  
- Card, CardHeader, CardContent  
- Badge, StatusBadge, Tag/Chip  
- Avatar  
- Skeleton, Spinner, LoadingOverlay  
- Alert, Toast / Notification toaster  
- Tooltip, Popover, DropdownMenu  
- Accordion, Tabs (primitive)  
- Sheet / Drawer  
- Separator, VisuallyHidden  

### Product chrome
- PageHeader  
- AppSidebar / AppShell  
- Command Palette / Command Menu  
- Global Search  
- Notification Center  
- Keyboard Shortcut Modal / Shortcut Hint  
- Help Widget  
- Permission Wrapper  
- Bulk Action Bar  
- Floating Action Menu  
- Split Button  

### Data & productivity
- DataTable (generic)  
- Advanced Filter Builder  
- Saved Views  
- Pagination  
- Empty State Library  
- Statistics Card / Metric Card  
- Activity Timeline / Status Timeline / Recent Activity  
- AI Assistant Panel  

### Domain (may compose existing)
- Recent Searches (canonical — merge existing panels)  
- Unified BillingGate (banner + modal + paywall)  
- PricingCard (shared marketing + plans)  
- ActivationForm, CheckoutForm  
- Lead Card (desktop) to pair with MobileLeadCard  

---

# 7. Design debt register

| Debt | Evidence |
|------|----------|
| Dual color systems | `globals.css` tokens vs `theme.ts` `C` |
| Dual fonts | Inter (layout) vs system FONT in marketing |
| Dual nav/footer/logo | marketing vs app; logo mark inconsistency |
| Button height inconsistency | ui Button h-8/10/12 vs marketing TAP_TARGET 48 vs raw buttons |
| Border radius inconsistency | rounded-lg primitives vs mixed radii in pages |
| Shadow / glow inconsistency | Button violet shadows vs `.glow-violet` vs marketing |
| Modal inconsistency | Radix Dialog vs 4+ custom overlays |
| Table inconsistency | ResultsTable vs admin HTML vs orphan LeadsTable |
| Search box inconsistency | OutreachSearchBox vs freetrial vs raw inputs |
| Card inconsistency | Blog cards vs glass panels vs welcome |
| Loading inconsistency | Progress vs skeleton CSS vs text-only |
| Empty state inconsistency | WelcomeState vs inline “No emails…” copy |
| Spacing / padding | No shared spacing scale beyond Tailwind defaults |
| Hover / transition | Button `duration-200` vs ad hoc / none |
| Typography scale | No shared type ramp; section headlines own sizes |
| ui adoption gap | Dialog only used by orphan; Input barely used outside outreach |
| Monolith risk | `search-dashboard.tsx` owns too much composition |
| Dead code | 5 orphans/deprecated re-exports |

---

# 8. Final scorecard (out of 10)

| Dimension | Score | Rationale |
|-----------|------:|-----------|
| Consistency | **3** | Dual themes, dual shells, raw vs primitive controls |
| Reusability | **4** | Strong domain components; weak foundations |
| Accessibility | **4** | Radix Dialog unused; many custom modals; focus/labels uneven |
| Responsiveness | **6** | MobileLeadCard + isMobile paths exist; marketing/freetrial uneven |
| Scalability | **3** | Monoliths + missing primitives block V2 velocity |
| Maintainability | **4** | Orphans + duplicated selection wiring |
| Visual Consistency | **3** | Violet-dark brand present but execution fragmented |
| Design System Readiness | **2** | Only 4 primitives; no tokens package |
| Technical Debt | **7** | High debt (higher = worse); orphans + parallel modals |
| **Overall UI Architecture** | **4** | Product features are rich; system layer is thin |

---

# 9. Migration plan (inventory → V2, no implementation in this doc)

## Phase 1 — Keep unchanged (stabilize)
- Active outreach family: OutreachWorkspace, MailboxSection, GuidedMailboxConnect, SendPanel, SendsReport, TopBar, SendSuccessBanner  
- ResultsTable + cell helpers: EmailCell, WebsiteLink, CopyButton, ContactDots, LeadStatusSelect, MobileLeadCard, RatingFilter, PipelineSummary  
- ResultsActionsBar, LiveCounter, SearchQueueCard, Nearby/Region chips (temporary)  
- BlogPostCard, BlogArticleView, RichEmailEditor  
- All admin panels (admin island)  
- Marketing homepage sections (content blocks)  
- ui/Progress  

**Also Phase 1 hygiene (delete only when confirmed unused):**  
ExportModal, LeadsTable, OutreachBalanceBanner, OutreachSection, ResultsOutreachShell.

## Phase 2 — Standardize
- Adopt **Button** + **Input** on activate, checkout, freetrial, admin CTAs  
- Adopt **Dialog** for OnboardingModal, SearchLimitModal, WhatsappTemplateModal  
- Single **Logo** + shared Footer link set  
- Align marketing `theme.ts` colors with `globals.css` tokens (document mapping)  
- Document Button/Input variants as the design-system contract  

## Phase 3 — Merge
- Navbar ↔ marketing Nav (shared parts)  
- Footer ↔ marketing Footer  
- SearchHistory ↔ RecentSearchesPanel → one Recent Searches  
- NearbyCityChips ↔ RegionCityChips → CityChips  
- Selection/export wiring across dashboard / result / demo → ResultsWorkspace  
- Banners → Alert/Banner variants  

## Phase 4 — Rebuild
- SearchDashboard decomposition into Search + Results + Billing chrome  
- OutreachSendPanel → Sheet-based compose  
- Freetrial / checkout / activate / plans → composed from primitives  
- Custom modals fully retired  
- Optional DataTable extraction from ResultsTable  

## Phase 5 — Introduce (from Missing list, prioritized)
1. FormField, Textarea, Select, Label  
2. Card, Badge, Skeleton, Spinner, EmptyState  
3. Toast + Alert  
4. Sheet / Drawer, Tooltip, DropdownMenu  
5. PageHeader, AppShell  
6. Metric/Stat Card  
7. Command Palette / Global Search  
8. Bulk Action Bar, Saved Views, Filter Builder  
9. Notification Center, Activity Timeline, Help / shortcuts  

---

# 10. Inventory index (complete file list)

### `frontend/components/ui/`
- `button.tsx` — Button  
- `dialog.tsx` — Dialog family  
- `input.tsx` — Input  
- `progress.tsx` — Progress  

### `frontend/components/` (root)
- `navbar.tsx`, `footer.tsx`, `RichEmailEditor.tsx`, `SearchLimitModal.tsx`, `SearchUpgradeBanner.tsx`

### `frontend/components/marketing/homepage/`
- AnnouncementBar, DemoVideoSection, DifferenceSection, EmailSenderSection, FAQSection, FeatureGridSection, FinalCTASection, Footer, FreeTrialInviteSection, GuaranteeSection, Hero, HowItWorksSection, LeadThurLogo, Nav, PricingSection, ProblemAgitationSection, StatsBar, TrustpilotSection, UserTestimonialsSection, WhoIsForSection, `theme.ts`

### `frontend/components/dashboard/`
- affiliate-section, contact-dots, copy-button, dashboard-gate, dashboard-history-sections, dashboard-router, demo-recording-dashboard, email-cell, export-modal *(orphan)*, lead-status-select, leads-table *(orphan)*, live-counter, mobile-lead-card, nearby-city-chips, onboarding-modal, outreach-balance-banner *(orphan)*, outreach-guided-mailbox-connect, outreach-mailbox-section, outreach-search-box, outreach-section *(deprecated)*, outreach-send-panel, outreach-send-success-banner, outreach-sends-report, outreach-top-bar, outreach-workspace, pipeline-summary, rating-filter, recent-searches-panel, region-city-chips, results-actions-bar, results-outreach-shell *(deprecated)*, results-summary-bar, search-dashboard, search-history, search-queue-card, website-link, welcome-state, whatsapp-template-modal  

### `frontend/components/admin/`
- account-lookup, blog-manager, direct-messaging, queue-status-bar, trial-broadcast-panel, trial-email-performance-panel, trial-insights-tabs, trial-signups-panel  

### `frontend/components/blog/`
- blog-article-view, blog-post-card  

### `frontend/features/`
- `results/results-table.tsx` — ResultsTable  
- `export/csv-export.ts` — non-UI  

### Hooks / lib / services
- Hooks and services support UI but are **not** reusable visual components; listed in §1.

---

# 11. Governance rule for V2

> Before creating any new UI component for LeadThur V2, check this inventory.  
> Prefer **KEEP / KEEP WITH IMPROVEMENTS** components.  
> Do not recreate Button, Input, Dialog, ResultsTable, OutreachWorkspace, CopyButton, MobileLeadCard, BlogPostCard, or marketing sections.  
> New work belongs in Phase 5 **only** if listed as Missing and not already covered above.

---

*End of inventory. No application code was modified.*
