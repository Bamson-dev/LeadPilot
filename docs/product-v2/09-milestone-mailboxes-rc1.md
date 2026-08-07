# LeadThur V2 — Milestone Report  
## RC1 Mailboxes Workspace

**Branch:** `staging`  
**Commit message:** `feat(v2): complete RC1 Mailboxes Workspace`  
**Date:** 2026-08-05  
**Route:** `/dashboard/mailboxes`  
**Deep link:** `?connect=1` opens the Gmail connect flow

---

## Summary

Mailboxes Workspace is the central place to manage Gmail sending accounts. It uses only existing mailbox APIs (`GET /mailboxes`, `POST /mailboxes/connect`, `DELETE /mailboxes/:id`) and reuses RC1 AppShell, Discovery header chrome, panels, badges, progress, and the guided connect flow. No new providers, warm-up trackers, or settings APIs were invented.

---

## Components completed

| Component | Path | Notes |
|-----------|------|-------|
| MailboxesPageWorkspace | `frontend/components/mailboxes/mailboxes-page-workspace.tsx` | Screen composition |
| MailboxListTable | `frontend/components/mailboxes/mailbox-list-table.tsx` | Desktop table + mobile cards |
| MailboxDetailsPanel | `frontend/components/mailboxes/mailbox-details-panel.tsx` | Status, health, limits, actions |
| mailbox-display helpers | `frontend/lib/mailbox-display.ts` | Status/health labels, usage % |
| Mailboxes page | `frontend/app/dashboard/mailboxes/page.tsx` | AppShell + license gate |

### Reused (frozen / V2)
- `AppShell`, `AppSidebar`, `AppTopNav`
- `DiscoveryWorkspaceHeader`
- `OutreachGuidedMailboxConnect` (+ optional prefill for reconnect)
- `Panel`, `Chip`, `Progress`, `StatusBadge`, `Alert`, `EmptyState`, `Skeleton`, `Dialog`, `Button`, `Toast`
- `useOutreach`, `disconnectMailbox`, `connectMailbox`

### Nav
- Sidebar **Mailbox** → `/dashboard/mailboxes`
- Mobile bottom tab **Mailbox** → `/dashboard/mailboxes`
- Legacy `?view=mailbox` → redirect to `/dashboard/mailboxes`
- `requestMailboxesTab()` → navigates to dedicated workspace

---

## Backend mapping (no invent)

| UI concept | Existing capability |
|------------|---------------------|
| Mailbox list | `GET /mailboxes` |
| Connection status | `status`: `active`, `paused_bounce`, `error` |
| Health indicators | Derived from status, `last_error`, daily usage % |
| Daily limits | `daily_cap`, `daily_send_count`, `daily_count_reset_at` |
| Last activity | `last_verified_at` (SMTP verify on connect) |
| Connection errors | `last_error` |
| Connect / test | SMTP verify on `POST /mailboxes/connect` only |
| Reconnect | Same connect flow (optional email prefill) |
| Disconnect | `DELETE /mailboxes/:id` |
| Account type setting | `personal` / `workspace` at connect time |
| Warm-up information | **Not in backend** — omitted; copy explains honestly |
| Outlook, Microsoft 365, custom SMTP | **Not supported** — Gmail only |

---

## Component reuse report

| Need | Source | Duplicated? |
|------|--------|-------------|
| Page shell + license gate | Saved/Outreach page pattern | No |
| Workspace header + search | `DiscoveryWorkspaceHeader` | No |
| Connect wizard | `OutreachGuidedMailboxConnect` | No |
| Status chips | `StatusBadge` | No |
| Daily usage bar | `Progress` | No |
| List container | `Panel` + custom table (mailbox-specific columns) | New table only where no generic fit |
| Details layout | `MailboxDetailsPanel` (new, mirrors BusinessDetailsPanel density) | Composed from existing primitives |
| Data fetching | `useOutreach` | No |

Outreach embedded **Mailboxes** tab (frozen) remains unchanged for in-context access.

---

## Accessibility report

- Mailbox table rows are keyboard-focusable with `Enter`/`Space` selection
- Progress bars expose `aria-label` for daily usage
- Status badges include visible text labels (not color-only)
- Error and paused states use `Alert` with titles and descriptions
- Mobile details open in `Dialog` with screen-reader title
- Connect form retains labeled inputs from guided connect flow
- Toasts announce connect, disconnect, and limit messages

---

## Performance observations

- Reuses `useOutreach` — single parallel fetch for balance + mailboxes (same as Outreach)
- List filtering is client-side memoized (`filterQuery`)
- Details panel renders only for selected mailbox; no N+1 API calls
- Connect wizard mounts on demand when user opens connect/reconnect
- No additional polling; user-triggered refresh only

---

## QA screenshots

| Viewport | File |
|----------|------|
| Desktop | `docs/product-v2/screens/qa-mailboxes-desktop-1440.png` |
| Tablet | `docs/product-v2/screens/qa-mailboxes-tablet-1024.png` |
| Mobile | `docs/product-v2/screens/qa-mailboxes-mobile-390.png` |

---

## Quality gates

| Gate | Result |
|------|--------|
| Design | RC1 tokens, spacing, typography; no invented widgets |
| Engineering | `tsc --noEmit` pass; ESLint pass on touchpoints |
| Accessibility | Keyboard table, alerts, dialog, labeled progress |
| Performance | Reuses existing hook; no extra endpoints |
| Product | Honest Gmail-only scope; warm-up not faked |

---

## Verification
- `tsc --noEmit` — pass  
- ESLint on Mailboxes touchpoints — pass  
- Backend unchanged  

---

## Outstanding polish
1. Live staging QA with real Gmail connect/disconnect  
2. Optional deep-link `?mailbox=<id>` for shareable detail selection  
3. Insights / Billing RC1 restyles (separate milestones)
