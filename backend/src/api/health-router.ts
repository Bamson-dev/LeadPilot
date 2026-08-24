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
import { supabase } from "../database/client";
import { isSupabaseRowNotFound } from "../database/license-repository";

const router = Router();

let cachedQueue: SearchQueueStatus = getSearchQueueStatus();
let cachedIpCapReady = true;
let cachedLicenseAuthReady = true;
let cachedLicenseAuthProbe: { code: string | null; message: string | null } = {
  code: null,
  message: null,
};
let refreshInFlight = false;

async function isFreeTrialIpCapReady(): Promise<boolean> {
  const { error } = await supabase.from("free_trial_ip_usage").select("ip_address").limit(1);
  return !error;
}

async function probeLicenseAuthLookup(): Promise<{
  ok: boolean;
  code: string | null;
  message: string | null;
}> {
  const { error } = await supabase
    .from("license_keys")
    .select("id, email, key, activated")
    .eq("key", "__health_probe__")
    .eq("email", "health-probe@invalid.local")
    .single();

  if (!error || isSupabaseRowNotFound(error)) {
    return { ok: true, code: null, message: null };
  }

  return {
    ok: false,
    code: error.code ?? null,
    message: error.message ?? null,
  };
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
      cachedLicenseAuthProbe = { code: probe.code, message: probe.message };
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
