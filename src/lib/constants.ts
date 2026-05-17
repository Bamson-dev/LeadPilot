export const MAX_LEADS_PER_SEARCH = 200;
export const MAX_EXPORT_ROWS = 200;
export const RATE_LIMIT_WINDOW_MS = 60_000;
export const RATE_LIMIT_MAX_REQUESTS = 5;
export const SCRAPE_CONCURRENCY = 5;
/** Stop scrolling once we have enough listings to start (fast first results) */
export const SIDEBAR_MIN_LISTINGS = 15;
export const SIDEBAR_SCROLL_MAX_ROUNDS = 22;
export const SIDEBAR_SCROLL_WAIT_MS = 450;
export const SIDEBAR_STABLE_ROUNDS = 3;
export const DETAIL_PANEL_WAIT_MS = 1200;
/** Max parallel deep email crawls (rest stay on instant domain fallback) */
export const EMAIL_MAX_CONCURRENT_CRAWLS = 2;
export const PLACE_PAGE_TIMEOUT_MS = 25000;
/** Per-site email crawl budget (all pages combined) */
export const EMAIL_SITE_TIMEOUT_MS = 45000;
export const EMAIL_PAGE_TIMEOUT_MS = 12000;
export const EMAIL_MAX_PAGES_PER_SITE = 4;
export const EMAIL_PAGE_READY_MS = 1200;
/** Max emails shown in table / CSV display field */
export const MAX_DISPLAY_EMAILS = 2;
/** Max fallback generated addresses per lead */
export const MAX_GENERATED_EMAILS = 2;

export const EMAIL_REGEX =
  /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

export const EMAIL_CRAWL_PATHS = [
  "/contact",
  "/contact-us",
  "/about",
  "/about-us",
  "/support",
  "/team",
];
