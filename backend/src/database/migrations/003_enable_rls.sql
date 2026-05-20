-- Production RLS: deny direct anon/authenticated access; backend uses service_role.

alter table if exists search_jobs enable row level security;
alter table if exists business_leads enable row level security;
alter table if exists users enable row level security;
alter table if exists credits enable row level security;
alter table if exists saved_searches enable row level security;

alter table if exists searches enable row level security;
alter table if exists leads enable row level security;
