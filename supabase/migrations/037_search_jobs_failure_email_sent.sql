-- Deduplicate terminal failure emails (stall races previously emailed "failed"
-- while the original worker was still scraping, then emailed success later).

alter table public.search_jobs
  add column if not exists failure_email_sent boolean not null default false;
