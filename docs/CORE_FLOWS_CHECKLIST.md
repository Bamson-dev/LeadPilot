# Core flows checklist (do these in order)

## 1. Admin system

**Coolify env (backend):**
```
ADMIN_EMAIL=...
ADMIN_PASSWORD=...
JWT_SECRET=<openssl rand -hex 64>
BREVO_API_KEY=...
BREVO_SENDER_EMAIL=access@leadthur.com
SUPABASE_URL=...
SUPABASE_SERVICE_KEY=...
FRONTEND_URL=https://www.leadthur.com
```

**Supabase:** Run `supabase/migrations/004_license_keys.sql`

**Test:**
1. Open https://www.leadthur.com/admin
2. Log in with `ADMIN_EMAIL` / `ADMIN_PASSWORD`
3. Generate access for a test email
4. Confirm Brevo email arrives with license key

---

## 2. Paystack webhook

**Coolify:** `PAYSTACK_SECRET_KEY=sk_live_...`, `LIFETIME_ACCESS_PRICE=3000000`

**Paystack dashboard:**
- Webhook: `https://backend.leadthur.com/webhooks/paystack`
- Success URL: `https://www.leadthur.com/payment-success`

**Test:** Real ₦30,000 payment → license row in Supabase → activation email

---

## 3. Search (leads on screen)

**Vercel:** `NEXT_PUBLIC_API_URL=https://backend.leadthur.com`

**Test:**
1. Activate at `/activate`
2. Run search on dashboard
3. Leads should appear within ~30s (first batch after Maps scroll)
4. If SSE drops, polling still fills the table every 8s

---

## 4. Full buyer journey

1. Pay via Paystack → `/payment-success`
2. Email → `/activate` with key
3. Dashboard search → results stream in
4. Export CSV

---

## After all four work

Implement search limits per `docs/SEARCH_LIMITS_ROADMAP.md`.
