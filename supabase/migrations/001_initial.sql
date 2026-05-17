-- LeadPilot initial schema

create table if not exists searches (
  id uuid primary key default gen_random_uuid(),
  search_term text not null,
  location text not null,
  total_results integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists leads (
  id uuid primary key default gen_random_uuid(),
  search_id uuid not null references searches(id) on delete cascade,
  business_name text not null,
  phone text,
  email text,
  website text,
  address text,
  rating numeric,
  reviews_count integer,
  category text,
  google_maps_url text,
  created_at timestamptz not null default now()
);

create index if not exists leads_search_id_idx on leads(search_id);
create index if not exists searches_created_at_idx on searches(created_at desc);

alter table searches enable row level security;
alter table leads enable row level security;

create policy "Allow public read searches" on searches for select using (true);
create policy "Allow public read leads" on leads for select using (true);
create policy "Allow public insert searches" on searches for insert with check (true);
create policy "Allow public insert leads" on leads for insert with check (true);
create policy "Allow public update searches" on searches for update using (true);
