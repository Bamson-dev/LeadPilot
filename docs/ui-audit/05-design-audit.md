# LeadThur UI Audit — Design Audit

**Sources:** `frontend/styles/globals.css`, `components/marketing/homepage/theme.ts`, `app/layout.tsx`, component inventory.

---

## Typography — Score: 6/10

| Item | Finding |
|------|---------|
| App font | Inter via `next/font` (`--font-inter`) |
| Marketing font | System stack in `theme.ts` FONT — **not Inter** |
| Hierarchy | Strong on marketing; dashboard denser / smaller |

**Problems:** Two type systems; dashboard lacks clear display/body scale.  
**Recommendations:** One type ramp (Display / Title / Body / Caption); use Inter everywhere or commit to marketing system stack intentionally.

---

## Spacing — Score: 5/10

**Problems:** Dashboard mixes tight zinc panels with marketing generous padding; admin is compact tables.  
**Recommendations:** 4/8px spacing scale; consistent section padding tokens.

---

## Grid — Score: 6/10

Marketing uses full-bleed sections. Dashboard uses ad-hoc flex/grid (`sm:`, `md:`). Results table virtualized.  
**Recommendations:** 12-column or CSS grid layout for product; define max content width.

---

## Cards — Score: 6/10

Marketing cards (`bgCard`), checkout card, plan cards, queue card, mailbox cards. Dashboard results are table-first (good for density, hard for mobile).  
**Recommendations:** Card pattern for mobile leads already exists (`MobileLeadCard`) — elevate as primary mobile pattern.

---

## Buttons — Score: 7/10

Shared `ui/button` with variants. Marketing CTAs often custom styled (purple). Multiple CTA wordings for same action (“Claim”, “Get Full Access”, “Get lifetime”).  
**Recommendations:** Primary / Secondary / Destructive / Ghost only; unify CTA copy system.

---

## Forms — Score: 6/10

Activate, checkout, trial gate, search box, admin forms, mailbox connect. `ui/input` underused.  
**Problems:** Inconsistent labels/errors; license key field unusual.  
**Recommendations:** Form field component (label, help, error); progressive disclosure for license vs email login redesign.

---

## Tables — Score: 7/10

ResultsTable (virtualized) is strong. Admin tables overflow horizontally. Trial desktop grid separate from ResultsTable.  
**Recommendations:** One table system; sticky headers; mobile always cards.

---

## Charts — Score: 4/10

Admin activation / trial activity use simple bar visualizations (inline). No chart library found.  
**Recommendations:** If keeping analytics, use one chart component; otherwise simplify to KPI cards.

---

## Colors — Score: 5/10

| Token | App (`globals.css`) | Marketing (`theme.ts`) |
|-------|---------------------|------------------------|
| Background | `#07070a` | `#050508` |
| Accent | `#7c3aed` | `#7C3AED` |
| Accent alt | `#a855f7` | `#A78BFA` |

**Problems:** Purple-heavy dark SaaS look; near-duplicate palettes; glow utilities (`.glow-violet`).  
**Recommendations:** Document single palette; reduce glow; define semantic success/warn/error (green/orange/red exist in marketing theme).

---

## Icons — Score: 6/10

`lucide-react` used in product. Marketing may use inline/emoji-less custom. Contact dots are custom.  
**Recommendations:** Lucide-only; accessible labels on icon buttons.

---

## Modals — Score: 5/10

Mix of Radix Dialog (unused ExportModal), custom overlays (Onboarding, SearchLimit, WhatsApp), `window.confirm` in admin, Flutterwave SDK.  
**Recommendations:** One modal primitive; ban `window.confirm` for destructive admin actions → confirm dialog.

---

## Drawers — Score: 2/10

**Not Found.** Outreach compose uses fixed slide-over / full-screen panel instead.  
**Recommendations:** Formalize as Drawer pattern with escape, focus trap, backdrop.

---

## Animations — Score: 6/10

Framer Motion available; marketing CSS keyframes; live counter; skeleton/shimmer utilities.  
**Problems:** Motion not systematically purposeful across product.  
**Recommendations:** 2–3 intentional motion patterns (enter, success, progress).

---

## Dark Mode — Score: 3/10

Always dark (`html` class `dark`). Light mode / toggle: **Not Found.**  
**Recommendations:** Decide: dark-only brand (document) or add light theme tokens.

---

## Accessibility — Score: 4/10

No systematic a11y audit in repo. Custom modals may miss focus management. Tables dense. Color contrast not verified.  
**Recommendations:** WCAG AA pass on redesign; focus rings; skip links; form labels.

---

## Consistency — Score: 4/10

Dual nav/footer/logo/fonts; trial UI ≠ dashboard UI; admin is a third visual dialect.  
**Recommendations:** Design system + Storybook (or equivalent) before rebuild.

---

## Visual Hierarchy — Score: 6/10

Marketing hierarchy strong (brand + one offer). Dashboard hierarchy weak (search, affiliate, tabs, banners compete).  
**Recommendations:** One primary job per viewport on product screens.

---

## Score summary

| Area | /10 |
|------|-----|
| Typography | 6 |
| Spacing | 5 |
| Grid | 6 |
| Cards | 6 |
| Buttons | 7 |
| Forms | 6 |
| Tables | 7 |
| Charts | 4 |
| Colors | 5 |
| Icons | 6 |
| Modals | 5 |
| Drawers | 2 |
| Animations | 6 |
| Dark Mode | 3 |
| Accessibility | 4 |
| Consistency | 4 |
| Visual Hierarchy | 6 |
| **Average** | **~5.2** |
