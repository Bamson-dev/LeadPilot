-- Outreach follow-up sequencing (up to 3 steps, min 2-day gaps)

create table if not exists outreach_followup_batches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  send_mode text not null check (send_mode in ('auto', 'manual')),
  mailbox_id uuid references connected_mailboxes(id) on delete set null,
  followup_enabled boolean not null default false,
  total_targets integer not null default 0 check (total_targets >= 0),
  created_at timestamptz not null default now(),
  paused_at timestamptz,
  cancelled_at timestamptz
);

create index if not exists idx_outreach_followup_batches_user_created
  on outreach_followup_batches (user_id, created_at desc);

create table if not exists outreach_followup_steps (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references outreach_followup_batches(id) on delete cascade,
  step_number integer not null check (step_number between 1 and 3),
  gap_days integer not null check (gap_days >= 2),
  subject text not null,
  body text not null,
  created_at timestamptz not null default now(),
  unique (batch_id, step_number)
);

create index if not exists idx_outreach_followup_steps_batch_step
  on outreach_followup_steps (batch_id, step_number);

alter table sent_emails
  add column if not exists followup_batch_id uuid references outreach_followup_batches(id) on delete set null,
  add column if not exists root_sent_email_id uuid references sent_emails(id) on delete set null,
  add column if not exists send_kind text not null default 'initial'
    check (send_kind in ('initial', 'followup')),
  add column if not exists followup_step_number integer,
  add column if not exists followup_due_at timestamptz,
  add column if not exists followup_stopped_at timestamptz,
  add column if not exists followup_stop_reason text
    check (followup_stop_reason is null or followup_stop_reason in ('replied', 'bounced', 'unsubscribed', 'suppressed', 'paused', 'cancelled', 'completed')),
  add column if not exists replied_at timestamptz;

create index if not exists idx_sent_emails_followup_batch
  on sent_emails (followup_batch_id);

create index if not exists idx_sent_emails_root_step
  on sent_emails (root_sent_email_id, followup_step_number);
