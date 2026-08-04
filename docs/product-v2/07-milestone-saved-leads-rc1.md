# LeadThur V2 — Milestone Report  
## RC1 Saved Leads Workspace

**Branch:** `staging`  
**Commit message:** `feat(v2): complete RC1 Saved Leads Workspace`  
**Date:** 2026-08-04  
**Route:** `/dashboard/saved`

---

## Summary

Saved Leads Workspace organizes businesses the user has already touched via the existing **lead status** system, with **search history** as Saved Lists. Visual language inherits frozen Discovery (AppShell, ResultsTable, details panel, bulk bar, tokens). No CRM invent.

---

## Components completed

| Component | Path | Notes |
|-----------|------|-------|
| SavedLeadsWorkspace | `frontend/components/saved/saved-leads-workspace.tsx` | Screen composition |
| useSavedLeads | `frontend/hooks/useSavedLeads.ts` | Hydrate statuses + search results |
| saved-leads helpers | `frontend/lib/saved-leads.ts` | Partial lead + list mapping |
| Saved page | `frontend/app/dashboard/saved/page.tsx` | AppShell + license gate |

### Reused from Discovery / V2 system
- `AppShell`, `AppSidebar`, `AppTopNav`
- `DiscoveryWorkspaceHeader`, `DiscoveryBulkBar`, `DiscoveryResultsLayout`, `BusinessDetailsPanel`
- `ResultsTable`, `EmptyState`, `Alert`, `Skeleton`, `Chip`, `Button`, `Toast`
- `useLeadStatuses`, `useOutreach`, `OutreachSendPanel`, `exportToCSV`

### Nav
- Sidebar **Saved Leads** → `/dashboard/saved`
- Mobile bottom tab **Saved** → `/dashboard/saved`

---

## Components still pending
- Dedicated tag system (not in backend)
- Outreach / Mailbox / Insights / Billing / Admin full RC1 restyles
- Creating arbitrary custom lists beyond search history (no list CRUD API)

---

## Backend mapping (no invent)

| UI concept | Existing capability |
|------------|---------------------|
| Saved businesses | `GET/POST /lead-status` |
| Status updates | Existing status enum + `useLeadStatuses` |
| Saved Lists | `GET /search/history` (past searches) |
| Enrich row (email, rating, website) | Hydrate via `GET /search/:id/results` when `search_id` present |
| Export | Existing `exportToCSV` |
| Outreach | Existing `OutreachSendPanel` + mailbox flow |
| Tags | **Not supported** — UI documents absence; no fake tag editor |

---

## Visual differences from Discovery / RC1

| Item | Notes |
|------|-------|
| Left “Saved lists” column | Discovery doesn’t have this in-content rail; needed for organization |
| Tags column / chips | Omitted — backend has no lead tags |
| Empty state CTA | Points to Discovery to save businesses |
| Partial rows | Status-only records without hydrated search data show name/phone/address |

---

## Accessibility
- List filter buttons with clear selected state (cyan)
- Reused table/details a11y from Discovery
- Error alert with retry
- Toasts for export, status, outreach

## Responsive
- Desktop: lists rail + table + sticky details
- Tablet: lists + table; details drawer (via DiscoveryResultsLayout)
- Mobile: results first, compact lists below; card table path; bottom nav

## Performance
- Hydrates up to 25 unique `search_id`s, 200 results each (capped)
- Parallel `Promise.all` for hydration fetches
- Client filter/search memoized

---

## QA screenshots

| Viewport | File |
|----------|------|
| Desktop | `docs/product-v2/screens/qa-saved-leads-desktop-1440.png` |
| Tablet | `docs/product-v2/screens/qa-saved-leads-tablet-1024.png` |
| Mobile | `docs/product-v2/screens/qa-saved-leads-mobile-390.png` |

---

## Verification
- `tsc --noEmit` — pass  
- ESLint on Saved Leads touchpoints — pass  
- Backend unchanged  

---

## Outstanding polish
1. Live staging QA with real license + statuses  
2. Paginate hydration beyond 200 results per search  
3. Optional notes display from `lead_statuses.notes` (field exists; not tagged UI)
