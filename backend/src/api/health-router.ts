import os from "os";
import { Router, type Request } from "express";
import { getBrowserPool } from "../scraper/browser/browser-pool";
import {
  getDeepseekKeyFingerprint,
  isDeepseekConfigured,
} from "../utils/deepseek-config";
import {
  getSearchQueueStatus,
  refreshSearchQueueStatus,
} from "../queue/search-queue";
import type { SearchQueueStatus } from "../queue/search-queue-types";
import { getClientIpDiagnostics } from "../middleware/rate-limit";
import { getGitCommitSha } from "../utils/build-info";
import { getSupabaseConfigDiagnostics } from "../utils/supabase-config";
import { probeLicenseAuthLookup } from "../database/license-repository";
import { isPgConfigured } from "../database/pg-pool";
import { supabase } from "../database/client";

const router = Router();

let cachedQueue: SearchQueueStatus = getSearchQueueStatus();
let cachedIpCapReady = true;
let cachedLicenseAuthReady = true;
let cachedLicenseAuthProbe: {
  code: string | null;
  message: string | null;
  viaPg: boolean;
} = {
  code: null,
  message: null,
  viaPg: false,
};
let refreshInFlight = false;

async function isFreeTrialIpCapReady(): Promise<boolean> {
  const { error } = await supabase.from("free_trial_ip_usage").select("ip_address").limit(1);
  return !error;
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  return Promise.race([
    promise,
    new Promise<null>((resolve) => setTimeout(() => resolve(null), ms)),
  ]);
}

function browserState(): "ready" | "initializing" {
  try {
    return getBrowserPool().isReady() ? "ready" : "initializing";
  } catch {
    return "initializing";
  }
}

function memorySnapshot() {
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const usedPercent = Math.round(((totalMem - freeMem) / totalMem) * 100);
  return {
    totalGB: (totalMem / 1024 / 1024 / 1024).toFixed(1),
    usedPercent,
    safe: usedPercent < 85,
  };
}

/** Redis/Supabase must never block Coolify/Traefik liveness. */
function scheduleBackgroundRefresh(): void {
  if (refreshInFlight) return;
  refreshInFlight = true;
  void withTimeout(refreshSearchQueueStatus(), 1500)
    .then((queue) => {
      if (queue) cachedQueue = queue;
    })
    .catch(() => undefined);
  void withTimeout(isFreeTrialIpCapReady(), 1500)
    .then((ready) => {
      if (typeof ready === "boolean") cachedIpCapReady = ready;
    })
    .catch(() => undefined);
  void withTimeout(probeLicenseAuthLookup(), 1500)
    .then((probe) => {
      if (!probe) return;
      cachedLicenseAuthReady = probe.ok;
      cachedLicenseAuthProbe = {
        code: probe.code,
        message: probe.message,
        viaPg: probe.viaPg,
      };
    })
    .catch(() => undefined)
    .finally(() => {
      refreshInFlight = false;
    });
}

router.get("/", (_req, res) => {
  scheduleBackgroundRefresh();
  res.status(200).json({
    status: "ok",
    browser: browserState(),
    deepseek: {
      configured: isDeepseekConfigured(),
      keyFingerprint: getDeepseekKeyFingerprint(),
    },
    queue: cachedQueue,
    memory: memorySnapshot(),
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || "1.0.0",
    gitCommitSha: getGitCommitSha(),
    freeTrialIpCapReady: cachedIpCapReady,
    licenseAuthLookupReady: cachedLicenseAuthReady,
    supabase: {
      ...getSupabaseConfigDiagnostics(),
      pgConfigured: isPgConfigured(),
      licenseAuthViaPg: cachedLicenseAuthProbe.viaPg,
      licenseAuthErrorCode: cachedLicenseAuthProbe.code,
      licenseAuthErrorMessage: cachedLicenseAuthProbe.message,
    },
  });
});

router.get("/client-ip", (req: Request, res) => {
  res.status(200).json(getClientIpDiagnostics(req));
});

router.get("/ready", (_req, res) => {
  scheduleBackgroundRefresh();
  res.status(200).json({
    status: "ready",
    browser: browserState(),
    queue: cachedQueue,
    memory: memorySnapshot(),
    timestamp: new Date().toISOString(),
  });
});

export default router;
