import { chromium, type Browser } from "playwright";
import { getEnv } from "../../config/env";
import { logger } from "../../utils/logger";
import { getChromiumLaunchOptions } from "./chromium-options";

export class BrowserPool {
  private browsers: Browser[] = [];
  private available: Browser[] = [];
  private readonly size: number;
  private healthTimer: ReturnType<typeof setInterval> | null = null;
  private initPromise: Promise<void> | null = null;

  constructor(size?: number) {
    this.size = size ?? getEnv().SCRAPER_CONCURRENCY;
  }

  async init(): Promise<void> {
    if (this.isReady()) return;
    if (this.initPromise) {
      await this.initPromise;
      return;
    }

    this.initPromise = this.doInit();
    try {
      await this.initPromise;
    } catch (err) {
      this.initPromise = null;
      throw err;
    }
  }

  private async doInit(): Promise<void> {
    if (this.browsers.length > 0) {
      this.available = this.browsers.filter((b) => b.isConnected());
      if (this.isReady()) return;
    }

    const toLaunch = this.size - this.browsers.length;
    for (let i = 0; i < toLaunch; i++) {
      const browser = await this.launchBrowser();
      this.browsers.push(browser);
      this.available.push(browser);
    }
    logger.info("Browser pool initialized", { size: this.browsers.length });

    if (!this.healthTimer) {
      this.healthTimer = setInterval(() => {
        void this.healthCheck().catch((err) => {
          logger.error("Browser pool health check failed", {
            error: err instanceof Error ? err.message : "unknown",
          });
        });
      }, 60_000);
    }
  }

  /** Retry browser launch if startup init failed or pool was never ready. */
  async ensureReady(): Promise<boolean> {
    if (this.isReady()) return true;
    try {
      await this.init();
      return this.isReady();
    } catch (err) {
      logger.error("Browser pool ensureReady failed", {
        error: err instanceof Error ? err.message : "unknown",
      });
      return false;
    }
  }

  private async launchBrowser(): Promise<Browser> {
    return chromium.launch(getChromiumLaunchOptions());
  }

  isReady(): boolean {
    return this.browsers.length > 0 && this.browsers.some((b) => b.isConnected());
  }

  async acquire(timeoutMs = 90_000): Promise<Browser> {
    const deadline = Date.now() + timeoutMs;
    while (this.available.length === 0) {
      if (Date.now() >= deadline) {
        throw new Error(
          "Scraper is busy or still starting. Please wait a moment and try again."
        );
      }
      await new Promise((r) => setTimeout(r, 200));
    }
    const browser = this.available.pop();
    if (!browser || !browser.isConnected()) {
      return this.launchBrowser();
    }
    return browser;
  }

  async waitUntilReady(timeoutMs = 60_000): Promise<boolean> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      if (this.isReady() && this.available.length > 0) return true;
      await new Promise((r) => setTimeout(r, 500));
    }
    return this.isReady();
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
