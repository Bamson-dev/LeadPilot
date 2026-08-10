-- Isolated Google Search Console OAuth + analytics storage.
-- Does not modify existing LeadThur tables.

create table if not exists google_search_console_connections (
  id uuid primary key default gen_random_uuid(),
  provider text not null default 'google_search_console',
  site_url text not null,
  google_account_email text,
  refresh_token_encrypted text,
  scopes text[] not null default array[]::text[],
  status text not null default 'disconnected'
    check (status in ('disconnected', 'connected', 'error', 'revoked')),
  connected_at timestamptz,
  last_sync_at timestamptz,
  last_successful_sync_at timestamptz,
  next_sync_at timestamptz,
  last_error_at timestamptz,
  last_error_code text,
  last_error_message text,
  rows_collected integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists google_search_console_connections_site_uidx
  on google_search_console_connections (site_url);

create table if not exists google_search_console_oauth_states (
  id uuid primary key default gen_random_uuid(),
  state_hash text not null unique,
  admin_email text not null,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists google_search_console_oauth_states_expires_idx
  on google_search_console_oauth_states (expires_at);

create table if not exists google_search_console_daily (
  id uuid primary key default gen_random_uuid(),
  site_url text not null,
  report_date date not null,
  clicks integer not null default 0,
  impressions integer not null default 0,
  ctr numeric(10, 6) not null default 0,
  position numeric(10, 4) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (site_url, report_date)
);

create table if not exists google_search_console_pages (
  id uuid primary key default gen_random_uuid(),
  site_url text not null,
  report_date date not null,
  page text not null,
  clicks integer not null default 0,
  impressions integer not null default 0,
  ctr numeric(10, 6) not null default 0,
  position numeric(10, 4) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (site_url, report_date, page)
);

create index if not exists google_search_console_pages_site_date_idx
  on google_search_console_pages (site_url, report_date desc);

create table if not exists google_search_console_queries (
  id uuid primary key default gen_random_uuid(),
  site_url text not null,
  report_date date not null,
  query text not null,
  clicks integer not null default 0,
  impressions integer not null default 0,
  ctr numeric(10, 6) not null default 0,
  position numeric(10, 4) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (site_url, report_date, query)
);

create index if not exists google_search_console_queries_site_date_idx
  on google_search_console_queries (site_url, report_date desc);

create table if not exists google_search_console_sync_runs (
  id uuid primary key default gen_random_uuid(),
  site_url text not null,
  trigger text not null default 'scheduler'
    check (trigger in ('scheduler', 'manual', 'connect')),
  status text not null default 'running'
    check (status in ('running', 'success', 'failed')),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  rows_upserted integer not null default 0,
  error_code text,
  error_message text
);

create index if not exists google_search_console_sync_runs_started_idx
  on google_search_console_sync_runs (started_at desc);

alter table google_search_console_connections enable row level security;
alter table google_search_console_oauth_states enable row level security;
alter table google_search_console_daily enable row level security;
alter table google_search_console_pages enable row level security;
alter table google_search_console_queries enable row level security;
alter table google_search_console_sync_runs enable row level security;

revoke all on table google_search_console_connections from anon, authenticated;
revoke all on table google_search_console_oauth_states from anon, authenticated;
revoke all on table google_search_console_daily from anon, authenticated;
revoke all on table google_search_console_pages from anon, authenticated;
revoke all on table google_search_console_queries from anon, authenticated;
revoke all on table google_search_console_sync_runs from anon, authenticated;
