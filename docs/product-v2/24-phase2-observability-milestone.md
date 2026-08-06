# LeadThur V2 — Phase 2 Product Intelligence, Monitoring & Observability

**Date:** 2026-08-07  
**Constraint:** Passive only — no product features, UI redesign, business logic, API, or search behaviour changes  
**Status:** Implemented locally; staging schema applied; **not pushed** pending ongoing live traffic validation

---

## 1. Architecture summary

```
Client (batched, beacon)          Server (fire-and-forget queue)
─────────────────────────         ──────────────────────────────
lib/analytics.ts                  observability/track.ts
  → POST /public/events (202)       → insert analytics_events
Behaviour + page trackers           (idempotency unique index)
Funnel page hooks                   Routers / lifecycle / webhooks
CSV export hook                     → alerts + tech snapshots

Admin Analytics workspace
  → GET /admin/observability/*
       overview | events | funnels | searches | errors
       infrastructure | alerts | kpis | events.csv
```

- **Append-only** event store (`analytics_events`)
- **Async batching** on client (~800ms / 20 events) and server (~250ms / 50 events)
- **Idempotency keys** prevent duplicates
- Failures degrade to structured logs — never throw into product paths
- Privacy scrubbing before persist

---

## 2. Event taxonomy

Canonical names live in `backend/src/observability/event-taxonomy.ts`.

| Category | Examples |
|----------|----------|
| Funnel | `landing_viewed` → `freetrial_viewed` → `trial_email_submitted` → `trial_started` → `trial_search_*` → `results_displayed` → `paywall_viewed` → `checkout_started` → `payment_initiated` → `payment_completed` → `license_activated` → `dashboard_entered` → `first_search` → `second_search` → `csv_export` → `mailbox_connected` → `first_outreach` |
| Product | `search_started/completed/failed/cancelled`, `business_*`, filters via properties |
| Outreach | `email_sent/failed/opened/clicked`, `mailbox_*`, `template_used` |
| Billing | `checkout_*`, `payment_*`, `subscription_renewal` |
| Affiliate | `referral_*`, `withdrawal_requested` |
| Behaviour | `page_view`, `page_exit`, `click`, `dead_click`, scroll depth |
| Technical | queue/worker/browser/SMTP/webhook, `exception`, `api_error` |

Dimensions on every row (when known): session, anonymous id, email **hash**, license id, correlation id, search/job id, UTM, referrer, landing page, country, device, browser, OS, duration_ms, properties JSON.

---

## 3. Database / schema additions

Migration: `supabase/migrations/039_analytics_observability.sql`

| Table | Purpose |
|-------|---------|
| `analytics_events` | Append-only events + partial unique on `idempotency_key` |
| `analytics_alerts` | Open/ack/resolved alert state from real metrics |
| `analytics_tech_snapshots` | Queue/memory/latency/failure snapshots |

RLS enabled; `anon` / `authenticated` revoked — **service role only**.

Applied to **LeadPilot Staging** (`ptuarufjtjybedmnlyqb`). Production migration file is in repo for deploy.

---

## 4. Admin analytics pages

Route: `/admin/analytics` (existing shell). Tabs backed by real `/admin/observability/*` data:

Overview · Users · Searches · Revenue · Infrastructure · Errors · Funnels · Workers · Queues · SMTP · Search Health · Alerts

Supported: date range, search, pagination, sorting (where applicable), **CSV export** (`/admin/observability/events.csv`).

Empty / loading / error states use existing admin UI primitives — no invented metrics.

---

## 5. Technical monitoring summary

| Signal | Source |
|--------|--------|
| API latency p50/p95/p99 | In-process ring buffer via `observabilityLatency` middleware |
| Queue active/waiting/failed | `getAdminQueueMetrics()` |
| Redis presence | `getRedisUrl()` |
| Memory RSS/heap | `process.memoryUsage()` |
| Search / SMTP / browser / webhook / API error counts (1h) | `analytics_events` |
| Search lifecycle | `search-job-lifecycle.ts` → queued/start/complete/fail + durations |
| Exceptions | Global Express error handler → `exception` |

