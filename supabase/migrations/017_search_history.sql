create table if not exists search_history (
  id uuid primary key default gen_random_uuid(),
  email text not null references license_keys(email) on delete cascade,
  business_type text not null,
  city text not null,
  country text,
  results_count integer default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_search_history_email
  on search_history (email, created_at desc);
