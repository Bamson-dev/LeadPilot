# LeadThur V2 — Phase 1.1  
## Discovery Workspace Refinement (Production Ready)

**Roles:** Lead Product Designer · UX Architect · Senior SaaS Designer · Frontend Architect  
**Baseline:** Attached Discovery Workspace mockup (`screens/00-baseline-discovery-workspace.png`)  
**Brand north star:** `01-brand-strategy.md`  
**Status:** Production design specification — refine, do not reinvent  

This document turns the baseline mockup into a launch-ready enterprise Discovery experience. Layout structure is preserved. Execution is perfected. Scope stays inside: **discover → organize → contact → outreach → export**.

---

## 0. Screen index

| # | Deliverable | File |
|---|-------------|------|
| 0 | Baseline (reference) | `screens/00-baseline-discovery-workspace.png` |
| 1 | Desktop Discovery Workspace | `screens/01-desktop-discovery-workspace.png` |
| 2 | Tablet Discovery Workspace | `screens/02-tablet-discovery-workspace.png` |
| 3 | Mobile Discovery Workspace | `screens/03-mobile-discovery-workspace.png` |
| 3b | Mobile Details Bottom Sheet | `screens/03b-mobile-details-sheet.png` |
| 4 | Business Details Panel | `screens/04-business-details-panel.png` |
| 5 | Search States | `screens/05-search-states.png` |
| 6–7 | Loading + Empty States | `screens/06-07-loading-empty-states.png` |
| 8 | Bulk Selection | `screens/08-bulk-selection.png` |
| 9 | Error + Success States | `screens/09-error-success-states.png` |
| 10 | Design System Preview | `screens/10-design-system-preview.png` |

---

## 1. What we kept from the baseline

Unchanged information architecture:

1. Left sidebar navigation  
2. Top utility header (global search, credits, notifications, avatar)  
3. Signature discovery search strip  
4. Filter row + saved/recent chips  
5. Results table as the hero  
6. Right business details panel on selection  
7. Floating bulk action toolbar  

**Do not redesign this skeleton.**

---

## 2. What we corrected from the baseline

The baseline is strong structurally. These refinements make it LeadThur — not an Apollo lookalike with invented CRM weight.

### 2.1 Scope pruning (no invented product)

| Baseline element | Decision | Reason |
|------------------|----------|--------|
| Employees / Revenue filters | **Remove** | Sales intelligence invent — not LeadThur |
| Campaigns / Templates nav | **Defer / remove from Phase 1.1** | Outreach + Mailbox cover contact workflows |
| Analytics nav | **Defer** | Not required for discovery core |
| Notes tab in details | **Remove** | CRM creep |
| Activity tab | **Keep light** | Contact/outreach history only — not CRM timeline |
| Grid view toggle | **Defer** | Table is the product; grid is noise for Phase 1.1 |
| “Generate Outreach (New)” badge theatrics | **Calm** | Keep action; drop hype badge |
| Purple as primary | **Replace with Signal Teal** | Brand strategy |
| Loud credits progress card | **Quiet** | Credits stay visible, not theatrical |

### 2.2 Phase 1.1 navigation (final)

**Primary**
- Discover *(default)*
- Saved Leads
- Outreach
- Mailbox

**Secondary**
- Affiliate
- Billing & Plans
- Settings

**Shortcuts** (optional section): user-saved searches only — max 5 visible, overflow “View all”.

No Dashboard vanity home in Phase 1.1 — **Discover is home**.

---

## 3. Visual system (applied to this workspace)

Aligned to `01-brand-strategy.md`.

### 3.1 Color tokens (product)

| Token | Hex | Use |
|-------|-----|-----|
| Ink / Sidebar | `#0B0B10` | Sidebar, elevated dark chrome |
| Ink Elevated | `#14141C` | Sidebar hover/active wash base |
| Canvas | `#F7F7F9` | Main app background |
| Surface | `#FFFFFF` | Table, panels, cards |
| Border | `#E6E6EC` | Hairlines |
| Border Strong | `#D0D0DA` | Inputs at rest |
| Text Primary | `#12121A` | Names, titles |
| Text Secondary | `#5C5C6E` | Meta, labels |
| Text Tertiary | `#8A8A9A` | Hints, timestamps |
| **Signal Teal** | `#0D9488` | Primary accent, focus, active, primary CTA |
| Teal Soft | `#E6F7F5` | Selected row / active nav wash |
| Copper | `#C2784B` | Outreach emphasis only (compose/send) |
| Success | `#159A5A` | Verified, saved, success toast |
| Warning | `#C4811A` | Limits, credits low |
| Danger | `#C43C3C` | Errors (calm, never panic flood) |

