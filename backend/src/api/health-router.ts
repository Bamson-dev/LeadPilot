import { Router, type Request, type Response } from "express";
import { lookup } from "dns/promises";
import { chromium } from "playwright";
import { logger } from "../utils/logger";
import { getChromiumLaunchOptions } from "../scraper/browser/chromium-options";

/** Fast liveness probe — used by Docker/Coolify (must not launch browsers). */
export function liveness(_req: Request, res: Response): void {
  res.status(200).type("text/plain").send("OK");
}

/** Deep readiness probe — Playwright + network. */
export async function readiness(_req: Request, res: Response): Promise<void> {
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
}

export const healthRouter = Router();
healthRouter.get("/", liveness);
healthRouter.get("/ready", readiness);

/** Mount liveness + readiness on a path prefix (e.g. /health, /api/health). */
export function mountHealthRoutes(app: import("express").Express, basePath: string): void {
  app.get(basePath, liveness);
  app.get(`${basePath}/ready`, readiness);
  app.use(basePath, healthRouter);
}
