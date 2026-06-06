-- Search credits and top-up purchase tracking
alter table license_keys
add column if not exists search_credits integer not null default 0,
add column if not exists total_credits_purchased integer not null default 0;

update license_keys
set monthly_search_limit = 100
where monthly_search_limit is null or monthly_search_limit = 0;

update license_keys
set last_reset_at = activated_at
where last_reset_at is null and activated = true;

create table if not exists topup_purchases (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  license_id uuid not null,
  credits_purchased integer not null,
  amount_ngn integer not null,
  payment_reference text unique,
  payment_channel text,
  created_at timestamptz default now()
);
