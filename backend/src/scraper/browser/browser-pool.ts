import { chromium, type Browser } from "playwright";
import { getEnv } from "../../config/env";
import { logger } from "../../utils/logger";
import { getChromiumLaunchOptions } from "./chromium-options";

export class BrowserPool {
  private browsers: Browser[] = [];
  private available: Browser[] = [];
  private readonly size: number;
  private healthTimer: ReturnType<typeof setInterval> | null = null;

  constructor(size?: number) {
    this.size = size ?? getEnv().SCRAPER_CONCURRENCY;
  }

  async init(): Promise<void> {
    for (let i = 0; i < this.size; i++) {
      const browser = await this.launchBrowser();
      this.browsers.push(browser);
      this.available.push(browser);
    }
    logger.info("Browser pool initialized", { size: this.size });

    this.healthTimer = setInterval(() => {
      void this.healthCheck().catch((err) => {
        logger.error("Browser pool health check failed", {
          error: err instanceof Error ? err.message : "unknown",
        });
      });
    }, 60_000);
  }

  private async launchBrowser(): Promise<Browser> {
    return chromium.launch(getChromiumLaunchOptions());
  }

  async acquire(): Promise<Browser> {
    while (this.available.length === 0) {
      await new Promise((r) => setTimeout(r, 200));
    }
    const browser = this.available.pop();
    if (!browser || !browser.isConnected()) {
      return this.launchBrowser();
    }
    return browser;
  }

  release(browser: Browser): void {
    if (browser.isConnected() && !this.available.includes(browser)) {
      this.available.push(browser);
    }
  }

  async healthCheck(): Promise<void> {
    for (let i = 0; i < this.browsers.length; i++) {
      if (!this.browsers[i].isConnected()) {
        logger.warn("Restarting crashed browser", { index: i });
        await this.browsers[i].close().catch(() => undefined);
        this.browsers[i] = await this.launchBrowser();
      }
    }
    this.available = this.browsers.filter((b) => b.isConnected());
  }

  async shutdown(): Promise<void> {
    if (this.healthTimer) {
      clearInterval(this.healthTimer);
      this.healthTimer = null;
    }
    await Promise.all(this.browsers.map((b) => b.close().catch(() => undefined)));
    this.browsers = [];
    this.available = [];
    logger.info("Browser pool shut down");
  }
}

let pool: BrowserPool | null = null;

export function getBrowserPool(): BrowserPool {
  if (!pool) pool = new BrowserPool();
  return pool;
}
