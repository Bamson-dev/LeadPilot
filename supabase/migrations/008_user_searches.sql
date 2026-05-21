-- User searches history
create table if not exists user_searches (
  id uuid primary key default uuid_generate_v4(),
  license_key text not null,
  search_id uuid references search_jobs(id),
  query text not null,
  location text not null,
  total_found integer default 0,
  created_at timestamptz default now()
);

create index if not exists idx_user_searches_license_key on user_searches(license_key);
create index if not exists idx_user_searches_search_id on user_searches(search_id);
create index if not exists idx_user_searches_created_at on user_searches(created_at desc);

-- Search limit columns (idempotent)
alter table license_keys
  add column if not exists search_count integer default 0,
  add column if not exists monthly_search_limit integer default 100,
  add column if not exists last_reset_at timestamptz default now(),
  add column if not exists is_suspended boolean default false,
  add column if not exists suspension_reason text,
  add column if not exists notes text,
  add column if not exists limit_email_sent boolean default false,
  add column if not exists device_one text,
  add column if not exists device_two text;

create or replace function increment_search_count(license_id uuid)
returns void as $$
  update license_keys
  set search_count = search_count + 1
  where id = license_id;
$$ language sql;
