-- Production RLS: lock down tables from anon/authenticated clients.
-- Backend uses SUPABASE_SERVICE_KEY (service_role), which bypasses RLS.

alter table if exists search_jobs enable row level security;
alter table if exists business_leads enable row level security;
alter table if exists users enable row level security;
alter table if exists credits enable row level security;
alter table if exists saved_searches enable row level security;

-- Legacy table name (if present from older installs)
alter table if exists searches enable row level security;
alter table if exists leads enable row level security;

-- No permissive policies for anon or authenticated roles.
-- All product data access goes through the backend service role only.
