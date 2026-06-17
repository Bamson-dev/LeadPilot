import os from "os";
import { Router } from "express";
import { getBrowserPool } from "../scraper/browser/browser-pool";
import {
  getDeepseekKeyFingerprint,
  isDeepseekConfigured,
} from "../utils/deepseek-config";
import { searchQueue } from "../queues/search-queue";

const router = Router();

router.get("/", (_req, res) => {
  let browser: "ready" | "initializing" = "initializing";
  try {
    browser = getBrowserPool().isReady() ? "ready" : "initializing";
  } catch {
    browser = "initializing";
  }

  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const usedPercent = Math.round(((totalMem - freeMem) / totalMem) * 100);

  res.status(200).json({
    status: "ok",
    browser,
    deepseek: {
      configured: isDeepseekConfigured(),
      keyFingerprint: getDeepseekKeyFingerprint(),
    },
    queue: searchQueue.getStatus(),
    memory: {
      totalGB: (totalMem / 1024 / 1024 / 1024).toFixed(1),
      usedPercent,
      safe: usedPercent < 85,
    },
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || "1.0.0",
  });
});

router.get("/ready", (_req, res) => {
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const usedPercent = Math.round(((totalMem - freeMem) / totalMem) * 100);

  res.status(200).json({
    status: "ready",
    browser: getBrowserPool().isReady() ? "ready" : "initializing",
    queue: searchQueue.getStatus(),
    memory: {
      totalGB: (totalMem / 1024 / 1024 / 1024).toFixed(1),
      usedPercent,
      safe: usedPercent < 85,
    },
    timestamp: new Date().toISOString(),
  });
});

export default router;
