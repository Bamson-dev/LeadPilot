-- Phase 2: Product Intelligence — passive observability store
-- Append-only event log + alert state. Service role only (RLS deny public).

create table if not exists public.analytics_events (
  id uuid primary key default gen_random_uuid(),
  event_name text not null,
  event_category text not null,
  occurred_at timestamptz not null default now(),
  received_at timestamptz not null default now(),
  session_id text,
  anonymous_id text,
  user_email_hash text,
  license_id text,
  correlation_id text,
  search_id text,
  job_id text,
  source text not null default 'server',
  environment text not null default 'production',
  page_path text,
  referrer text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  landing_page text,
  country text,
  device text,
  browser text,
  os text,
  properties jsonb not null default '{}'::jsonb,
  duration_ms integer,
  idempotency_key text,
  created_at timestamptz not null default now()
);

create unique index if not exists analytics_events_idempotency_uidx
  on public.analytics_events (idempotency_key)
  where idempotency_key is not null;

create index if not exists analytics_events_name_time_idx
  on public.analytics_events (event_name, occurred_at desc);

create index if not exists analytics_events_category_time_idx
  on public.analytics_events (event_category, occurred_at desc);

create index if not exists analytics_events_session_idx
  on public.analytics_events (session_id, occurred_at desc);

create index if not exists analytics_events_search_idx
  on public.analytics_events (search_id)
  where search_id is not null;

create index if not exists analytics_events_correlation_idx
  on public.analytics_events (correlation_id)
  where correlation_id is not null;

create table if not exists public.analytics_alerts (
  id uuid primary key default gen_random_uuid(),
  alert_key text not null,
  severity text not null check (severity in ('info', 'warning', 'critical')),
  title text not null,
  message text not null,
  status text not null default 'open' check (status in ('open', 'acknowledged', 'resolved')),
  metric_name text,
  metric_value numeric,
  threshold_value numeric,
  environment text not null default 'production',
  context jsonb not null default '{}'::jsonb,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

create unique index if not exists analytics_alerts_open_key_uidx
  on public.analytics_alerts (alert_key)
  where status = 'open';

create index if not exists analytics_alerts_status_time_idx
  on public.analytics_alerts (status, last_seen_at desc);

create table if not exists public.analytics_tech_snapshots (
  id uuid primary key default gen_random_uuid(),
  captured_at timestamptz not null default now(),
  environment text not null default 'production',
  queue_active integer,
  queue_waiting integer,
  queue_failed_24h integer,
  queue_mode text,
  memory_rss_mb numeric,
  memory_heap_mb numeric,
  api_latency_p50_ms numeric,
  api_latency_p95_ms numeric,
  smtp_failures_1h integer,
  search_failures_1h integer,
  browser_ready boolean,
  redis_connected boolean,
  properties jsonb not null default '{}'::jsonb
);

create index if not exists analytics_tech_snapshots_time_idx
  on public.analytics_tech_snapshots (captured_at desc);

alter table public.analytics_events enable row level security;
alter table public.analytics_alerts enable row level security;
alter table public.analytics_tech_snapshots enable row level security;

revoke all on table public.analytics_events from anon, authenticated;
revoke all on table public.analytics_alerts from anon, authenticated;
revoke all on table public.analytics_tech_snapshots from anon, authenticated;

comment on table public.analytics_events is 'Phase 2 passive product analytics event store. No passwords, license keys, card data, or secrets.';
comment on table public.analytics_alerts is 'Phase 2 observability alerts derived from real metrics.';
comment on table public.analytics_tech_snapshots is 'Phase 2 periodic infrastructure snapshots.';
