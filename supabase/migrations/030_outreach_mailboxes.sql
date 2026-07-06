-- In-platform outreach: accounts, mailboxes, credits ledger, sent log, suppression, templates

create table if not exists outreach_accounts (
  user_id uuid primary key references users(id) on delete cascade,
  subscription_status text not null default 'none'
    check (subscription_status in ('none', 'active', 'past_due', 'cancelled')),
  subscription_tier text
    check (subscription_tier is null or subscription_tier in ('starter', 'growth', 'scale')),
  subscription_renews_at timestamptz,
  grace_until timestamptz,
  max_mailboxes integer not null default 1 check (max_mailboxes >= 0),
  monthly_allowance integer not null default 0 check (monthly_allowance >= 0),
  monthly_allowance_remaining integer not null default 0 check (monthly_allowance_remaining >= 0),
  monthly_allowance_reset_at timestamptz,
  purchased_credits_balance integer not null default 0 check (purchased_credits_balance >= 0),
  free_sends_granted integer not null default 0 check (free_sends_granted >= 0),
  free_sends_used integer not null default 0 check (free_sends_used >= 0),
  free_sends_expire_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists connected_mailboxes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  email_address text not null,
  encrypted_app_password text,
  smtp_host text not null default 'smtp.gmail.com',
  smtp_port integer not null default 587 check (smtp_port > 0),
  account_type text not null default 'personal'
    check (account_type in ('personal', 'workspace')),
  status text not null default 'active'
    check (status in ('active', 'disconnected', 'error')),
  daily_cap integer not null default 300 check (daily_cap > 0),
  daily_send_count integer not null default 0 check (daily_send_count >= 0),
  daily_count_reset_at timestamptz,
  last_verified_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  unique (user_id, email_address)
);

create index if not exists idx_connected_mailboxes_user_id
  on connected_mailboxes (user_id);

create index if not exists idx_connected_mailboxes_user_id_status
  on connected_mailboxes (user_id, status);

create table if not exists outreach_credit_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  type text not null
    check (type in ('purchase', 'monthly_refill', 'spend', 'refund', 'trial_grant', 'expiry')),
  bucket text not null
    check (bucket in ('monthly_allowance', 'purchased_credits', 'free_trial')),
  amount integer not null,
  reference text,
  created_at timestamptz not null default now()
);

create index if not exists idx_outreach_credit_transactions_user_created
  on outreach_credit_transactions (user_id, created_at desc);

create table if not exists sent_emails (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  mailbox_id uuid references connected_mailboxes(id) on delete set null,
  lead_id uuid,
  search_id uuid,
  recipient_email text not null,
  business_name text,
  subject text not null,
  body text not null,
  status text not null default 'queued'
    check (status in ('queued', 'sending', 'sent', 'failed', 'bounced', 'suppressed')),
  credit_bucket text
    check (credit_bucket is null or credit_bucket in ('monthly_allowance', 'purchased_credits', 'free_trial')),
  provider_message_id text,
  tracking_token text unique,
  error_message text,
  opened_at timestamptz,
  open_count integer not null default 0 check (open_count >= 0),
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_sent_emails_user_id on sent_emails (user_id);
create index if not exists idx_sent_emails_status on sent_emails (status);
create index if not exists idx_sent_emails_tracking_token on sent_emails (tracking_token);

create table if not exists email_suppression (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  recipient_email text not null,
  unsubscribed_at timestamptz not null default now(),
  unique (user_id, recipient_email)
);

create table if not exists email_templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade,
  name text not null,
  subject text not null,
  body text not null,
  niche text,
  created_at timestamptz not null default now()
);

create index if not exists idx_email_templates_user_id on email_templates (user_id);
create index if not exists idx_email_templates_niche on email_templates (niche);

create or replace function update_outreach_accounts_timestamp()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists outreach_accounts_updated_at on outreach_accounts;
create trigger outreach_accounts_updated_at
before update on outreach_accounts
for each row execute function update_outreach_accounts_timestamp();

insert into email_templates (user_id, name, subject, body, niche)
select null, v.name, v.subject, v.body, v.niche
from (values
  (
    'No website found',
    'Quick idea for [Business Name]',
    'Hi [Business Name], I came across your business while researching your area and noticed you don''t have a website yet. I help businesses like yours get a clean, mobile friendly site that brings in more customers. Would you be open to a quick chat about it?',
    'web_design'
  ),
  (
    'Low Instagram activity',
    'Idea for [Business Name] on social',
    'Hi [Business Name], I noticed your Instagram isn''t very active. I help businesses like yours stay consistent on social media and bring in more foot traffic. Want me to show you what that could look like for you?',
    'social_media'
  ),
  (
    'Low Google rating',
    'Quick note on [Business Name] online visibility',
    'Hi [Business Name], I came across your business and noticed your Google rating could use some attention. I help businesses improve how they show up online and attract more customers. Open to a quick conversation?',
    'seo'
  ),
  (
    'Weak website copy',
    'Your website copy for [Business Name]',
    'Hi [Business Name], I checked out your website and think the messaging could do a lot more to convert visitors into customers. I help businesses with copy that actually gets people to take action. Want to see some examples?',
    'copywriting'
  )
) as v(name, subject, body, niche)
where not exists (
  select 1 from email_templates et
  where et.user_id is null and et.niche = v.niche
);
