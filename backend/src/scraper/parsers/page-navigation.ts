import type { Page } from "playwright";
import { formatScraperError } from "../utils/scraper-errors";

const RETRYABLE = [
  "ERR_NAME_NOT_RESOLVED",
  "ERR_INTERNET_DISCONNECTED",
  "ERR_CONNECTION_RESET",
  "ERR_CONNECTION_CLOSED",
  "ETIMEDOUT",
  "Timeout",
  "timed out",
];

function isRetryable(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return RETRYABLE.some((code) => msg.includes(code));
}

export interface GotoOptions {
  waitUntil?: "domcontentloaded" | "load" | "networkidle";
  timeout?: number;
  retries?: number;
}

/**
 * Navigate with retries for transient DNS/network failures.
 */
export async function gotoWithRetry(
  page: Page,
  url: string,
  options: GotoOptions = {}
): Promise<void> {
  const {
    waitUntil = "domcontentloaded",
    timeout = 60000,
    retries = 3,
  } = options;

  let lastError: unknown;

  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      await page.goto(url, { waitUntil, timeout });
      return;
    } catch (err) {
      lastError = err;
      if (!isRetryable(err) || attempt >= retries - 1) break;
      await page.waitForTimeout(1500 * (attempt + 1));
    }
  }

  throw new Error(formatScraperError(lastError));
}
