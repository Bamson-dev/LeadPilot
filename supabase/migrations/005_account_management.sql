-- Run once in Supabase SQL Editor (safe to re-run)

alter table license_keys
  add column if not exists search_count integer default 0,
  add column if not exists monthly_search_limit integer default 100,
  add column if not exists export_count integer default 0,
  add column if not exists last_reset_at timestamptz default now(),
  add column if not exists device_one text,
  add column if not exists device_two text,
  add column if not exists is_suspended boolean default false,
  add column if not exists suspension_reason text,
  add column if not exists notes text;

-- Backfill search_count from legacy column if present
update license_keys
set search_count = coalesce(search_count, searches_used, 0)
where search_count is null or search_count = 0;

update license_keys
set export_count = coalesce(export_count, exports_used, 0)
where export_count is null or export_count = 0;
