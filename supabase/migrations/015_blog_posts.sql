-- Blog posts for LeadThur public blog and admin editor
create table if not exists blog_posts (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text not null unique,
  excerpt text,
  content text not null,
  cover_image text,
  author text not null default 'Bamidele Matthew',
  author_title text default 'Founder, LeadThur',
  category text,
  tags text[] not null default '{}',
  meta_title text,
  meta_description text,
  status text not null default 'draft' check (status in ('draft', 'published')),
  featured boolean not null default false,
  read_time integer,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_blog_posts_status_published
  on blog_posts (status, published_at desc);

create index if not exists idx_blog_posts_category
  on blog_posts (category)
  where status = 'published';
