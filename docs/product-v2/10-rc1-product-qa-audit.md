# LeadThur V2 — RC1 Product QA & Design System Audit

**Branch:** `staging`  
**Commit message:** `chore(v2): RC1 product QA and design system audit`  
**Date:** 2026-08-05  
**Scope:** Frozen modules only — Design System, App Shell, Discovery, Saved Leads, Outreach, Mailboxes  
**Constraints:** No redesign, no new features, no backend changes. Low-risk consistency fixes only.

---

## Executive summary

V2 workspaces correctly share AppShell, Discovery chrome, ResultsTable, StatusBadge, and outreach primitives. The main quality gaps were **token leakage in shared table cells / Discovery history panels**, **redundant Home+Discovery mobile tabs**, a **dead Insights link**, **duplicate save toasts**, and **seven unused V1 files**. Those were fixed in this pass without changing user workflows.

---

## 1. Component reuse audit

| Shared asset | Consumers |
|--------------|-----------|
| `AppShell` / `AppSidebar` / `AppTopNav` | Discovery, Saved, Outreach, Mailboxes, search results |
| `DiscoveryWorkspaceHeader`, `DiscoveryBulkBar`, `DiscoveryResultsLayout` | Discovery, Saved, Outreach |
| `ResultsTable` + `BusinessDetailsPanel` | Discovery, Saved, Outreach |
| `StatusBadge`, `Panel`, `Chip`, `Alert`, `EmptyState`, `Progress`, `Tabs` | All frozen workspaces |
| `OutreachSendPanel`, `useOutreach` | Saved, Outreach, Discovery |
| `OutreachGuidedMailboxConnect` | Outreach tab, Mailboxes workspace |
| `mailbox-display` helpers | Mailbox list + details + outreach mailbox section |

**Verdict:** Reuse is strong. No new parallel table or shell implementations were introduced during RC1.

---

## 2. Duplicate component audit

| Finding | Status after QA |
|---------|-----------------|
| Dedicated Outreach page vs embedded `OutreachWorkspace` in Discovery | Documented debt (P2) — left intact to avoid workflow change |
| Mailboxes page vs Outreach “Mailboxes” tab | Kept both; tab links to full workspace; section uses StatusBadge |
| Status mapping in details / table / mobile cards | Still duplicated — P2 extract |
| Page bootstrap (license + credits) on 3 routes | Still duplicated — P2 shared layout |
| Unused V1: `leads-table`, `export-modal`, `outreach-balance-banner`, `outreach-section`, `results-outreach-shell`, `navbar`, `footer` | **Removed** |

---

## 3. Design consistency audit

### Before
- Shared cells (`copy-button`, `email-cell`, `website-link`) used V1 purple/green hex
- Embedded outreach tabs used `#A855F7` / `#F4F4FF`
- History panels used `glass` + Bricolage + hex
- Live counter / summary bar / queue card used violet/zinc
- Mailbox paused state used raw amber Tailwind instead of `--lt-warning` + StatusBadge

### After (this commit)
- Table cells, website links, copy buttons → `--lt-*` tokens + hover consistency
- Outreach embedded tabs → accent / surface tokens
- History panels, region chips, queue card, contact dots → tokens
- Mailbox section → Alert + StatusBadge + link to `/dashboard/mailboxes`
- Typography: mailbox section title `font-bold` → `font-semibold` to match RC1 scale

---

## 4. Navigation audit

| Issue | Fix |
|-------|-----|
| Home + Discovery both matched `/dashboard` | Discovery match limited to `/dashboard/search*` |
| Mobile duplicate Home + Discovery | Removed Home from bottom tabs (Discovery remains) |
| Dead Insights link | Removed from sidebar |
| Dead “New list” button | Replaced with “Find leads” → `/dashboard` |
| Search results `activeNav="workspace"` | Corrected to `discovery` |
| Notifications button non-functional | Disabled + honest tooltip |

Routes for Outreach / Mailboxes / Saved remain correct. Legacy `?view=outreach|mailbox` redirects preserved.

---

## 5. Responsive audit

| Surface | Pattern | Notes |
|---------|---------|-------|
| Shell | Sidebar md+, icon rail mid, mobile bottom tabs | OK after tab cleanup |
| Details | Sticky desktop / drawer tablet / dialog mobile | Consistent via `DiscoveryResultsLayout` |
| Mailboxes | Table + panel desktop; cards + dialog mobile | OK; progress now labeled |
| Outreach tabs | Horizontal scroll / wrap | OK |

**Remaining (P2):** Tablet drawer + sidebar can feel tight near 1024px — no layout change in this pass.

---

## 6. Accessibility audit

