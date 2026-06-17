alter table search_jobs
  add column if not exists license_email text;

create index if not exists idx_search_jobs_license_email
  on search_jobs (license_email)
  where license_email is not null;
