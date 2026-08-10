# LeadThur UI Audit — Navigation

---

## Top Navigation

### Marketing (`components/marketing/homepage/Nav.tsx`)

| Item | Target |
|------|--------|
| How It Works | `#how-it-works` |
| Features | `#features` |
| Reviews | (section scroll) |
| Offer | `#offer` |
| FAQ | `#faq` |
| Log in | `/activate` |
| Try Free | `https://www.leadthur.com/freetrial` |
| Get Lifetime Access | `/checkout` |

Also: AnnouncementBar above nav on homepage.

### App shell (`components/navbar.tsx`)

| Item | Target |
|------|--------|
| Logo / LeadThur | `/` |
| Dashboard CTA | `/dashboard` |

Used on: dashboard gate, search result page.

### Free trial header

Inline “Get Full Access” (not shared Nav component) — see `freetrial/page.tsx`.

### Admin

No shared top nav component. Single-page vertical sections after login; Logout control on page.

---

## Sidebar

**Not Found.** No app sidebar navigation. Product is a single dense dashboard with outreach **tabs** (Results / Sends report / Mailboxes), not a sidebar IA.

---

## Footer

### Marketing Footer (`marketing/homepage/Footer.tsx`)

| Link | Target |
|------|--------|
| Log in | `/activate` |
| Support | `mailto:support@leadthur.com` |
| Privacy | `/privacy` |
| Terms | `/terms` |

About: **Not Found** in marketing footer.

### App Footer (`components/footer.tsx`)

| Link | Target |
|------|--------|
| Privacy | `/privacy` |
| Terms | `/terms` |
| About | `/about` |

---

## Admin Navigation

**Not Found** as discrete nav. `/admin` is one long SPA with sequential sections:

1. Queue status  
2. Activation tracker  
3. Global scripts  
4. Overview  
5. Recent users  
6. Affiliate payouts  
7. Free trial activity  
8. Trial insights tabs  
9. Broadcast  
10. Account lookup  
11. Direct messaging  
12. Blog manager  
13. Generate access  
14. Recent licenses  

---

## Breadcrumbs

**Not Found.**

---

## Hidden / Disallowed Routes

From `frontend/app/robots.ts`:

| Path | robots |
|------|--------|
| `/admin` | Disallow |
| `/activate` | Disallow |
| `/dashboard` | Disallow |
| `/demo` | Disallow |

Still reachable by URL.

---

## Redirects

| From | To | File |
|------|----|------|
| `/get-access` | `/checkout` | `app/get-access/page.tsx` |
| `/start` | `/checkout` | `app/start/page.tsx` |
| `/blog/category/[slug]` | `/blog?category=` | category page |
| `/blog/tag/[slug]` | `/blog?tag=` | tag page |
| `/dashboard` (no license) | `/activate` | DashboardGate |
| `/dashboard` + suspended status | `/suspended` | dashboard page poll |
| `/activate` (already licensed) | `/dashboard` | activate page |
| `/demo` (prod without DEMO_MODE) | “Page not found.” UI | demo page |

---

## Protected Routes

| Route | Protection mechanism |
|-------|----------------------|
| `/dashboard` | Client: localStorage license + DashboardGate |
| `/dashboard/search/[id]` | Client: redirect activate if no license |
| `/dashboard/plans` | **Weak** — uses license headers for API but **no page-level redirect found** |
| `/admin` | Client: admin JWT in localStorage |

**Next.js middleware:** Not Found.

---

## Public Routes

`/`, `/about`, `/freetrial`, `/checkout`, `/checkout/success`, `/payment-success`, `/activate`, `/blog*`, `/privacy`, `/terms`, `/get-access`, `/start`, `/suspended`, `/demo` (env-gated), `/demo-recording`

---

## Redesign notes

- Introduce consistent global nav + optional product sidebar (Search, Outreach, Billing, Affiliate, Account).
- Unify marketing vs app footers.
- Protect `/dashboard/plans` the same way as `/dashboard`.
- Add breadcrumbs for `/dashboard/search/[id]` and blog posts.
