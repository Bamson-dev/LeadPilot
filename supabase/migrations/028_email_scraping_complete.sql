ALTER TABLE search_jobs
  ADD COLUMN IF NOT EXISTS email_scraping_complete boolean NOT NULL DEFAULT false;

UPDATE search_jobs
SET email_scraping_complete = true
WHERE status = 'completed';

CREATE INDEX IF NOT EXISTS idx_search_jobs_email_scraping ON search_jobs (email_scraping_complete)
  WHERE email_scraping_complete = false;
