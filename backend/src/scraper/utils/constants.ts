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
export const EMAIL_SCRAPE_BATCH_SIZE = 8;
export const EMAIL_SCRAPE_BATCH_SIZE_MEDIUM = 5;
export const EMAIL_SCRAPE_BATCH_SIZE_LARGE = 3;
export const LARGE_CITY_RESULT_THRESHOLD = 300;
export const EMAIL_SCRAPE_MAX_WEBSITES = 500;
export const MEMORY_SKIP_SCRAPE_PERCENT = 80;
export const EMAIL_SCRAPE_MAX_MS = 10 * 60 * 1000;
export const PHASE1_DEADLINE_MS = 90_000;
export const EMAIL_REGEX =
  /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
/** Soft cap for legacy callers; crawlers return all valid emails up to this bound. */
export const MAX_DISPLAY_EMAILS = 100;
export const MAX_GENERATED_EMAILS = 2;
export const EMAIL_CRAWL_PATHS = ["/contact", "/about"];