**Rule:** One primary accent (teal). Copper only when the user is about to contact. Semantic colors only for meaning.

### 3.2 Typography

- Product sans: neo-grotesk (Inter / Geist direction)  
- **Sizes in product (hard limit — fewer sizes):**
  - 12 — micro / table meta / hints  
  - 13 — table body (default)  
  - 14 — controls, inputs  
  - 16 — section titles  
  - 20 — page title  
- Weights: Regular 400, Medium 500, Semibold 600 — **avoid Bold 700 in tables**  
- Table numerals: tabular lining where possible  

### 3.3 Spacing (8-point)

| Step | px |
|------|----|
| 1 | 4 |
| 2 | 8 |
| 3 | 16 |
| 4 | 24 |
| 5 | 32 |
| 6 | 40 |
| 7 | 48 |

**Layout constants**
- Sidebar width: **240px** (collapsed icon rail: **64px** at ≤1280)  
- Header height: **56px**  
- Details panel: **400px** (min 360 / max 440)  
- Table row height (comfortable): **48px**  
- Table row height (compact density): **40px**  
- Touch targets (mobile): **44×44** minimum  

### 3.4 Radius & depth

- Controls / inputs / chips: **8px**  
- Panels / modals: **12px**  
- Checkboxes: **4px**  
- Elevation: hairline border first; shadow only on floating bulk bar, menus, sheets (`0 8px 24px rgba(12,12,20,0.12)`)  
- No glass on primary work surfaces  

### 3.5 Motion

| Interaction | Duration | Feel |
|-------------|----------|------|
| Hover wash | 120ms | Instant clarity |
| Row select | 100ms | Decisive |
| Panel open | 180ms ease-out | Oriented |
| Bulk bar enter | 160ms ease-out | Lightweight |
| Toast | 160ms in / 200ms out | Quiet |
| Page transitions | none / ≤150ms | Never theatrical |

No bounce. No spring toys. No oversized fades.

---

## 4. Desktop Discovery Workspace (1440 / 1600 / 1920)

**Screen:** `screens/01-desktop-discovery-workspace.png`

### 4.1 Sidebar refinement

- Vertical rhythm: 8px between items, 16px between groups  
- Icon + label optically aligned (icons 16px, label 13–14 Medium)  
- Hover: `#14141C` wash, no scale  
- Active: **3px teal left rail** + `Teal Soft` at 12% opacity on dark (or teal text)  
- Section label “SHORTCUTS”: 11px Medium, Tertiary, tracking +0.04em  
- Credits: compact meter — label, count `12,540 / 20,000`, thin progress, text link “Upgrade” — **not** a loud card competing with Discover  
- Profile: avatar 28px, name 13 Medium, role 12 Tertiary  

### 4.2 Top navigation

- Height 56px, sticky, Surface with bottom hairline  
- Global search: max-width 480px, centered in remaining content column; placeholder “Search businesses, categories, or keywords…”; trailing `⌘K` chip  
- Right cluster spacing 8–12px: Credits (number + quiet +) · Notifications · Help · Avatar  
- No competing “active tab” under logo — Discover active lives in sidebar  

### 4.3 Search (signature)

Order and hierarchy:

1. Page title **Business Discovery** (20 Semibold)  
2. One-line subtitle (14 Secondary): “Find businesses by type and location.”  
3. Search module (Surface card, 16 padding):  
   - **Business Type** (required)  
   - **Location** (required)  
   - **Keywords** (optional, visually quieter)  
   - **Search** primary button (teal, h-40)  
4. Recent / Saved chips row (scroll, no wrap explosion)  

Keyboard:
- `⌘K` → focus global search / command  
- `⌘Enter` → run discovery search when type+location valid  
- `Esc` → clear focus / close menus  

Loading: Search button → spinner + label “Searching”; fields locked; results region skeletons.

### 4.4 Filters

Keep sparse. Phase 1.1 filter set:

- Rating  
- Verified email  
- Has website  
- Has phone  
- More (opens sheet: source, updated window — only if already product-real)

Rules:
- Selected filters become **teal outline chips** with clear ×  
- “Clear all” appears only when ≥1 active  
- Overflow: collapse into “Filters · N” on narrower desktop  
- Do not show Employees/Revenue  

