create table if not exists free_trial_signups (
  id uuid default gen_random_uuid() primary key,
  email text not null unique,
  signed_up_at timestamptz default now(),
  searches_used integer default 0,
  converted boolean default false,
  converted_at timestamptz,
  sequence_step integer default 0,
  sequence_paused boolean default false,
  last_email_sent_at timestamptz,
  created_at timestamptz default now()
);

create index if not exists free_trial_signups_email_idx on free_trial_signups (email);
create index if not exists free_trial_signups_converted_idx on free_trial_signups (converted);
create index if not exists free_trial_signups_signed_up_at_idx on free_trial_signups (signed_up_at desc);

alter table free_trial_signups enable row level security;
