-- Isolated SEO Intelligence + Content Optimization.
-- Does not modify GSC tables, content automation tables, or blog_posts schema.

create table if not exists seo_optimization_settings (
  id integer primary key default 1 check (id = 1),
  seo_optimization_enabled boolean not null default true,
  max_optimizations_per_day integer not null default 2 check (max_optimizations_per_day between 0 and 10),
  cooldown_days integer not null default 28 check (cooldown_days between 7 and 90),
  first_run_completed boolean not null default false,
  last_analysis_at timestamptz,
  last_optimization_at timestamptz,
  last_scheduler_run_at timestamptz,
  last_scheduler_result text,
  last_scheduler_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into seo_optimization_settings (id)
values (1)
on conflict (id) do nothing;

create table if not exists seo_opportunities (
  id uuid primary key default gen_random_uuid(),
  blog_post_id uuid,
  page_url text not null,
  opportunity_type text not null
    check (opportunity_type in (
      'high_impression_low_ctr',
      'positions_4_to_20',
      'high_impression_query_low_ctr',
      'declining_performance',
      'rising_content',
      'query_article_mismatch',
      'content_depth_gap'
    )),
  status text not null default 'NEW'
    check (status in (
      'NEW','ANALYZING','RECOMMENDED','OPTIMIZATION_PENDING','OPTIMIZING',
      'QUALITY_CHECK','PUBLISHED','MONITORING','COMPLETED','FAILED','SKIPPED'
    )),
  opportunity_score numeric(6,2) not null default 0,
  score_reasons jsonb not null default '[]'::jsonb,
  clicks integer not null default 0,
  impressions integer not null default 0,
  ctr numeric(10,6) not null default 0,
  position numeric(10,4) not null default 0,
  clicks_prev integer,
  impressions_prev integer,
  ctr_prev numeric(10,6),
  position_prev numeric(10,4),
  top_queries jsonb not null default '[]'::jsonb,
  recommended_action text,
  evidence jsonb not null default '{}'::jsonb,
  fingerprint text not null,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (fingerprint)
);

create index if not exists seo_opportunities_status_score_idx
  on seo_opportunities (status, opportunity_score desc);

create index if not exists seo_opportunities_blog_post_idx
  on seo_opportunities (blog_post_id);

create table if not exists seo_optimization_jobs (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid not null references seo_opportunities(id) on delete cascade,
  blog_post_id uuid not null,
  page_url text not null,
  status text not null default 'PENDING'
    check (status in (
      'PENDING','RESEARCHING','GENERATING','QUALITY_CHECK','VALIDATING',
      'PUBLISHED','MONITORING','COMPLETED','FAILED','SKIPPED','ROLLED_BACK'
    )),
  optimization_types text[] not null default '{}',
  research_summary text,
  research_sources jsonb not null default '[]'::jsonb,
  ai_reasoning text,
  proposed_title text,
  proposed_meta_description text,
  proposed_content text,
  quality_score_before numeric(6,2),
  quality_score_after numeric(6,2),
  seo_score_before numeric(6,2),
  seo_score_after numeric(6,2),
  change_summary jsonb not null default '{}'::jsonb,
  validation_notes jsonb not null default '[]'::jsonb,
  error_message text,
  published_at timestamptz,
  monitoring_started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists seo_optimization_jobs_status_idx
  on seo_optimization_jobs (status, created_at desc);

create index if not exists seo_optimization_jobs_post_idx
  on seo_optimization_jobs (blog_post_id, created_at desc);

create table if not exists seo_article_versions (
  id uuid primary key default gen_random_uuid(),
  blog_post_id uuid not null,
  optimization_job_id uuid references seo_optimization_jobs(id) on delete set null,
  opportunity_id uuid references seo_opportunities(id) on delete set null,
  original_title text not null,
  original_meta_title text,
  original_meta_description text,
  original_excerpt text,
  original_content text not null,
  optimized_title text,
  optimized_meta_title text,
  optimized_meta_description text,
  optimized_excerpt text,
  optimized_content text,
  quality_score numeric(6,2),
  seo_score numeric(6,2),
  reason text,
  published boolean not null default false,
  restored boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists seo_article_versions_post_idx
  on seo_article_versions (blog_post_id, created_at desc);

create table if not exists seo_optimization_results (
  id uuid primary key default gen_random_uuid(),
  optimization_job_id uuid not null references seo_optimization_jobs(id) on delete cascade,
  blog_post_id uuid not null,
  classification text not null default 'INSUFFICIENT_DATA'
    check (classification in ('IMPROVED','STABLE','DECLINED','INSUFFICIENT_DATA')),
  baseline_clicks integer not null default 0,
  baseline_impressions integer not null default 0,
  baseline_ctr numeric(10,6) not null default 0,
  baseline_position numeric(10,4) not null default 0,
  observed_clicks integer,
  observed_impressions integer,
  observed_ctr numeric(10,6),
  observed_position numeric(10,4),
  window_days integer not null default 28,
  notes text,
  evaluated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (optimization_job_id)
);

create table if not exists seo_article_cooldowns (
  blog_post_id uuid primary key,
  last_optimized_at timestamptz not null,
  next_eligible_optimization_at timestamptz not null,
  last_optimization_job_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table seo_optimization_settings enable row level security;
alter table seo_opportunities enable row level security;
alter table seo_optimization_jobs enable row level security;
alter table seo_article_versions enable row level security;
alter table seo_optimization_results enable row level security;
alter table seo_article_cooldowns enable row level security;

revoke all on table seo_optimization_settings from anon, authenticated;
revoke all on table seo_opportunities from anon, authenticated;
revoke all on table seo_optimization_jobs from anon, authenticated;
revoke all on table seo_article_versions from anon, authenticated;
revoke all on table seo_optimization_results from anon, authenticated;
revoke all on table seo_article_cooldowns from anon, authenticated;
