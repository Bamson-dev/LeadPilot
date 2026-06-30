-- Domain-keyed email cache for cross-search reuse (staging+)
create table if not exists domain_email_cache (
  domain text primary key,
  email text not null,
  email_secondary text,
  source text not null check (source in ('scraped', 'predicted')),
  confidence smallint not null check (confidence >= 0 and confidence <= 100),
  confidence_secondary smallint check (confidence_secondary is null or (confidence_secondary >= 0 and confidence_secondary <= 100)),
  discovered_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_domain_email_cache_discovered_at
  on domain_email_cache (discovered_at desc);
