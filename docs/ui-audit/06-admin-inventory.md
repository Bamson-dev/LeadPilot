# LeadThur UI Audit — Admin Inventory

**URL:** `/admin`  
**File:** `frontend/app/admin/page.tsx` + `frontend/components/admin/*`  
**Auth:** Admin email/password → JWT (`POST /admin/login`); stored as `leadthur_admin_token`  
**Permissions:** Single role `admin` (env `ADMIN_EMAIL` / `ADMIN_PASSWORD`). No fine-grained RBAC. **Not Found.**

---

## 1. Admin Login

| Field | Detail |
|-------|--------|
| Purpose | Gate console |
| Actions | Sign in |
| Forms | Email, password |
| API | `POST /admin/login` |
| Database | Not Found (env credentials) |

---

## 2. Queue Status Bar

| Field | Detail |
|-------|--------|
| Purpose | Live search queue health |
| Component | `queue-status-bar.tsx` |
| Charts | Metrics strip (not a full chart lib) |
| API | `GET /admin/queue-status` |
| Database | Queue/runtime (Redis/BullMQ) + search_jobs indirectly |

---

## 3. Activation Tracker

| Field | Detail |
|-------|--------|
| Purpose | Activations over date range |
| Forms | Date presets + custom range |
| Charts | Bar chart of activations |
| API | `GET /admin/activations` |
| Database | `license_keys` |

---

## 4. Global Scripts

| Field | Detail |
|-------|--------|
| Purpose | Inject sitewide head/body scripts (analytics pixels) |
| Forms | Two textareas |
| Actions | Save Scripts |
| API | `GET/POST /admin/site-settings` |
| Database | `site_settings` (no migration file found) |
| Risk | Full XSS / third-party script injection if admin token stolen |

---

## 5. Overview

| Field | Detail |
|-------|--------|
| Purpose | KPI cards |
| API | `GET /admin/overview` |
| Database | Aggregates across licenses/trials/etc. |

---

## 6. Recent Users

| Field | Detail |
|-------|--------|
| Purpose | Last signups |
| Tables | Recent users |
| Actions | Manage → jumps to Account Lookup |
| API | `GET /admin/recent-users` |

---

## 7. Affiliate Payouts

| Field | Detail |
|-------|--------|
| Purpose | Process Paystack transfers |
| Tables | Payout requests |
| Actions | Processing; Mark Paid (`window.confirm`) |
| Empty | `No payout requests yet.` |
| API | `GET /admin/payouts`, `POST .../processing`, `POST .../pay` |
| Database | `payout_requests`, `license_keys` bank fields |

---

## 8. Free Trial Activity

| Field | Detail |
|-------|--------|
| Purpose | Collapsible trial KPIs + 7-day chart + top queries |
| API | `GET /admin/trial-stats`, `GET /admin/trial-activity` |
| Database | `free_trial_signups`, opens, searches |

---

## 9. Trial Insights — Signups

| Field | Detail |
|-------|--------|
| Component | `trial-signups-panel.tsx` |
| Tables | Signups; email search; sort |
| API | `GET /admin/trial-signups` |
| Database | `free_trial_signups` |

---

## 10. Trial Insights — Email Performance

| Field | Detail |
|-------|--------|
| Component | `trial-email-performance-panel.tsx` |
| Tables | Step open performance |
| API | `GET /admin/email-performance` |
| Database | `trial_email_opens`, `free_trial_signups` |

---

## 11. Trial Broadcast

| Field | Detail |
|-------|--------|
| Component | `trial-broadcast-panel.tsx` |
| Forms | Audience, subject, body |
| Dialogs | Custom confirm before send |
| API | broadcast count/history/send |
| Database | `broadcast_log`, trial emails |

---

## 12. Account Lookup

| Field | Detail |
|-------|--------|
| Component | `account-lookup.tsx` |
| Purpose | Full license ops |
| Actions | Search, Resend Email, Reset Searches, Suspend/Unsuspend, Update Search Limit, Reset Devices, Update Device Limit |
| Forms | Email lookup; suspend reason; limits |
| Dialogs | Inline Confirm for reset/suspend |
| API | lookup, resend, reset, suspend, unsuspend, update-limit, reset-devices, upgrade-devices |
| Database | `license_keys` |

---

## 13. Direct Messaging

| Field | Detail |
|-------|--------|
| Component | `direct-messaging.tsx` |
| Tabs | Single User / Broadcast to All |
| Forms | Recipient, subject, HTML (RichEmailEditor) |
| Actions | Preview; Send; Broadcast (`window.confirm`) |
| API | admin send-message / broadcast-message |
| Database | email delivery only; not a messages table |

---

## 14. Blog Manager

| Field | Detail |
|-------|--------|
| Component | `blog-manager.tsx` |
| Actions | New, Edit, Delete (`window.confirm`), Save/Publish |
| Forms | Title, slug, content, cover, SEO fields, status |
| API | `/admin/blog/posts` CRUD + image upload |
| Database | `blog_posts` |

---

## 15. Generate Access

| Field | Detail |
|-------|--------|
| Purpose | Manually create/send license |
| Forms | Buyer email |
| API | `POST /admin/generate-access` |
| Database | `license_keys` |

---

## 16. Recent Licenses

| Field | Detail |
|-------|--------|
| Purpose | License inventory |
| Tables | Wide table (`min-w-[900px]`) |
| Empty | `No licenses yet` |
| API | `GET /admin/licenses` |
| Database | `license_keys` |

---

## Admin UX problems (for redesign)

1. No sidebar — endless scroll SPA  
2. `window.confirm` for destructive actions  
3. Scripts editor is high-risk without preview/sandbox  
4. Mobile tables need horizontal scroll  
5. No audit log UI for admin actions (**Not Found**)
