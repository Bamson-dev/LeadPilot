import os from "os";
import { Router, type Request } from "express";
import { getBrowserPool } from "../scraper/browser/browser-pool";
import {
  getDeepseekKeyFingerprint,
  isDeepseekConfigured,
} from "../utils/deepseek-config";
import { refreshSearchQueueStatus } from "../queue/search-queue";
import { getClientIpDiagnostics } from "../middleware/rate-limit";
import { getGitCommitSha } from "../utils/build-info";
import { supabase } from "../database/client";

const router = Router();

async function isFreeTrialIpCapReady(): Promise<boolean> {
  const { error } = await supabase.from("free_trial_ip_usage").select("ip_address").limit(1);
  return !error;
}

router.get("/", async (_req, res) => {
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
    queue: await refreshSearchQueueStatus(),
    memory: {
      totalGB: (totalMem / 1024 / 1024 / 1024).toFixed(1),
      usedPercent,
      safe: usedPercent < 85,
    },
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || "1.0.0",
    gitCommitSha: getGitCommitSha(),
    freeTrialIpCapReady: await isFreeTrialIpCapReady(),
  });
});

router.get("/client-ip", (req: Request, res) => {
  res.status(200).json(getClientIpDiagnostics(req));
});

router.get("/ready", async (_req, res) => {
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const usedPercent = Math.round(((totalMem - freeMem) / totalMem) * 100);

  res.status(200).json({
    status: "ready",
    browser: getBrowserPool().isReady() ? "ready" : "initializing",
    queue: await refreshSearchQueueStatus(),
    memory: {
      totalGB: (totalMem / 1024 / 1024 / 1024).toFixed(1),
      usedPercent,
      safe: usedPercent < 85,
    },
    timestamp: new Date().toISOString(),
  });
});

export default router;
