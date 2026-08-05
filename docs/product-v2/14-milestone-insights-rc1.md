# LeadThur V2 — Milestone Report  
## RC1 Insights (Analytics) Workspace

**Branch:** `staging`  
**Date:** 2026-08-05  
**Route:** `/dashboard/insights`  
**Deep link:** `?view=insights` → redirects to `/dashboard/insights`

---

## Summary

Insights is a **diagnostic** workspace: live search credits, outreach send totals / open rate, mailbox daily health, and recent search/send lists. It reuses the frozen App Shell and Discovery header chrome. It does **not** implement the RC1 “Advanced Analytics” ROI mock (`screens/rc1-analytics.png`).

---

## Components completed

| Component | Path | Notes |
|-----------|------|-------|
| InsightsPageWorkspace | `frontend/components/insights/insights-page-workspace.tsx` | KPI strip + panels |
| Insights page | `frontend/app/dashboard/insights/page.tsx` | AppShell + license gate |

### Reused (frozen / V2)

- `AppShell`, `AppSidebar`, `AppTopNav` (Insights nav + top-bar shortcut only)
- `DiscoveryWorkspaceHeader`
- `Panel`, `Alert`, `EmptyState`, `Skeleton`, `Button`, `Progress`, `StatusBadge`
- `mailbox-display` helpers
- `getLicenseUsage`, `getSearchHistory`, `fetchOutreachBalance`, `fetchSendsReport`, `fetchMailboxes`

### Nav

- Sidebar **Insights** → `/dashboard/insights`
- Top nav chart icon → `/dashboard/insights` (mobile access without a sixth bottom tab)
- Legacy `?view=insights` → `/dashboard/insights`

Frozen Discovery / Saved / Outreach / Mailboxes workspaces were **not** redesigned.

---

## Backend mapping (no invent)

| UI concept | Existing capability |
|------------|---------------------|
| Search credits KPI | `GET /auth/usage` → `search_credits`, free/credit remaining |
| Searches used | `searches_used` / `monthly_search_limit` |
| Send balance KPI | `GET /balance` → `send_balance`, mailbox counts, status |
| Open rate KPI | `GET /sends` → `summary.open_rate`, `total_sent`, `total_opened`, `in_progress` |
| Search usage panel | Same `/auth/usage` |
| Outreach sends panel | Same `/sends` summary + balance buckets |
| Mailbox health | `GET /mailboxes` + client health/usage % (same as Mailboxes) |
| Recent searches | `GET /search/history` |
| Recent sends | `GET /sends?limit=8` |

---

## Known differences from RC1 mock

| RC1 mock | This build | Reason |
|----------|------------|--------|
| Title “Advanced Analytics” / “Real-time ROI…” | “Insights” / diagnostic subtitle | Brand strategy: no vanity ROI |
| Search Efficiency % + trend | Omitted | No efficiency / time-series API |
| Outreach Conversion / reply rate | Omitted | No sequence conversion API; replies are manual marks |
| Credit ROI $ | Omitted | No cost-per-lead model |
| Mailbox open vs reply bar chart by domain | Daily usage + health list only | No per-mailbox time-series |
| Lead sources by industry + ROI badges | Omitted | No industry attribution API |
| Platform activity log (credit deltas) | Recent searches + recent sends | No user credit ledger API |
| Export Report | Omitted | No analytics export endpoint |
| “Live Data” badge | Refresh button | Honest refresh of existing endpoints |

---

## Accessibility

- Page title / subtitle via existing header pattern
- KPI region `aria-label="Summary"`
- Progress bars labeled for monthly search and per-mailbox daily usage
- Loading skeleton `aria-busy`
- Status badges use existing status tokens
- Top-nav Insights control has `aria-label`
- Responsive: KPI 1→2→4 columns; panels stack on mobile; list rows wrap

---

## Responsive QA checklist

| Viewport | Expected |
|----------|----------|
| Mobile (~375) | Header + stacked KPIs; panels full width; top-nav Insights icon reachable |
| Tablet (~768) | 2-col KPI / panels; sidebar may collapse |
| Desktop (≥1280) | Full sidebar; 4 KPI; 2-col panels |

**Screenshots:** Place under `docs/product-v2/screenshots/insights-*.png` after SSO/local license session (staging Deployment Protection blocks unauthenticated capture).

---

## QA notes

1. License required; unauthenticated → `/activate`.
2. Empty mailbox / send / history states use `EmptyState` with links into frozen workspaces.
3. Send fetch failure does not fail the whole page (other panels still load).
4. Numbers only from API fields — no invented percentages.

---

## Next modules (priority)

1. ~~Analytics / Insights~~  
2. Affiliate (first-class route)  
3. Billing  
4. Settings  
5. Admin  
