import { Router, type Request, type Response } from "express";
import { lookup } from "dns/promises";
import { chromium } from "playwright";
import { logger } from "../utils/logger";
import { getChromiumLaunchOptions } from "../scraper/browser/chromium-options";

export const healthRouter = Router();

async function checkNetwork(): Promise<boolean> {
  try {
    await lookup("google.com");
    return true;
  } catch {
    return false;
  }
}

async function checkPlaywright(): Promise<boolean> {
  try {
    const browser = await chromium.launch(getChromiumLaunchOptions());
    await browser.close();
    return true;
  } catch (err) {
    logger.error("Playwright health check failed", {
      error: err instanceof Error ? err.message : "unknown",
    });
    return false;
  }
}

healthRouter.get("/", async (req: Request, res: Response) => {
  try {
    const verbose = req.query.verbose === "1";
    const [networkOk, playwrightOk] = await Promise.all([
      checkNetwork(),
      checkPlaywright(),
    ]);
    const healthy = networkOk && playwrightOk;

    if (healthy && !verbose) {
      res.status(200).json({ status: "ok" });
      return;
    }

    res.status(healthy ? 200 : 503).json({
      status: healthy ? "ok" : "degraded",
      playwright: playwrightOk ? "ready" : "missing",
      network: networkOk ? "ok" : "failed",
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version ?? "0.1.0",
    });
  } catch (err) {
    logger.error("Health check error", {
      error: err instanceof Error ? err.message : "unknown",
    });
    res.status(503).json({ status: "error" });
  }
});
