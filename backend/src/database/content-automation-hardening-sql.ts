export const CONTENT_AUTOMATION_HARDENING_SQL = `
alter table content_automation_settings
  add column if not exists publishing_interval_hours integer not null default 3
    check (publishing_interval_hours between 1 and 12),
  add column if not exists last_publication_at timestamptz,
  add column if not exists next_scheduled_publication_at timestamptz,
  add column if not exists image_storage_provider text not null default 'local'
    check (image_storage_provider in ('local', 'supabase', 'auto')),
  add column if not exists last_image_storage_at timestamptz,
  add column if not exists last_image_storage_error text,
  add column if not exists publish_slot_hours integer[] not null default array[8, 12, 16, 20],
  add column if not exists last_scheduler_run_at timestamptz,
  add column if not exists last_scheduler_result text,
  add column if not exists last_scheduler_error text;

alter table content_jobs
  add column if not exists image_storage_provider text;
`;
