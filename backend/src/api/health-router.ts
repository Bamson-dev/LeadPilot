import { Router, type Request, type Response } from "express";
import { lookup } from "dns/promises";
import { chromium } from "playwright";
import { logger } from "../utils/logger";
import { getChromiumLaunchOptions } from "../scraper/browser/chromium-options";

export const healthRouter = Router();

/** Fast liveness probe — used by Docker/Coolify (must not launch browsers). */
healthRouter.get("/", (_req: Request, res: Response) => {
  res.status(200).type("text/plain").send("OK");
});

/** Deep readiness probe — Playwright + network (optional). */
healthRouter.get("/ready", async (_req: Request, res: Response) => {
  try {
    const [networkOk, playwrightOk] = await Promise.all([
      lookup("google.com").then(() => true).catch(() => false),
      chromium
        .launch(getChromiumLaunchOptions())
        .then((b) => b.close().then(() => true))
        .catch(() => false),
    ]);

    if (!networkOk || !playwrightOk) {
      logger.warn("Readiness check degraded", { networkOk, playwrightOk });
      res.status(503).json({
        status: "degraded",
        playwright: playwrightOk ? "ready" : "missing",
        network: networkOk ? "ok" : "failed",
      });
      return;
    }

    res.status(200).json({ status: "ok", playwright: "ready", network: "ok" });
  } catch (err) {
    logger.error("Readiness check error", {
      error: err instanceof Error ? err.message : "unknown",
    });
    res.status(503).json({ status: "error" });
  }
});
