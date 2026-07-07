-- Outreach bounce handling: global invalid list, dead emails in domain cache, mailbox pause status

create table if not exists global_invalid_emails (
  email text primary key,
  smtp_code integer,
  reason text not null,
  bounced_at timestamptz not null default now()
);

create index if not exists idx_global_invalid_emails_bounced_at
  on global_invalid_emails (bounced_at desc);

alter table domain_email_cache
  add column if not exists dead_emails text[] not null default '{}';

alter table connected_mailboxes drop constraint if exists connected_mailboxes_status_check;

alter table connected_mailboxes add constraint connected_mailboxes_status_check
  check (status in ('active', 'disconnected', 'error', 'paused_bounce'));
