-- Phase 2.1: attribution columns + query helpers for product intelligence polish
-- Additive only. Does not change product tables or business behaviour.

alter table public.analytics_events
  add column if not exists utm_content text,
  add column if not exists utm_term text,
  add column if not exists fbclid text,
  add column if not exists gclid text;

create index if not exists analytics_events_email_hash_time_idx
  on public.analytics_events (user_email_hash, occurred_at desc)
  where user_email_hash is not null;

create index if not exists analytics_events_license_time_idx
  on public.analytics_events (license_id, occurred_at desc)
  where license_id is not null;

create index if not exists analytics_events_utm_source_time_idx
  on public.analytics_events (utm_source, occurred_at desc)
  where utm_source is not null;

comment on column public.analytics_events.utm_content is 'Phase 2.1 attribution: utm_content';
comment on column public.analytics_events.utm_term is 'Phase 2.1 attribution: utm_term';
comment on column public.analytics_events.fbclid is 'Phase 2.1 attribution: Facebook click id';
comment on column public.analytics_events.gclid is 'Phase 2.1 attribution: Google click id';