| Area | Result |
|------|--------|
| StatusBadge | Text + color (not color-only) |
| Mailbox row keyboard | Enter/Space select preserved |
| Daily usage Progress | `aria-label` on list rows |
| CopyButton | `aria-label` added |
| Notifications | Disabled instead of silent no-op |
| Duplicate “Lead saved” toast | Layout no longer double-toasts; parents toast once |
| Embedded outreach custom tabs | Still custom (not `ui/tabs`) — P2 |

---

## 7. Performance observations

- `useSavedLeads` hydration cap (25 × 200) unchanged — acceptable for RC1
- ResultsTable virtualization retained for large lists
- Sends report gated by `isActive`
- Compose / connect panels mount on demand
- Each route still re-fetches license + history (P2 shared shell data)

No performance regressions introduced by token/class cleanup.

---

## 8. Technical debt (remaining)

1. Discovery still embeds full `OutreachWorkspace` (parallel to dedicated Outreach route)
2. Outreach Mailboxes tab still embeds `OutreachMailboxSection` alongside `/dashboard/mailboxes`
3. Lead status → StatusBadge mapping triplicated
4. Saved / Outreach / Mailboxes page bootstrap duplication
5. WhatsApp template modal still V1-styled (out of frozen chrome scope; larger restyle)
6. Demo recording dashboard still V1 violet language (recording-only)
7. Unused DS exports: `SectionHeader`, `Pagination`, `RadioGroup`, `Switch` (keep for future)

---

## 9. Recommended cleanup tasks

### Done in this commit (P0)
- [x] Tokenize shared table cells and Discovery chrome leak points
- [x] Fix nav active rules / remove dead Insights / mobile Home duplicate
- [x] Fix search-result activeNav
- [x] Deduplicate save toast path
- [x] StatusBadge + warning tokens on mailbox section
- [x] Disable non-functional notifications control
- [x] Delete seven unused V1 files
- [x] Update verify scripts referencing deleted shell

### P1 (safe, later)
- Restyle WhatsApp modal to tokens
- Extract `lib/lead-status-display.ts`
- Docs: update Outreach milestone mailbox URL if still stale

### P2 (workflow-sensitive — do not do casually)
- Decouple Discovery from embedded `OutreachWorkspace`
- Deep-link Outreach Mailboxes tab to `/dashboard/mailboxes` only
- Shared licensed AppShell layout helper

---

## 10. Components safe to remove from V1 (removed)

| Path | Reason |
|------|--------|
| `frontend/components/dashboard/leads-table.tsx` | Superseded by ResultsTable |
| `frontend/components/dashboard/export-modal.tsx` | Unused |
| `frontend/components/dashboard/outreach-balance-banner.tsx` | Superseded by OutreachTopBar |
| `frontend/components/dashboard/outreach-section.tsx` | Deprecated re-export |
| `frontend/components/dashboard/results-outreach-shell.tsx` | Deprecated re-export |
| `frontend/components/navbar.tsx` | Unused |
| `frontend/components/footer.tsx` | Unused (marketing has its own Footer) |

**Not removed:** `outreach-workspace.tsx`, history panels, WhatsApp modal, affiliate section — still wired into Discovery.

---

## Low-risk improvements applied

1. Nav consistency (sidebar match, mobile tabs, Insights removal, Find leads link)
2. Token swaps across shared ResultsTable cells and Discovery surfaces
3. Outreach embedded tab chrome tokens
4. Mailbox section StatusBadge / warning Alert / workspace link
5. Toast ownership fix (single success toast)
6. Search results Discovery active state
7. Notifications control honesty
8. Dead V1 file removal + script updates

**Workflows unchanged:** search → save → outreach compose → send history → mailbox connect/disconnect.

---

## QA screenshots

| Viewport | File |
|----------|------|
| Desktop (shell / discovery language) | `docs/product-v2/screens/qa-rc1-audit-desktop-1440.png` |
| Tablet | `docs/product-v2/screens/qa-rc1-audit-tablet-1024.png` |
| Mobile | `docs/product-v2/screens/qa-rc1-audit-mobile-390.png` |

Also retain prior module screenshots under `docs/product-v2/screens/qa-{discovery,saved-leads,outreach,mailboxes}-*`.

---

## Verification

- `tsc --noEmit` — pass  
- ESLint on touched shell / cell / mailbox files — pass  
- Backend unchanged  

---

## Quality gates

| Gate | Result |
|------|--------|
| Design | Pass — token consistency improved on shared paths |
| Engineering | Pass — dead code removed; scripts updated |
| Accessibility | Pass — labels, disabled control, single toast |
| Performance | Pass — no new fetches or remounts |
| Product | Pass — no invented features; workflows preserved |