### 4.5 Results table (primary craft surface)

**Goal:** Surpass Apollo on scan speed and calm.

#### Columns (default desktop ≥1440)

| Col | Width behavior | Notes |
|-----|----------------|-------|
| Checkbox | 40 fixed | Pinned left |
| Business | flex min 220 | Logo 24 + name + optional Verified |
| Category | 140 | Truncate |
| Location | 180 | City, Country |
| Phone | 140 | Mono-ish numerals |
| Email | 200 | Truncate + copy on hover |
| Rating | 88 | ★ 4.8 |
| Reviews | 72 | Right-aligned number |
| Source | 56 | Icon only + tooltip |
| Updated | 100 | Relative date |
| Actions | 72 sticky right | Bookmark + more |

Pinned: checkbox + Business (left), Actions (right). Horizontal scroll for middle columns under 1440.

#### States

| State | Treatment |
|-------|-----------|
| Default | White row, hairline divider |
| Hover | `#F3F3F6` + reveal ghost icon actions |
| Selected | `Teal Soft` background + teal checkbox |
| Active (details open) | Selected + 2px teal left inset on row |
| Disabled / incomplete contact | Tertiary text on missing email/phone — never fake data |

#### Row hover actions (lightweight)

Appear in Actions zone / end of Email·Phone cells — max 5:

1. Copy email  
2. Copy phone  
3. Open website  
4. Save  
5. More (context menu)

No icon soup. Tooltips on all icons.

#### Density modes

- **Comfortable** 48px (default)  
- **Compact** 40px (user preference in table menu)  

#### Sort & resize

- Sortable: Business, Location, Rating, Reviews, Updated  
- Header: 12 Medium Tertiary → Medium Primary on hover; sort caret 10px  
- Column resize: drag edge, double-click reset  

#### Pagination

- Bottom bar: “Showing 1–50 of 1,842” · page size 25/50/100 · prev/next  
- Prefer cursor continuity feel; never jump scroll position violently  

#### Loading / skeleton

- Header meta skeleton  
- 8–10 skeleton rows matching column geometry  
- No full-page spinner over table once first paint exists (refresh = quiet top progress)  

---

## 5. Business Details Panel

**Screen:** `screens/04-business-details-panel.png`

### Purpose
A **dossier**, not a CRM record.

### Structure
1. Header: logo, name, Verified, rating, close  
2. Tabs: **Overview** · **Contact** · **Activity** (outreach/contact events only)  
3. Contact block: address, phone, email, website — each with copy / open  
4. Meta: category, hours, source, last updated  
5. Quick actions (2×3): Open Website · Open Maps · Call · Copy Email · Copy Phone · Save Lead  
6. Footer CTAs: primary **Add to Outreach** (teal) · secondary **Export** / **Save**  

### Explicit non-goals
- No deal stages  
- No note-taking CRM  
- No AI recommendations  
- No related companies graph  

### Empty panel
When nothing selected: calm empty — “Select a business to view details.” + shortcut hint.

---

## 6. Bulk toolbar

**Screen:** `screens/08-bulk-selection.png`

- Float centered above safe area, max-width ~720  
- Left: “N selected” + Clear  
- Actions: Save to List · **Add to Outreach** (primary) · Export CSV · More  
- Appear only when selection ≥1  
- Does not cover pagination controls (offset 24 above bottom)  
- Lightweight shadow; dismiss with `Esc` clears selection  

---

## 7. Search / Loading / Empty / Error / Success

### Search states — `screens/05-search-states.png`
- Idle → Searching → Completed  

### Loading + Empty — `screens/06-07-loading-empty-states.png`

| Empty | Message | CTA |
|-------|---------|-----|
| No results | “No businesses matched. Try a broader location or different type.” | Edit search |
| No selection | “Select a business to view details.” | — |
| No saved searches | “Save a search to reuse it later.” | Save after results |
| No recent searches | “Your recent searches will appear here.” | — |
| No mailbox (outreach path) | “Connect a mailbox to send.” | Connect |

### Errors — `screens/09-error-success-states.png` (calm)

| Error | Tone |
|-------|------|
| Search failed | “Search failed. Try again.” |
| No internet | “You’re offline. Reconnect and retry.” |
| Rate limit | “Too many searches. Wait a moment.” |
| No credits | “No credits left. Upgrade to continue.” |
| Session expired | “Session expired. Sign in again.” |
| Mailbox disconnected | “Mailbox disconnected. Reconnect to send.” |

