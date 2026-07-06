-- Outreach payments: grace status, Paystack subscription code, plan code storage

alter table outreach_accounts drop constraint if exists outreach_accounts_subscription_status_check;

alter table outreach_accounts add constraint outreach_accounts_subscription_status_check
  check (subscription_status in ('none', 'active', 'grace', 'past_due', 'cancelled'));

alter table outreach_accounts
  add column if not exists paystack_subscription_code text;

create index if not exists idx_outreach_accounts_grace_until
  on outreach_accounts (grace_until)
  where subscription_status = 'grace';

create table if not exists outreach_paystack_plans (
  tier text primary key
    check (tier in ('starter', 'growth', 'scale')),
  plan_code text not null,
  amount_kobo integer not null check (amount_kobo > 0),
  monthly_allowance integer not null check (monthly_allowance > 0),
  max_mailboxes integer not null check (max_mailboxes > 0),
  updated_at timestamptz not null default now()
);

create index if not exists idx_outreach_credit_transactions_reference
  on outreach_credit_transactions (reference)
  where reference is not null;
