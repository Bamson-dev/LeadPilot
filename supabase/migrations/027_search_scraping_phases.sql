-- Two-phase search: fast results + background email scraping
ALTER TABLE search_jobs
  ADD COLUMN IF NOT EXISTS scraping_in_progress boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS nearby_cities jsonb,
  ADD COLUMN IF NOT EXISTS stats_summary jsonb,
  ADD COLUMN IF NOT EXISTS results_email_sent boolean NOT NULL DEFAULT false;

ALTER TABLE business_leads
  ADD COLUMN IF NOT EXISTS email_scraped boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_search_jobs_scraping ON search_jobs (scraping_in_progress)
  WHERE scraping_in_progress = true;
