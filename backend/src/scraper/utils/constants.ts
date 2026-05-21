export const MAX_LEADS_PER_SEARCH = parseInt(process.env.SCRAPE_MAX_LEADS || "60", 10);
export const SCRAPE_CONCURRENCY = 5;
export const PLACE_TIMEOUT_MS = 8000;
export const SIDEBAR_MIN_LISTINGS = 10;
export const SIDEBAR_SCROLL_MAX_ROUNDS = 14;
export const SIDEBAR_SCROLL_WAIT_MS = 450;
export const SIDEBAR_STABLE_ROUNDS = 3;
export const DETAIL_PANEL_WAIT_MS = 800;
export const PLACE_PAGE_TIMEOUT_MS = 12000;
export const SEARCH_JOB_TIMEOUT_MS = parseInt(process.env.SEARCH_JOB_TIMEOUT_MS || "180000", 10);
export const EMAIL_FETCH_TIMEOUT_MS = 5000;
export const EMAIL_REGEX =
  /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
export const MAX_DISPLAY_EMAILS = 2;
export const MAX_GENERATED_EMAILS = 2;
export const EMAIL_CRAWL_PATHS = ["/contact", "/about"];
