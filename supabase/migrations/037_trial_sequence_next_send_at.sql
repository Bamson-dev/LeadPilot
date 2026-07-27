alter table public.free_trial_signups
  add column if not exists next_sequence_email_at timestamptz;

create index if not exists free_trial_signups_next_sequence_due_idx
  on public.free_trial_signups (next_sequence_email_at)
  where converted = false
    and sequence_paused = false
    and next_sequence_email_at is not null;
