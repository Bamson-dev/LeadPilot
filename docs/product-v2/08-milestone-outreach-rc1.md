# LeadThur V2 — Milestone Report  
## RC1 Outreach Workspace

**Branch:** `staging`  
**Commit message:** `feat(v2): complete RC1 Outreach Workspace`  
**Date:** 2026-08-05  
**Route:** `/dashboard/outreach`  
**Deep links:** `?tab=sends`, `?tab=mailboxes`

---

## Summary

Outreach Workspace continues Discovery and Saved Leads in the same AppShell and visual language. Operators pick recipients from saved businesses with email, compose via the existing send panel (mailbox, templates, draft, preview, follow-up gap days, send), then track batches in Send history and manage Gmail mailboxes — all without inventing Campaign CRUD, CRM, or fake analytics.

---

## Components completed

| Component | Path | Notes |
|-----------|------|-------|
| OutreachPageWorkspace | `frontend/components/outreach/outreach-page-workspace.tsx` | Screen composition + URL tab sync |
| Outreach page | `frontend/app/dashboard/outreach/page.tsx` | AppShell + license gate |
| OutreachTopBar | `frontend/components/dashboard/outreach-top-bar.tsx` | V2 restyle (balance / mailbox) |
| OutreachSendsReport | `frontend/components/dashboard/outreach-sends-report.tsx` | V2 restyle (send history + opens) |
| OutreachMailboxSection | `frontend/components/dashboard/outreach-mailbox-section.tsx` | V2 restyle |
| OutreachGuidedMailboxConnect | `frontend/components/dashboard/outreach-guided-mailbox-connect.tsx` | V2 restyle |
| OutreachSendPanel | `frontend/components/dashboard/outreach-send-panel.tsx` | V2 restyle (compose drawer) |
| OutreachSendSuccessBanner | `frontend/components/dashboard/outreach-send-success-banner.tsx` | V2 success tokens |
| OutreachBalanceBanner | `frontend/components/dashboard/outreach-balance-banner.tsx` | V2 restyle |

### Reused from Discovery / Saved / V2 system
- `AppShell`, `AppSidebar`, `AppTopNav`
- `DiscoveryWorkspaceHeader`, `DiscoveryBulkBar`, `DiscoveryResultsLayout`, `ResultsTable`
- `Button`, `Tabs`, `Panel`, `Chip`, `Alert`, `EmptyState`, `Skeleton`, `StatusBadge`, `Toast`
- `useSavedLeads`, `useLeadStatuses`, `useOutreach`, `exportToCSV`

### Nav
- Sidebar **Outreach** → `/dashboard/outreach`
- Sidebar **Mailbox** → `/dashboard/outreach?tab=mailboxes`
- Mobile bottom tabs updated to the same routes
- Legacy `?view=outreach` / `?view=mailbox` redirect from dashboard gate

---

## Backend mapping (no invent)

| UI label | Existing capability |
|----------|---------------------|
| “Campaign list” / Send history | `GET` sends report + open tracking (batch sends + follow-ups) |
| Compose workspace | Existing `OutreachSendPanel` + `POST /send` |
| Recipient table | Saved leads with email (`/lead-status` + search hydration) |
| Mailbox selector | Connected Gmail mailboxes API |
| Email editor / templates / AI draft / preview | Existing panel + generate-email + system templates |
| Schedule controls | Follow-up steps with `gap_days` (≥ 2) at compose time |
| Send controls / balance | Existing queue send + outreach balance |
| Campaign status | Per-send statuses in sends report (queued / sent / opened / etc.) |
| Named Campaign CRUD, absolute calendar schedule, reply sentiment, pipeline | **Not supported** — not invented |

---

## Accessibility
- Tablist for Compose / Send history / Mailboxes
- Reused table/details a11y from Discovery
- Success banner `role="status"` + `aria-live="polite"`
- Error alerts with retry on recipient load
- Focus rings via V2 button/input tokens (`--lt-cyan`)
- Toasts for queue success, empty selection, missing mailbox

## Responsive
- Desktop: shell + recipients table + sticky details; compose as drawer/panel
- Tablet: denser table; same tabs and compose flow
- Mobile: card table path, wrapping tabs, bottom nav to Outreach / Mailbox

## Performance
- Recipients hydrate via existing `useSavedLeads` caps (same as Saved Leads)
- Sends report loads when tab is active (`isActive`)
- Compose panel mounts only when opened; mailbox refresh on demand
- Client filter/selection memoized

## Component reuse summary
- **No duplicate** ResultsTable, details panel, shell, or send APIs
- Dedicated page workspace only composes frozen Discovery chrome + existing outreach modules
- Visual-only restyles on legacy outreach components; behaviour preserved

---

## QA screenshots

| Viewport | File |
|----------|------|
| Desktop | `docs/product-v2/screens/qa-outreach-desktop-1440.png` |
| Tablet | `docs/product-v2/screens/qa-outreach-tablet-1024.png` |
| Mobile | `docs/product-v2/screens/qa-outreach-mobile-390.png` |

Note: screenshots illustrate RC1 layout/language; live UI labels Send history (not a separate Campaign entity) and omits invented analytics/CRM from older Stitch mocks.

---

## Verification
- `tsc --noEmit` — pass  
- ESLint on Outreach touchpoints — pass  
- Backend unchanged  

---

## Outstanding polish
1. Live staging QA with real license, mailbox, and sends  
2. Optional redirect UX polish when opening compose with zero selection  
3. Insights / Billing / Admin RC1 restyles (separate milestones)
