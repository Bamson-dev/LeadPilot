create extension if not exists "uuid-ossp";

create table search_jobs (
  id uuid primary key default uuid_generate_v4(),
  query text not null,
  location text not null,
  status text not null default 'pending',
  total_found integer default 0,
  processed integer default 0,
  error text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table business_leads (
  id uuid primary key default uuid_generate_v4(),
  search_id uuid references search_jobs(id) on delete cascade,
  name text not null,
  category text,
  address text,
  phone text,
  email text,
  email_source text default 'none',
  website text,
  rating numeric(3,1),
  review_count integer,
  google_maps_url text,
  has_website boolean default false,
  has_instagram boolean default false,
  created_at timestamptz default now()
);

create index idx_business_leads_search_id on business_leads(search_id);
create index idx_search_jobs_status on search_jobs(status);
create index idx_search_jobs_created_at on search_jobs(created_at desc);

create table users (
  id uuid primary key default uuid_generate_v4(),
  email text unique not null,
  plan text default 'free',
  created_at timestamptz default now()
);

create table credits (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references users(id),
  amount integer not null,
  action text,
  created_at timestamptz default now()
);

create table saved_searches (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references users(id),
  query text not null,
  location text not null,
  created_at timestamptz default now()
);
