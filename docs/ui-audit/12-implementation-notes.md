# LeadThur UI Audit — Implementation Notes

For designers/PMs rebuilding UI without reading the repo. Engineering constraints that affect redesign.

---

## Current architecture

| Layer | Choice |
|-------|--------|
| Frontend | Next.js 15 App Router, React 19, Tailwind 4 |
| Backend | Express + TypeScript |
| Auth (users) | License key + email in **localStorage**; headers `x-license-key`, `x-license-email` |
| Auth (admin) | JWT in **localStorage** |
| State | React hooks; no Redux/Zustand/React Query |
| API client | `frontend/services/{api,auth-api,admin-api,outreach-api}.ts` |
| Shared | `@leadthur/shared` workspace package |

Monorepo: `frontend/`, `backend/`, `shared/`, `supabase/`.

---

## Reusable layouts

| Layout | Path | Role |
|--------|------|------|
| Root | `app/layout.tsx` | HTML shell, Inter, dark, site scripts |
| Marketing | `app/(marketing)/layout.tsx` | Home metadata |
| Activate | `app/activate/layout.tsx` | Suspense for searchParams |
| Checkout | `app/checkout/layout.tsx` | SEO |
| Free trial | `app/freetrial/layout.tsx` | SEO |

**No** shared `DashboardLayout` with sidebar. Dashboard wraps Navbar + content + Footer via `DashboardGate`.

---

## Theme handling

- Always dark (`className="dark"` on `<html>`).
- Tokens in `styles/globals.css` + marketing `theme.ts`.
- No `next-themes` / light mode.
- Purple accent system; glass/glow utilities present.

---

## State management

| Concern | Mechanism |
|---------|-----------|
| License session | `lib/license.ts` localStorage |
| Trial email | `lp_trial_email` localStorage |
| Onboarding done | `lp_onboarding_done` |
| Admin token | `leadthur_admin_token` |
| Device id | cookie `leadthur_did` + local id |
| Search machine | `hooks/useSearch.ts` |
| Outreach | `hooks/useOutreach.ts` |
| Lead statuses | `hooks/useLeadStatuses.ts` |
| Referral | `lp_ref_code` localStorage |

Server components used for blog SSR; product UI is mostly client.

---

## Authentication & permissions

| Persona | How enforced |
|---------|----------------|
| Guest | Public routes |
| Trial | Email + API trial limits (2/email, 2/IP) |
| Paid | Client gate + API `requireLicense` |
| Suspended | `/auth/status` → `/suspended` |
| Admin | JWT `role: admin` |

**No** Next middleware. Treat client gates as UX only; APIs enforce server-side for paid routes.

---

## Responsive strategy

- Tailwind breakpoints `sm` / `md` / `lg`
- `useIsMobile` hook on product surfaces
- Dual presentations: desktop table vs `MobileLeadCard` / trial mobile cards
- Outreach send panel: desktop fixed width slide-over; mobile full viewport
- Admin: horizontal scroll tables
- Marketing: full-width CTAs, clamp type, 48px tap targets

---

## Modals / overlays implementation

| Pattern | Tech |
|---------|------|
| Radix Dialog | `ui/dialog.tsx` (barely used) |
| Custom fixed overlays | Onboarding, SearchLimit, WhatsApp |
| Slide-over panel | OutreachSendPanel |
| Third-party | Flutterwave React |
| Native | `window.confirm` (admin) |

Drawers/Sheets library: **Not Found.**

---

## Search UX constraint

Results arrive over **minutes** via SSE + poll. UI must support:

- Queue position
- Partial leads while `scrapingInProgress`
- `fullyComplete` (not just `status=completed`) as done signal

---

## Hosting that affects URLs

| App | Host |
|-----|------|
| Frontend | Vercel → `www.leadthur.com` |
| Backend | Coolify → `backend.leadthur.com` |
| API base | `NEXT_PUBLIC_API_URL` |

Absolute free-trial URL appears in marketing theme (`https://www.leadthur.com/freetrial`).

---

## Implications for redesign

1. Redesign can keep App Router but should add a real app shell (sidebar + top bar).  
2. Replace license-in-localStorage with session cookies if moving to password auth — large backend change.  
3. Unify design tokens; kill dual marketing/app themes.  
4. Formalize Drawer for compose; Modal for confirms.  
5. Do not assume a business detail route exists — add it intentionally if needed.  
6. Trial and paid search UIs should share one results system.