Snapshots written on infrastructure poll; alerts evaluated from the same counts.

---

## 6. Alert catalogue

Defined in `backend/src/observability/alerts.ts`:

| Key | Severity |
|-----|----------|
| `search_failure_spike` | critical |
| `smtp_failure_spike` | critical |
| `redis_disconnected` | critical |
| `queue_backlog` | warning |
| `browser_crash_loop` | critical |
| `webhook_failure` | critical |
| `activation_failure` | warning |
| `search_duration_spike` | warning |
| `worker_offline` | critical |
| `checkout_abandonment_high` | warning |
| `api_error_spike` | critical |

---

## 7. Test report

| Check | Result |
|-------|--------|
| Static verify (`verify-observability-phase2.mjs`) | PASS |
| Privacy sanitize strip secrets | PASS |
| Staging tables exist (`analytics_*`) | PASS |
| Backend `tsc --noEmit` | PASS (after queue mode + latency fixes) |
| Frontend `tsc --noEmit` | PASS (after `getTrialEmail` fix) |
| Idempotency: trial client+server same keys | Unique index collapses duplicates |
| Removed duplicate client `search_started` | Done (server authoritative) |
| Live E2E against production traffic | Deferred until deploy — ingest returns 202 and no-ops safely if table missing |

Scripts:

```bash
node backend/scripts/verify-observability-phase2.mjs
node backend/scripts/verify-observability-privacy.mjs
```

---

## 8. Performance impact

- Client: batched beacon/fetch; no await on UI paths; flush on `pagehide` / visibility hidden
- Server: in-memory queue + delayed flush; product handlers call `trackEvent` without awaiting
- Public ingest always **202** before processing
- Admin queries are read-only and paginated

Expected UI impact: **none measurable** under normal load.

---

## 9. Bugs found

1. Partial unique index + upsert conflict handling incorrect for PostgREST  
2. Admin infra typed `mode: "inline"` only — broke `tsc` when BullMQ metrics returned  
3. Free trial paywall tracker referenced undefined `trialEmail`  
4. Client `search_started` would double-count vs server (`different` idempotency keys)  
5. Mailbox disconnect had no event  
6. CSV export had no event  
7. API latency not recorded for infrastructure tab  

---

## 10. Bugs fixed

1. Insert + ignore `23505` duplicates in `track.ts`  
2. Widened queue metrics type  
3. Paywall uses `getTrialEmail()`  
4. Removed client `search_started` from `useSearch`  
5. Disconnect emits `mailbox_disconnected`  
6. `exportToCSV` emits `csv_export`  
7. Latency middleware + snapshot fields wired  

---

## 11. Remaining technical debt

- Apply migration **039** to production on next controlled deploy  
- Country resolution (GeoIP / Cloudflare header) not yet populated on all events  
- Email open/click still rely partly on existing pixel/tracking routes — ensure property mapping is complete under load  
- Subscription renewal and second-visit heuristics need longer windows of real data to validate  
- Dedicated worker/SMTP health probes beyond event-derived counts  
- Rich session replay / heatmaps intentionally out of scope (passive first-party events only)  
- Behaviour scroll depth currently piggybacks `page_view` with `kind: scroll_depth` — consider dedicated event if volume grows  

---

## Key paths

| Area | Path |
|------|------|
| Migration | `supabase/migrations/039_analytics_observability.sql` |
| Backend | `backend/src/observability/*` |
| Client | `frontend/lib/analytics.ts`, `frontend/components/analytics/*` |
| Admin UI | `frontend/components/admin/workspaces/analytics-workspace.tsx` |
| Verify | `backend/scripts/verify-observability-phase2.mjs` |
