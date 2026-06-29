create table if not exists public.trial_email_opens (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  step integer not null check (step >= 1 and step <= 15),
  open_count integer not null default 1,
  first_opened_at timestamptz not null default now(),
  last_opened_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (email, step)
);

alter table public.trial_email_opens enable row level security;

create index if not exists trial_email_opens_email_idx
  on public.trial_email_opens (email);

create index if not exists trial_email_opens_step_idx
  on public.trial_email_opens (step);
