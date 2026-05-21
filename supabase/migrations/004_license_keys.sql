create table if not exists license_keys (
  id uuid primary key default uuid_generate_v4(),
  email text not null,
  key text unique not null,
  activated boolean default false,
  activated_at timestamptz,
  payment_channel text not null default 'bank_transfer',
  payment_reference text unique,
  searches_used integer default 0,
  exports_used integer default 0,
  created_at timestamptz default now()
);

create index if not exists idx_license_keys_email on license_keys(email);
create index if not exists idx_license_keys_payment_reference on license_keys(payment_reference);
create index if not exists idx_license_keys_created_at on license_keys(created_at desc);

alter table if exists license_keys enable row level security;
