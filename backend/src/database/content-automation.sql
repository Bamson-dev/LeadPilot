-- Content automation tables for LeadThur blog engine (additive only).
-- Does not modify existing blog_posts rows or customer tables.

create table if not exists content_automation_settings (
  id integer primary key default 1 check (id = 1),
  automation_enabled boolean not null default false,
  daily_article_target integer not null default 4 check (daily_article_target between 1 and 8),
  quality_threshold integer not null default 90 check (quality_threshold between 50 and 100),
  preferred_min_words integer not null default 2500,
  preferred_max_words integer not null default 4500,
  research_depth text not null default 'standard' check (research_depth in ('light', 'standard', 'deep')),
  auto_image_generation boolean not null default true,
  auto_publishing boolean not null default false,
  leadthur_promotion boolean not null default true,
  enabled_categories text[] not null default array[
    'Lead Generation',
    'Cold Outreach',
    'Nigeria Business',
    'Tools and Software',
    'Freelancing',
    'SMMA'
  ],
  max_generation_attempts integer not null default 3,
  max_retries integer not null default 3,
  daily_research_limit integer not null default 40,
  daily_image_limit integer not null default 8,
  publish_slot_hours integer[] not null default array[8, 12, 16, 20],
  updated_at timestamptz not null default now()
);

insert into content_automation_settings (id)
values (1)
on conflict (id) do nothing;

create table if not exists content_topics (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug_hint text,
  cluster text,
  search_intent text,
  audience text,
  score numeric(6,2) not null default 0,
  relevance_score numeric(6,2),
  demand_score numeric(6,2),
  competition_score numeric(6,2),
  originality_score numeric(6,2),
  leadthur_relevance_score numeric(6,2),
  status text not null default 'DISCOVERED'
    check (status in (
      'DISCOVERED', 'QUALIFIED', 'REJECTED', 'IN_PROGRESS', 'USED', 'ARCHIVED'
    )),
  source text,
  rationale text,
  duplicate_of_post_id uuid references blog_posts(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists content_topics_title_unique_idx
  on content_topics (lower(title));

create index if not exists content_topics_status_score_idx
  on content_topics (status, score desc, created_at desc);

create table if not exists content_jobs (
  id uuid primary key default gen_random_uuid(),
  topic_id uuid references content_topics(id) on delete set null,
  blog_post_id uuid references blog_posts(id) on delete set null,
  status text not null default 'DISCOVERED'
    check (status in (
      'DISCOVERED',
      'QUALIFIED',
      'RESEARCHING',
      'BRIEF_READY',
      'GENERATING',
      'QUALITY_CHECK',
      'REVISING',
      'IMAGE_GENERATION',
      'READY',
      'SCHEDULED',
      'PUBLISHED',
      'FAILED',
      'RETRYING'
    )),
  idempotency_key text not null unique,
  attempt_count integer not null default 0,
  quality_score integer,
  quality_notes jsonb not null default '{}'::jsonb,
  brief jsonb,
  research_summary text,
  article_html text,
  meta jsonb not null default '{}'::jsonb,
  leadthur_cta text,
  image_status text,
  image_alt text,
  scheduled_for timestamptz,
  published_at timestamptz,
  error_message text,
  last_error_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists content_jobs_status_created_idx
  on content_jobs (status, created_at desc);

create index if not exists content_jobs_scheduled_idx
  on content_jobs (scheduled_for)
  where status = 'SCHEDULED' and scheduled_for is not null;

create table if not exists content_sources (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references content_jobs(id) on delete cascade,
  provider text not null check (provider in ('tavily', 'serper', 'manual')),
  title text,
  url text,
  snippet text,
  score numeric(6,2),
  raw jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists content_sources_job_idx
  on content_sources (job_id);

create table if not exists content_generation_runs (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references content_jobs(id) on delete cascade,
  stage text not null,
  provider text,
  latency_ms integer,
  success boolean not null default false,
  error_category text,
  input_tokens integer,
  output_tokens integer,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists content_generation_runs_job_idx
  on content_generation_runs (job_id, created_at desc);

create table if not exists content_quality_checks (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references content_jobs(id) on delete cascade,
  score integer not null,
  passed boolean not null,
  breakdown jsonb not null default '{}'::jsonb,
  feedback text,
  created_at timestamptz not null default now()
);

create index if not exists content_quality_checks_job_idx
  on content_quality_checks (job_id, created_at desc);

create table if not exists content_performance (
  id uuid primary key default gen_random_uuid(),
  blog_post_id uuid not null references blog_posts(id) on delete cascade,
  job_id uuid references content_jobs(id) on delete set null,
  lifecycle text not null default 'NEW'
    check (lifecycle in (
      'NEW', 'PUBLISHED', 'PERFORMING', 'NEEDS_UPDATE', 'UPDATED', 'DECLINING', 'ARCHIVED'
    )),
  views integer not null default 0,
  impressions integer not null default 0,
  clicks integer not null default 0,
  ctr numeric(8,4),
  cta_clicks integer not null default 0,
  trial_visits integer not null default 0,
  trial_signups integer not null default 0,
  checkout_starts integer not null default 0,
  conversions integer not null default 0,
  metrics jsonb not null default '{}'::jsonb,
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (blog_post_id)
);

create index if not exists content_performance_lifecycle_idx
  on content_performance (lifecycle, updated_at desc);

alter table content_automation_settings enable row level security;
alter table content_topics enable row level security;
alter table content_jobs enable row level security;
alter table content_sources enable row level security;
alter table content_generation_runs enable row level security;
alter table content_quality_checks enable row level security;
alter table content_performance enable row level security;

revoke all on table content_automation_settings from anon, authenticated;
revoke all on table content_topics from anon, authenticated;
revoke all on table content_jobs from anon, authenticated;
revoke all on table content_sources from anon, authenticated;
revoke all on table content_generation_runs from anon, authenticated;
revoke all on table content_quality_checks from anon, authenticated;
revoke all on table content_performance from anon, authenticated;
