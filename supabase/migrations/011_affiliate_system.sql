-- Affiliate programme: ref codes, commissions, payouts, bank details

alter table license_keys
add column if not exists ref_code text unique;

alter table license_keys
add column if not exists total_referrals integer default 0;

alter table license_keys
add column if not exists total_earned_ngn integer default 0;

alter table license_keys
add column if not exists total_paid_ngn integer default 0;

alter table license_keys
add column if not exists bank_name text;

alter table license_keys
add column if not exists bank_code text;

alter table license_keys
add column if not exists account_number text;

alter table license_keys
add column if not exists account_name text;

alter table license_keys
add column if not exists paystack_recipient_code text;

create table if not exists commissions (
  id uuid primary key default uuid_generate_v4(),
  referrer_email text not null,
  referrer_ref_code text not null,
  referred_email text not null,
  sale_amount_ngn integer not null default 30000,
  commission_ngn integer not null default 15000,
  sale_amount_usd numeric(10,2) not null default 30.00,
  commission_usd numeric(10,2) not null default 15.00,
  status text not null default 'pending',
  created_at timestamptz default now()
);

create table if not exists payout_requests (
  id uuid primary key default uuid_generate_v4(),
  referrer_email text not null,
  ref_code text not null,
  amount_ngn integer not null,
  amount_usd numeric(10,2) not null,
  bank_name text not null,
  bank_code text not null,
  account_number text not null,
  account_name text not null,
  paystack_recipient_code text,
  status text not null default 'pending',
  paystack_transfer_code text,
  paystack_transfer_reference text,
  failure_reason text,
  created_at timestamptz default now(),
  paid_at timestamptz
);

create index if not exists idx_commissions_referrer_email on commissions(referrer_email);
create index if not exists idx_payout_requests_referrer_email on payout_requests(referrer_email);
create index if not exists idx_payout_requests_status on payout_requests(status);

update license_keys
set ref_code = upper(substring(replace(gen_random_uuid()::text, '-', ''), 1, 8))
where ref_code is null and activated = true;

alter table if exists commissions enable row level security;
alter table if exists payout_requests enable row level security;
