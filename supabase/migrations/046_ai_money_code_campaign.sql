-- AI Money Code paid-user campaign (isolated additive module)

create table if not exists email_campaign_settings (
  campaign_key text primary key,
  campaign_name text not null,
  enabled boolean not null default false,
  activated_at timestamptz null,
  campaign_start_date date not null,
  timezone text not null,
  deadline_at timestamptz not null,
  webinar_url text not null,
  offer_url text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists email_campaign_recipients (
  id uuid primary key default gen_random_uuid(),
  campaign_key text not null references email_campaign_settings(campaign_key) on delete cascade,
  license_id uuid null,
  email text not null,
  normalized_email text not null,
  eligibility_at timestamptz null,
  status text not null default 'enrolled' check (status in ('enrolled','paused','completed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (campaign_key, normalized_email)
);

create table if not exists email_campaign_sends (
  id uuid primary key default gen_random_uuid(),
  campaign_key text not null references email_campaign_settings(campaign_key) on delete cascade,
  recipient_id uuid not null references email_campaign_recipients(id) on delete cascade,
  normalized_email text not null,
  campaign_day integer not null check (campaign_day between 1 and 30),
  scheduled_date date not null,
  subject text not null,
  cta_url text not null,
  status text not null check (status in ('pending','success','failed')),
  provider_message_id text null,
  sent_at timestamptz null,
  retry_count integer not null default 0,
  error_summary text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (campaign_key, recipient_id, campaign_day, retry_count)
);

create unique index if not exists email_campaign_day_send_unique_success
  on email_campaign_sends (campaign_key, recipient_id, campaign_day)
  where status = 'success';

create index if not exists email_campaign_sends_day_idx
  on email_campaign_sends (campaign_key, campaign_day, status, created_at desc);

create table if not exists email_campaign_run_logs (
  id uuid primary key default gen_random_uuid(),
  campaign_key text not null references email_campaign_settings(campaign_key) on delete cascade,
  trigger text not null,
  started_at timestamptz not null default now(),
  completed_at timestamptz null,
  recipients_evaluated integer not null default 0,
  emails_sent integer not null default 0,
  skipped integer not null default 0,
  failures integer not null default 0,
  error_summary text null
);

create index if not exists email_campaign_runs_started_idx
  on email_campaign_run_logs (campaign_key, started_at desc);

alter table email_campaign_settings enable row level security;
alter table email_campaign_recipients enable row level security;
alter table email_campaign_sends enable row level security;
alter table email_campaign_run_logs enable row level security;

revoke all on table email_campaign_settings from anon, authenticated;
revoke all on table email_campaign_recipients from anon, authenticated;
revoke all on table email_campaign_sends from anon, authenticated;
revoke all on table email_campaign_run_logs from anon, authenticated;
