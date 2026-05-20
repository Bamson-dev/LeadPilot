import { Router, type Request, type Response } from "express";
import { lookup } from "dns/promises";
import { chromium } from "playwright";
import { logger } from "../utils/logger";

export const healthRouter = Router();

async function checkNetwork(): Promise<{ ok: boolean; message?: string }> {
  try {
    await lookup("google.com");
    return { ok: true };
  } catch {
    return {
      ok: false,
      message: "Can't resolve google.com (DNS). Check network settings.",
    };
  }
}

healthRouter.get("/", async (_req: Request, res: Response) => {
  const network = await checkNetwork();
  let playwrightStatus: "ready" | "missing" = "missing";

  try {
    const browser = await chromium.launch({ headless: true });
    await browser.close();
    playwrightStatus = "ready";
  } catch (err) {
    logger.error("Playwright health check failed", {
      error: err instanceof Error ? err.message : "unknown",
    });
  }

  const ok = network.ok && playwrightStatus === "ready";
  res.status(ok ? 200 : 503).json({
    status: ok ? "ok" : "degraded",
    playwright: playwrightStatus,
    network: network.ok ? "ok" : "failed",
    message: network.message,
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version ?? "0.1.0",
  });
});
