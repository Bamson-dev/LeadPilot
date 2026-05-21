import { Router } from "express";
import { getBrowserPool } from "../scraper/browser/browser-pool";
import { searchQueue } from "../queues/search-queue";

const router = Router();

/** Fast liveness — includes queue and browser status for monitoring. */
router.get("/", (_req, res) => {
  let browser: "ready" | "initializing" = "initializing";
  try {
    browser = getBrowserPool().isReady() ? "ready" : "initializing";
  } catch {
    browser = "initializing";
  }

  res.status(200).json({
    status: "ok",
    browser,
    queue: searchQueue.getStatus(),
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || "1.0.0",
  });
});

router.get("/ready", (_req, res) => {
  res.status(200).json({
    status: "ready",
    browser: getBrowserPool().isReady() ? "ready" : "initializing",
    queue: searchQueue.getStatus(),
    timestamp: new Date().toISOString(),
  });
});

export default router;
