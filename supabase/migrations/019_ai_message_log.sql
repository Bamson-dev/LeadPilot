alter table if exists license_keys
  add column if not exists ai_bonus_applied boolean not null default false;

create table if not exists ai_message_log (
  id uuid primary key default gen_random_uuid(),
  email text not null references license_keys(email) on delete cascade,
  business_name text not null,
  niche text,
  created_at timestamptz not null default now()
);

create index if not exists idx_ai_message_log_email
  on ai_message_log (email, created_at desc);
