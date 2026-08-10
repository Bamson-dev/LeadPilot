# LeadThur UI Audit — API → Screen Map

Loading behaviour is what the UI shows while waiting. Failure behaviour is user-visible handling found in code.

---

## Marketing Home `/`

| Method | Endpoint | Purpose | Loading | Failure |
|--------|----------|---------|---------|---------|
| GET | `/public/site-scripts` | Inject analytics | Silent | Scripts omitted |

---

## Free Trial `/freetrial`

| Method | Endpoint | Purpose | Loading | Failure |
|--------|----------|---------|---------|---------|
| GET | `/trial/status` | Remaining searches | `Loading your free trial...` | Error / gate retry |
| POST | `/trial/signup` | Register email | `Starting...` | Validation / API error text |
| POST | `/freetrial` | Start trial search | `Searching...` | Limit / invalid / queue full |
| GET | `/search/results/:id` | Poll leads | Progress messages | Poll error |

---

## Checkout `/checkout`

| Method | Endpoint | Purpose | Loading | Failure |
|--------|----------|---------|---------|---------|
| POST | `/checkout/initialize` | Paystack session | `Opening payment...` | Not configured / failed |
| — | Flutterwave SDK | Non-NG payment | SDK modal | Payment failed message |

---

## Checkout Success `/checkout/success`

| Method | Endpoint | Purpose | Loading | Failure |
|--------|----------|---------|---------|---------|
| POST | `/checkout/verify` | Confirm lifetime pay | Loading text | Warn / error text |
| GET | `/balance/` (via fetchOutreachBalance) | Outreach return | Loading | Warn |

---

## Activate `/activate`

| Method | Endpoint | Purpose | Loading | Failure |
|--------|----------|---------|---------|---------|
| POST | `/auth/activate` | Bind license + device | `Signing in…` | Alert; max_devices |

---

## Dashboard `/dashboard`

| Method | Endpoint | Purpose | Loading | Failure |
|--------|----------|---------|---------|---------|
| GET | `/auth/status` | Session poll (30s) | — | Redirect activate/suspended |
| POST | `/search/` | Start search | Queue/progress/SSE | Limit modal / error |
| GET | `/search/:id` | Status | Progress | Error |
| GET | `/search/:id/stream` | SSE leads | Streaming | Disconnect → poll |
| GET | `/search/:id/results` | Poll results | — | Error |
| GET | `/auth/usage` | Searches/credits | Banner | Fail-soft |
| GET | `/search/suggestions` | Area suggestions | Chips | Hidden |
| GET | `/search/activity` | Social proof chips | — | Hidden |
| GET | `/search/stats/total` | Total discovered | — | Hidden |
| GET | `/search/history` or `/search-history` | History | Panels | Empty |
| GET/POST | `/lead-status` | CRM statuses | — | Error toast/silent |
| GET | `/whatsapp-templates/` | Templates | Modal loading | Retry |
| POST | `/ai-message/generate` | AI WhatsApp | Generating… | Credits / error |
| POST | `/ai-message/claim-bonus` | Bonus credits | — | — |
| GET | `/balance/` | Outreach balance | Top bar | — |
| GET/POST/DELETE | `/mailboxes*` | Mailboxes | Sections | SMTP errors |
| POST | `/send/` | Queue emails | Sending | Failures listed |
| GET | `/sends/` | Report | Tab | Empty |
| POST | `/sends/.../replied` | Mark replied | — | — |
| POST | `/outreach/generate-email` | AI email | Generating | Rate limit / error |
| GET | `/email-templates/` | Templates | Panel | — |
| GET | `/affiliate/stats` | Affiliate | Section | — |
| POST | `/affiliate/*` | Bank / payout | Forms | Errors |
| POST | `/topup/initialize` | Via limit modal | Loading | Error |

---

## Search by ID `/dashboard/search/[searchId]`

Same subset as dashboard results + `useSearchJob` GETs for that id.

---

## Plans `/dashboard/plans`

| Method | Endpoint | Purpose | Loading | Failure |
|--------|----------|---------|---------|---------|
| GET | `/balance/` | Show balance | Cards | — |
| POST | `/checkout/` | Outreach sub/pack | `Opening Paystack...` | Plan switch blocked / error |

---

## Blog `/blog`, `/blog/[slug]`

| Method | Endpoint | Purpose | Loading | Failure |
|--------|----------|---------|---------|---------|
| GET | `/public/blog/posts` | List | SSR | Empty state |
| GET | `/public/blog/posts/:slug` | Article | SSR | notFound |

---

## Suspended `/suspended`

| Method | Endpoint | Purpose | Loading | Failure |
|--------|----------|---------|---------|---------|
| GET | `/auth/status` | Restore poll | — | Stay suspended |

---

## Admin `/admin`

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/admin/login` | Auth |
| GET | `/admin/queue-status` | Queue |
| GET | `/admin/activations` | Chart |
| GET/POST | `/admin/site-settings` | Scripts |
| GET | `/admin/overview` | KPIs |
| GET | `/admin/recent-users` | Table |
| GET | `/admin/payouts` (+ processing/pay) | Payouts |
| GET | `/admin/trial-stats` | Trial KPIs |
| GET | `/admin/trial-activity` | Activity |
| GET | `/admin/trial-signups` | Signups |
| GET | `/admin/email-performance` | Opens |
| * | broadcast endpoints | Trial broadcast |
| * | lookup / suspend / reset / limits / devices | Account lookup |
| * | send-message / broadcast-message | Messaging |
| * | blog CRUD + upload | Blog |
| POST | `/admin/generate-access` | Manual license |
| GET | `/admin/licenses` | Inventory |
| GET | `/admin/stats` | Stats (if used) |

Loading: per-panel spinners / Signing in…  
Failure: SESSION_EXPIRED clears token; inline errors.

---

## Demo `/demo`

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/demo/search` | Demo search (if DEMO_MODE) |

---

## Not mapped to a dedicated screen

Webhooks (`/webhooks/*`), unsubscribe (`/unsubscribe`, `/outreach/unsubscribe`), open pixel (`/outreach/open/:token`), health — no product UI beyond email/browser image.
