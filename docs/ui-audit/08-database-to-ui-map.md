# LeadThur UI Audit — Database → UI Map

Only tables/fields that appear in UI or are clearly bound via API responses shown on screen.

---

## Free Trial `/freetrial`

| Table | Displayed fields | Editable |
|-------|------------------|----------|
| `free_trial_signups` | email (gate), searches remaining | email on signup |
| `search_jobs` | status, progress, totals | Not Found |
| `business_leads` | name, category, address, phone (partial), email (blurred), website, rating | Not Found |
| `free_trial_ip_usage` | Not displayed (enforced server-side) | Not Found |

---

## Activate `/activate`

| Table | Displayed | Editable |
|-------|-----------|----------|
| `license_keys` | email, key (input); errors for devices | email, key submitted |

---

## Dashboard `/dashboard`

| Table | Displayed | Editable |
|-------|-----------|----------|
| `license_keys` | searches remaining, credits, affiliate ref, bank (affiliate) | bank details via affiliate forms |
| `search_jobs` | query, location, status, counts, queue | create via search |
| `business_leads` | name, phone, email, website, rating, reviews, address, category | selection only |
| `search_history` / `user_searches` | past queries, counts | search again |
| `lead_statuses` | status, notes (if UI exposes) | status select |
| `whatsapp_templates` | niche, title, message | choose / edit message in modal |
| `ai_message_log` | Not shown (logged) | Not Found |
| `outreach_accounts` | balances, tier, mailbox max | via plans |
| `connected_mailboxes` | address, status, caps | connect/disconnect |
| `sent_emails` | recipient, subject, status, opens | mark replied |
| `email_templates` | name, subject, body | select / edit in compose |
| `email_suppression` | Not directly listed | via unsubscribe link |
| `commissions` / payouts | affiliate stats, earned | request payout |
| `domain_email_cache` | Not shown (feeds emails) | Not Found |

---

## Plans `/dashboard/plans`

| Table | Displayed | Editable |
|-------|-----------|----------|
| `outreach_accounts` | status, tier, balances | subscribe/buy |
| `outreach_paystack_plans` | tier pricing/allowance (via constants + API) | Not Found |

---

## Checkout

| Table | Displayed | Editable |
|-------|-----------|----------|
| (pre-create) | email input only | email |
| After pay: `license_keys` | Not on checkout screen | Not Found |

---

## Blog

| Table | Displayed | Editable |
|-------|-----------|----------|
| `blog_posts` | title, slug, excerpt, content, cover, author, category, tags, dates | Admin only |

---

## Admin

| Table | UI surface |
|-------|------------|
| `license_keys` | Lookup, licenses table, generate access, overview |
| `payout_requests` | Affiliate payouts |
| `free_trial_signups` | Trial panels |
| `trial_email_opens` | Email performance |
| `broadcast_log` | Broadcast history |
| `blog_posts` | Blog manager |
| `site_settings` | Global scripts |
| `search_jobs` | Queue status (indirect) |

---

## Not shown in any product UI (examples)

| Table | Note |
|-------|------|
| `credits` | Legacy unused |
| `saved_searches` | Legacy unused |
| `users` | Internal outreach FK identity |
| `global_invalid_emails` | Backend bounce list |
| `outreach_followup_*` | Follow-ups may appear only as send behavior — dedicated UI **Not Found** as named screens |

---

## Redesign implication

Designers should not invent detail pages for fields that never surface (e.g. prediction confidence, dead_emails) unless product adds them. Lead “business detail” is currently **row-level only**, not a separate entity page.
