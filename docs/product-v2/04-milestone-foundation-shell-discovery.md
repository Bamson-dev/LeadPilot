# LeadThur V2 — Milestone Report  
## Foundation + Shell + Discovery (partial)

**Branch:** `staging`  
**Date:** 2026-08-04  
**Scope completed:** Phase 1 (Design System), Phase 2 (App Shell), Phase 3.1 Discovery (partial — chrome + wiring, table deep restyle outstanding)

---

## Files created

### Design system (`frontend/components/ui/`)
- `label.tsx`, `textarea.tsx`, `checkbox.tsx`, `radio-group.tsx`, `switch.tsx`
- `select.tsx`, `badge.tsx`, `chip.tsx`, `tabs.tsx`, `tooltip.tsx`
- `dropdown-menu.tsx`, `separator.tsx`, `avatar.tsx`, `skeleton.tsx`
- `alert.tsx`, `toast.tsx`, `pagination.tsx`, `empty-state.tsx`
- `search-input.tsx`, `panel.tsx`, `section-header.tsx`, `status-badge.tsx`
- `index.ts` (barrel)

### Shell (`frontend/components/shell/`)
- `app-shell.tsx`
- `app-sidebar.tsx`
- `app-top-nav.tsx`
- `index.ts`

### Discovery chrome (`frontend/components/discovery/`)
- `discovery-workspace-header.tsx`
- `discovery-bulk-bar.tsx`

### Docs
- `docs/product-v2/03-rc1-engineering-map.md`
- `docs/product-v2/screens/rc1-*.png` (archived Stitch RC1 references)
- `docs/product-v2/04-milestone-foundation-shell-discovery.md` (this file)

---

## Files modified

- `frontend/styles/globals.css` — RC1 design tokens (`--lt-*`)
- `frontend/components/ui/button.tsx` — RC1 variants (default/cyan/soft/outline/ghost/destructive/success)
- `frontend/components/ui/input.tsx` — RC1 input
- `frontend/components/ui/dialog.tsx` — RC1 modal
- `frontend/components/ui/progress.tsx` — token colors
- `frontend/components/dashboard/dashboard-gate.tsx` — AppShell instead of Navbar/Footer
- `frontend/components/dashboard/search-dashboard.tsx` — Discovery header, bulk bar, alerts, client-side result filter
- `frontend/app/dashboard/search/[searchId]/page.tsx` — AppShell
- `frontend/package.json` / lockfile — Radix primitives + sonner

---

## Components added
Full V2 primitive set + AppShell / Sidebar / TopNav + Discovery header / bulk bar.

## Components reused
- Existing `SearchDashboard` search engine hooks (`useSearch`, `useOutreach`, `useLeadStatuses`)
- `ResultsTable`, `OutreachWorkspace`, export CSV, license APIs — **unchanged behaviour**
- `Button` / `Input` / `Dialog` / `Progress` upgraded in place (legacy `glow` alias retained)

## Components deprecated (not deleted yet)
- `components/navbar.tsx`, `components/footer.tsx` — replaced on dashboard + search result routes; still used on some marketing/legal pages
- Orphan dashboard files from inventory (ExportModal, LeadsTable, etc.) — untouched this milestone

---

## Performance
- Shell credits / recent activity fetched once at gate
- Client table filter via `useMemo` (no extra API calls)
- No change to SSE / search job streaming paths

## Accessibility
- Cyan focus rings on primitives
- Sidebar `aria-current`, bulk bar `role="region"`
- Mobile bottom nav with clear active state
- Alert roles for search errors/success

## Responsive behaviour
- Desktop sidebar 240px; collapses to icon rail &lt;1280
- Mobile bottom tabs (Home / Discovery / Workspace / Outreach / Mailbox / Account)
- Discovery header stacks on small screens

---

## Known differences from RC1

| RC1 | Implementation | Reason |
|-----|----------------|--------|
| People leads table (name/title/company/tags) | Business leads table (existing columns) | Product is business discovery — behaviour preserved |
| Sync CRM / AI Growth Intelligence / Tech Stack / Funding | Not implemented | Would invent features + backend |
| Insights analytics ROI charts | Nav present; no fake charts | No inventing metrics |
| “New Lead” / Campaign pipelines as CRM | Not implemented | Out of scope; outreach kept |
| LeadGen Pro branding in some Stitch frames | LeadThur V2 branding | Correct product name |
| Purple+cyan RC1 palette | Adopted via `--lt-*` tokens | Visual source of truth |
| Previous teal brand strategy | Superseded by RC1 for product UI | Per engineering directive |

---

## Technical debt introduced
- Dashboard content still mixes legacy violet/inline styles inside outreach/results children
- `view=` query params for nav not yet fully routed to focused subviews (outreach/mailbox tabs still inside SearchDashboard)
- Notifications / API sidebar links are chrome-only
- “New list” button is non-functional placeholder (no new list API)
- Legacy Navbar/Footer duplication on non-dashboard routes

---

## Outstanding polish (before declaring Discovery complete)
1. Restyle `ResultsTable` rows/headers to RC1 density, status badges, sticky header
2. Restyle `OutreachSearchBox` / mailbox panels to RC1 cards
3. Business details drawer matching RC1 dossier **using real business fields only**
4. Wire `?view=outreach|mailbox` to open correct OutreachWorkspace tab
5. Remove remaining hardcoded violet/inline styles in search-dashboard children
6. Full visual QA vs `rc1-discovery-workspace.png` at 1440/1600/1920
7. Mobile card results path polish vs `rc1-mobile-home.png` / outreach mobile

**Do not start Saved Leads / Campaigns / Analytics screens until Discovery table + details pass RC1 visual QA.**

---

## Verification
- `npx tsc --noEmit` — pass
- ESLint on touched shell/discovery/gate files — pass
- Backend / DB / auth — unchanged
