export const MAX_LEADS_PER_SEARCH = Math.min(
  1000,
  parseInt(process.env.SCRAPE_MAX_LEADS || "1000", 10)
);
export const MIN_CACHE_LEADS_TO_REUSE = parseInt(
  process.env.MIN_CACHE_LEADS_TO_REUSE || "80",
  10
);
export const SCRAPE_CONCURRENCY = 5;
export const MAPS_URL_BATCH_SIZE = 5;
export const MAPS_BATCH_DELAY_MIN_MS = 2000;
export const MAPS_BATCH_DELAY_MAX_MS = 4000;
export const MAPS_SCROLL_COUNT = 5;
export const MAPS_SCROLL_DELAY_MIN_MS = 800;
export const MAPS_SCROLL_DELAY_MAX_MS = 1500;
export const MAPS_PAGE_READ_DELAY_MIN_MS = 500;
export const MAPS_PAGE_READ_DELAY_MAX_MS = 1500;
export const NEIGHBOURHOOD_AREA_LIMIT = 15;
export const KEYWORD_VARIATION_LIMIT = 10;
export const PLACE_TIMEOUT_MS = 25000;
export const PLACE_GOTO_TIMEOUT_MS = 20000;
export const SIDEBAR_MIN_LISTINGS = 10;
export const SIDEBAR_SCROLL_MAX_ROUNDS = 80;
export const SIDEBAR_SCROLL_WAIT_MS = 550;
export const SIDEBAR_STABLE_ROUNDS = 5;
export const SIDEBAR_SCROLL_TIMEOUT_MS = 60_000;
export const DETAIL_PANEL_WAIT_MS = 1200;
export const PLACE_PAGE_TIMEOUT_MS = 18000;
export const SEARCH_JOB_TIMEOUT_MS = parseInt(process.env.SEARCH_JOB_TIMEOUT_MS || "600000", 10);
export const EMAIL_FETCH_TIMEOUT_MS = 15000;
export const EMAIL_PLAYWRIGHT_TIMEOUT_MS = 25_000;
export const EMAIL_PLAYWRIGHT_RETRY_COUNT = 1;
export const EMAIL_PLAYWRIGHT_IDLE_MS = 8000;
export const EMAIL_SCRAPE_MAX_PAGES = 4;
export const EMAIL_SCRAPE_TAB_CONCURRENCY = 5;
export const EMAIL_SCRAPE_TAB_CONCURRENCY_LARGE = 3;
export const EMAIL_SCRAPE_BATCH_SIZE = 8;
export const EMAIL_SCRAPE_BATCH_SIZE_LARGE = 3;
export const MEDIUM_CITY_RESULT_THRESHOLD = 150;
export const LARGE_CITY_RESULT_THRESHOLD = 300;
export const MEMORY_SKIP_SCRAPE_PERCENT = 80;
/** Phase 2 email budget — starts after Phase 1; must not wait on unbounded Maps backfill. */
export const PHASE2_EMAIL_SCRAPE_MAX_MS = 5 * 60 * 1000;
export const EMAIL_SCRAPE_MAX_MS = PHASE2_EMAIL_SCRAPE_MAX_MS;
export const PHASE2_TRIGGER_WATCHDOG_MS = 10_000;
export const PHASE1_DEADLINE_MS = 90_000;
/**
 * Cap for continueMapsExtraction after Phase 1 times out.
 * Without this, remaining place-URL extraction can run past the worker
 * timeout and Phase 2 email scraping never starts (emails stay blank).
 */
export const BACKGROUND_MAPS_BUDGET_MS = parseInt(
  process.env.BACKGROUND_MAPS_BUDGET_MS || String(2.5 * 60 * 1000),
  10
);
/** BullMQ lock must cover longest Phase 1 background extraction + Phase 2 email scrape. */
export const BULLMQ_LOCK_DURATION_MS = 15 * 60 * 1000;
export const BULLMQ_STALLED_INTERVAL_MS = 2 * 60 * 1000;
export const BULLMQ_MAX_STALLED_COUNT = 5;
export const PHASE1_HEARTBEAT_MS = 30_000;
export const EMAIL_REGEX =
  /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
/** Soft cap for legacy callers; crawlers return all valid emails up to this bound. */
export const MAX_DISPLAY_EMAILS = 100;
export const MAX_GENERATED_EMAILS = 2;
export const EMAIL_CRAWL_PATHS = ["/contact", "/about"];
