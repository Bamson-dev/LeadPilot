alter table search_jobs
add column if not exists is_trial boolean default false;
