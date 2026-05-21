-- Run in Supabase SQL Editor (safe to re-run)

alter table license_keys
  add column if not exists search_count integer default 0,
  add column if not exists monthly_search_limit integer default 100,
  add column if not exists last_reset_at timestamptz default now(),
  add column if not exists is_suspended boolean default false,
  add column if not exists suspension_reason text,
  add column if not exists notes text;

create or replace function increment_search_count(license_id uuid)
returns void as $$
  update license_keys
  set search_count = search_count + 1
  where id = license_id;
$$ language sql;
