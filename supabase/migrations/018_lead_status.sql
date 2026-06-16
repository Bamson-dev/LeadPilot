create table if not exists lead_statuses (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  business_name text not null,
  business_phone text,
  business_address text,
  search_id uuid,
  status text not null default 'new' check (status in ('new', 'contacted', 'interested', 'closed', 'not_interested')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_lead_statuses_unique
  on lead_statuses (email, business_name, business_phone);

create index if not exists idx_lead_statuses_email_status
  on lead_statuses (email, status);

create or replace function update_lead_status_timestamp()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists lead_statuses_updated_at on lead_statuses;
create trigger lead_statuses_updated_at
before update on lead_statuses
for each row execute function update_lead_status_timestamp();

create table if not exists whatsapp_templates (
  id uuid primary key default gen_random_uuid(),
  niche text not null,
  title text not null,
  message text not null,
  created_at timestamptz not null default now()
);

insert into whatsapp_templates (niche, title, message)
select v.niche, v.title, v.message
from (values
  (
    'web_design',
    'No website found',
    'Hi [Business Name], I came across your business while researching [City] and noticed you don''t have a website yet. I help businesses like yours get a clean, mobile friendly site that brings in more customers. Would you be open to a quick chat about it?'
  ),
  (
    'social_media',
    'Low Instagram activity',
    'Hi [Business Name], I noticed your Instagram isn''t very active. I help businesses like yours stay consistent on social media and bring in more foot traffic. Want me to show you what that could look like for you?'
  ),
  (
    'seo',
    'Low Google rating',
    'Hi [Business Name], I came across your business and noticed your Google rating could use some attention. I help businesses improve how they show up online and attract more customers. Open to a quick conversation?'
  ),
  (
    'copywriting',
    'Weak website copy',
    'Hi [Business Name], I checked out your website and think the messaging could do a lot more to convert visitors into customers. I help businesses with copy that actually gets people to take action. Want to see some examples?'
  ),
  (
    'general',
    'General introduction',
    'Hi [Business Name], I came across your business while researching [City] and wanted to reach out. I work with businesses like yours and think I could help. Do you have a few minutes to chat?'
  )
) as v(niche, title, message)
where not exists (
  select 1 from whatsapp_templates wt where wt.niche = v.niche and wt.title = v.title
);
