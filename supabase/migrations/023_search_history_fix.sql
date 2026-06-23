-- Ensure search_history exists on production (may have been skipped).
create table if not exists search_history (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  business_type text not null,
  city text not null,
  country text,
  results_count integer default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_search_history_email
  on search_history (email, created_at desc);

-- FK on email blocked inserts when license_keys.email casing differed; history is keyed by normalized email in app code.
alter table search_history drop constraint if exists search_history_email_fkey;
