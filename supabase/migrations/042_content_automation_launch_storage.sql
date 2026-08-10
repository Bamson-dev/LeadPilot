-- Launch batch + blog cover storage for content automation
alter table content_automation_settings
  add column if not exists launch_batch_remaining integer not null default 0;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('blog-covers', 'blog-covers', true, 5242880, array['image/png','image/jpeg','image/webp'])
on conflict (id) do update set public = excluded.public;
