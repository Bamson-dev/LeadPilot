-- Trial email sequence v2 + post-search abandonment trigger.
-- Existing signups keep sequence_version = 1 (15-email schedule).
-- New signups after deploy get sequence_version = 2 (20-email schedule).

alter table public.free_trial_signups
  add column if not exists sequence_version integer not null default 1;

alter table public.free_trial_signups
  add column if not exists post_search_email_scheduled_at timestamptz;

alter table public.free_trial_signups
  add column if not exists post_search_email_sent_at timestamptz;

alter table public.free_trial_signups
  add column if not exists post_search_query text;

alter table public.free_trial_signups
  add column if not exists post_search_location text;

alter table public.trial_email_opens
  drop constraint if exists trial_email_opens_step_check;

alter table public.trial_email_opens
  add constraint trial_email_opens_step_check check (step >= 1 and step <= 100);

create index if not exists free_trial_signups_post_search_due_idx
  on public.free_trial_signups (post_search_email_scheduled_at)
  where post_search_email_sent_at is null
    and converted = false
    and sequence_paused = false;
