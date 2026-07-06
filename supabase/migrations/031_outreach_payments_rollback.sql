drop table if exists outreach_paystack_plans;

drop index if exists idx_outreach_accounts_grace_until;

alter table outreach_accounts drop column if exists paystack_subscription_code;

alter table outreach_accounts drop constraint if exists outreach_accounts_subscription_status_check;

alter table outreach_accounts add constraint outreach_accounts_subscription_status_check
  check (subscription_status in ('none', 'active', 'past_due', 'cancelled'));

drop index if exists idx_outreach_credit_transactions_reference;
