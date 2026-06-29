create table if not exists public.broadcast_log (
  id uuid default gen_random_uuid() primary key,
  subject text not null,
  audience text not null,
  recipient_count integer not null,
  sent_at timestamptz default now(),
  sent_by text default 'admin'
);

alter table public.broadcast_log enable row level security;

create index if not exists broadcast_log_sent_at_idx
  on public.broadcast_log (sent_at desc);
