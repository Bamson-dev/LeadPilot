# LeadThur V2 — Milestone Report  
## RC1 Discovery Workspace Complete

**Branch:** `staging`  
**Commit message:** `feat(v2): complete RC1 Discovery Workspace`  
**Date:** 2026-08-04  

---

## Summary

Discovery Workspace is now at RC1-quality for engineering handoff: design-system tokens, AppShell, restyled ResultsTable, Business Details panel (real fields only), search chrome, and responsive layouts. Backend behaviour unchanged.

---

## Components completed

### Design system / shell (prior + retained)
- UI primitives under `frontend/components/ui/*`
- `AppShell`, `AppSidebar`, `AppTopNav`

### Discovery
- `DiscoveryWorkspaceHeader`
- `DiscoveryBulkBar`
- `DiscoveryResultsLayout` (desktop panel / tablet drawer / mobile dialog sheet)
- `BusinessDetailsPanel` — **existing Lead fields only**
- `ResultsTable` — RC1 restyle (sticky filters + header, selection, hover actions, StatusBadge, Checkbox)
- `OutreachSearchBox` — RC1 tokens
- `WelcomeState`, `PipelineSummary`, `RatingFilter` — RC1 restyle
- `MobileLeadCard` — RC1 tokens + open/active states

### Wired pages
- `/dashboard` via `SearchDashboard` + `DashboardGate`
- `/dashboard/search/[searchId]` via `search-result-client` + AppShell

---

## Components still pending (outside Discovery)

- Saved Leads dedicated screen
- Campaigns screen (CRM invent not started)
- Insights / Analytics charts (nav chrome only)
- Full Outreach/Mailbox visual RC1 pass (functional workspace remains)
- Affiliate / Billing / Settings / Admin V2 restyles
- Notification center / API docs links (chrome only)

---

## Visual differences from RC1

| RC1 | Implemented | Why |
|-----|-------------|-----|
| People leads (name/title/company/tags) | Business leads columns | Product data model |
| AI Growth / Tech Stack / Funding / Sync CRM | Not built | Would invent features + APIs |
| Opening hours value | Field shown as **Not available from this search** | Not in `BusinessLead` / backend payload |
| “Add to Campaign” CRM | Mapped to **Add to Outreach** (existing send panel) | Preserve behaviour |
| “Generate Outreach” AI templates | Opens existing outreach compose / selection | No new AI endpoint |
| “Save Lead” list DB | Sets status → `interested` + toast | No list API yet |
| Insights ROI dashboard | Nav item only | No fake metrics |
| LeadGen Pro naming in some Stitch frames | LeadThur V2 | Correct brand |

---

## Accessibility improvements

- Cyan focus rings on primitives and table controls
- Checkbox + row `aria-label`s for selection
- Details panel labelled; mobile dialog titled for SR
- Bulk bar `role="region"`
- Status communicated via badge text + color (not color alone)
- Keyboard-friendly buttons for copy / open actions

---

## Responsive improvements

| Breakpoint | Behaviour |
|------------|-----------|
| ≥1440 / 1920 | Table + sticky details panel (380–400px) |
| Tablet ~1024 | Icon sidebar; details as right drawer overlay |
| Mobile ≤768 | Bottom tabs; card results; details as dialog/sheet |
| Search card | Row on desktop, stacked on mobile |

---

## Performance observations

- Virtualization retained for >100 rows (`estimateSize: 48`)
- Framer row mount animations removed from table (faster scan)
- Client-side table filter memoized (no extra network)
- Search SSE / job streaming paths untouched
- Details panel sticky; avoids re-mounting full dashboard on row click

---

## QA screenshots

| Viewport | File |
|----------|------|
| Desktop ~1440 | `docs/product-v2/screens/qa-discovery-desktop-1440.png` |
| Tablet ~1024 | `docs/product-v2/screens/qa-discovery-tablet-1024.png` |
| Mobile ~390 | `docs/product-v2/screens/qa-discovery-mobile-390.png` |
| RC1 reference | `docs/product-v2/screens/rc1-discovery-workspace.png` |

> Screenshots are visual QA references of the implemented Discovery language aligned to RC1. Live staging pixel-diff still recommended after deploy.

---

## Verification

- `npx tsc --noEmit` — pass  
- ESLint on Discovery touchpoints — pass  
- Backend / auth / scrape / outreach APIs — unchanged  

---

## Outstanding polish (non-blocking)

1. Live staging pixel QA against authenticated session  
2. Recent Searches / Search History panels — deeper token pass  
3. Outreach mailbox inner panels still partially legacy chrome  
4. Tablet drawer backdrop click-outside dismiss polish  
5. Optional column resize (not previously shipped; deferred)