Danger color on icon/text only — **never full red screens**.

### Success (toasts, 2–3s)
- Business saved  
- Export completed  
- Copied  
- Search completed *(optional; count in header often enough)*  
- Added to outreach  

---

## 8. Tablet (≈1024–1280)

**Screen:** `screens/02-tablet-discovery-workspace.png`

- Sidebar → icon rail 64px (expand on hover/tap)  
- Details panel overlays as 360–400 drawer (does not crush table below ~50%)  
- Filters collapse earlier into “Filters · N”  
- Table shows priority columns; others via horizontal scroll  
- Bulk bar unchanged pattern  

---

## 9. Mobile (intentional redesign)

**Screens:** `screens/03-mobile-discovery-workspace.png`, `screens/03b-mobile-details-sheet.png`

**Do not shrink desktop.**

### Patterns
- Bottom tabs: Discover · Saved · Outreach · Mailbox · More  
- Sticky search card (type + location stacked, full-width Search)  
- Horizontal filter chips  
- **Card results** (not mini-table): name, category, location, rating, contact peek  
- Swipe actions on card: Save · Copy · More  
- Details = **bottom sheet** (handle, 70–90% height)  
- Bulk select mode: checkbox on cards + bottom action sheet  
- Touch spacing ≥8 between cards, targets ≥44  

### One-handed
Primary Search and bottom tabs in thumb zone. Destructive actions not on primary thumb arc without confirm.

---

## 10. Responsive table strategy

| Breakpoint | Presentation |
|------------|--------------|
| ≥1440 | Full columns + details dock |
| 1280–1439 | Fewer columns; details overlay |
| 768–1279 | Tablet rail + priority columns |
| <768 | Cards + sheet |

Pinned columns and density preference persist per user.

---

## 11. Component consistency checklist

All screens share one system (`screens/10-design-system-preview.png`):

- Buttons: Primary / Secondary / Ghost / Destructive / Icon  
- Inputs: Default / Focus (teal ring) / Error / Disabled  
- Checkbox / Radio  
- Dropdown / Select  
- Badges: Verified, Saved, Source  
- Tabs (underline teal)  
- Tooltip  
- Pagination  
- Context menu  
- Filter chips  
- Modal / Sheet / Details panel  
- Toast / Inline banner  
- Table (row states + skeletons)  

If a control doesn’t match the kit, it doesn’t ship.

---

## 12. Accessibility

- Text contrast ≥ 4.5:1 on canvas; sidebar labels ≥ 4.5:1 on ink  
- Focus rings: 2px teal, offset 2px — never removed  
- Keyboard: full table traversal, space to select, enter to open details  
- `⌘K` documented in UI  
- Reduced motion: disable non-essential transitions  
- Mobile tap targets ≥ 44px  

---

## 13. Desktop monitor optimization

| Width | Behavior |
|-------|----------|
| 1440 | Default reference composition |
| 1600 | Extra column breathing; details stay 400 |
| 1920 | Max content width ~1440–1520 centered OR fluid table with capped panel — **prefer fluid table**, avoid sparse empty margins that feel “landing page” |

---

## 14. Production acceptance criteria

Ship Phase 1.1 Discovery when:

1. Layout matches baseline skeleton (sidebar / header / search / filters / table / panel / bulk)  
2. No Employees/Revenue/Notes CRM invent  
3. Teal + ink + neutrals only for brand chrome  
4. Table readable for 2+ hour sessions (comfort density default)  
5. Hover actions ≤5 and discoverable  
6. Mobile is card+sheet, not scaled desktop  
7. Empty/error/success states exist for all listed cases  
8. Motion ≤180ms product transitions  
9. Components match Design System Preview  
10. Every control answers: **does this help discover or contact businesses faster?**  

---

## 15. Out of scope for this phase

- AI recommendations  
- CRM pipelines  
- Marketing automation  
- Sales intelligence firmographics (employees/revenue)  
- Full analytics suite  
- Visual redesign of marketing site  

---

## 16. Handoff note

Designers and engineers should treat:

- **Baseline** = structure authority  
- **This document** = refinement authority  
- **Brand strategy** = emotional / color / motion authority  
- **Screens/** = visual reference (execution target)  

Where a generated screen drifts (extra nav, purple leftover, invented filters), **this markdown wins**.

---

*Phase 1.1 complete as design deliverable. No application code modified.*
