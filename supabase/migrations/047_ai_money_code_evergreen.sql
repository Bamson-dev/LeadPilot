-- AI Money Code: evergreen per-recipient campaign fields (additive)

alter table email_campaign_settings
  add column if not exists evergreen_mode boolean not null default true;

alter table email_campaign_recipients
  add column if not exists campaign_start_date date null,
  add column if not exists personal_deadline_at timestamptz null,
  add column if not exists enrolled_at timestamptz null,
  add column if not exists completed_at timestamptz null;

-- Backfill existing recipients from eligibility/created timestamps (Africa/Lagos calendar day)
update email_campaign_recipients
set
  enrolled_at = coalesce(enrolled_at, eligibility_at, created_at),
  campaign_start_date = coalesce(
    campaign_start_date,
    (timezone('Africa/Lagos', coalesce(eligibility_at, created_at)))::date
  )
where campaign_key = 'ai-money-code-2026';

-- Personal deadline = end of recipient Day 30 at 23:59 Africa/Lagos
update email_campaign_recipients
set personal_deadline_at = (
  ((campaign_start_date + interval '29 days')::timestamp + time '23:59:00') at time zone 'Africa/Lagos'
)
where campaign_key = 'ai-money-code-2026'
  and personal_deadline_at is null
  and campaign_start_date is not null;

alter table email_campaign_recipients
  alter column campaign_start_date set not null,
  alter column personal_deadline_at set not null,
  alter column enrolled_at set not null;

create index if not exists email_campaign_recipients_status_idx
  on email_campaign_recipients (campaign_key, status);

create index if not exists email_campaign_recipients_start_idx
  on email_campaign_recipients (campaign_key, campaign_start_date);

create index if not exists email_campaign_recipients_deadline_idx
  on email_campaign_recipients (campaign_key, personal_deadline_at);

create unique index if not exists email_campaign_recipient_day_send_once
  on email_campaign_sends (recipient_id, scheduled_date)
  where status = 'success';
