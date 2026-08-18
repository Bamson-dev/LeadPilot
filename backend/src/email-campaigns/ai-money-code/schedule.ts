import { logger } from "../../utils/logger";
import { getCampaignDay, getCurrentDateInLagos, getNextCampaignDay, isPastDeadline } from "./campaign-definition";
import { getCampaignEmail } from "./content";
import {
  createPendingSend,
  createRunLog,
  ensureCampaignSettings,
  finishRunLog,
  getLatestSend,
  getStatusSnapshot,
  getSuccessfulSend,
  listEnrolledRecipients,
  markSendFailed,
  markSendSuccess,
} from "./repository";
import { sendCampaignEmail } from "./send";
import { CAMPAIGN_TOTAL_DAYS } from "./types";

const TICK_MS = 60 * 60 * 1000;
let interval: ReturnType<typeof setInterval> | null = null;
let tickRunning = false;
let lastRunAt: string | null = null;

export function getSchedulerHealth() {
  return {
    running: interval !== null,
    tickRunning,
    lastRunAt,
    frequency: "hourly (+30s after boot)",
    browserRequired: false,
    adminSessionRequired: false,
  };
}

export async function processAiMoneyCodeTick(trigger = "scheduler"): Promise<{
  day: number;
  attempted: number;
  success: number;
  failed: number;
  skipped: number;
}> {
  if (tickRunning) {
    return { day: getCampaignDay(), attempted: 0, success: 0, failed: 0, skipped: 0 };
  }
  tickRunning = true;
  const day = getCampaignDay();
  const run = await createRunLog(trigger);
  let attempted = 0;
  let success = 0;
  let failed = 0;
  let skipped = 0;
  let runError: string | null = null;
  try {
    const settings = await ensureCampaignSettings();
    if (!settings.enabled && trigger !== "activation") {
      return { day, attempted, success, failed, skipped };
    }
    if (isPastDeadline() || day < 1 || day > CAMPAIGN_TOTAL_DAYS) {
      return { day, attempted, success, failed, skipped };
    }
    const email = getCampaignEmail(day);
    const recipients = await listEnrolledRecipients();
    const lagosDate = getCurrentDateInLagos();

    for (const recipient of recipients) {
      const existingSuccess = await getSuccessfulSend(recipient.id, day);
      if (existingSuccess) {
        skipped += 1;
        continue;
      }
      const latest = await getLatestSend(recipient.id, day);
      const retryCount = latest?.status === "failed" ? Math.min((latest.retry_count || 0) + 1, 3) : 0;
      if (latest?.status === "failed" && (latest.retry_count || 0) >= 3) {
        skipped += 1;
        continue;
      }

      const pending = await createPendingSend({
        recipient,
        day,
        scheduledDate: lagosDate,
        subject: email.subject,
        ctaUrl: email.ctaUrl,
        retryCount,
      });
      attempted += 1;
      const sent = await sendCampaignEmail({
        to: recipient.email,
        campaignEmail: email,
      });
      if (sent.success) {
        await markSendSuccess(pending.id, sent.messageId);
        success += 1;
      } else {
        await markSendFailed(pending.id, sent.error || "unknown");
        failed += 1;
      }
    }
    return { day, attempted, success, failed, skipped };
  } catch (err) {
    runError = err instanceof Error ? err.message : "unknown";
    logger.error("AI money code scheduler tick failed", { trigger, error: runError });
    throw err;
  } finally {
    lastRunAt = new Date().toISOString();
    await finishRunLog(run.id, {
      evaluated: attempted + skipped,
      sent: success,
      skipped,
      failures: failed,
      error: runError,
    });
    tickRunning = false;
  }
}

export function startAiMoneyCodeScheduler(): void {
  if (interval) return;
  setTimeout(() => {
    void processAiMoneyCodeTick("boot").catch(() => undefined);
  }, 30_000);
  interval = setInterval(() => {
    void processAiMoneyCodeTick("interval").catch(() => undefined);
  }, TICK_MS);
  logger.info("AI money code scheduler started");
}

export async function getCampaignOperationalStatus() {
  const day = getCampaignDay();
  const snapshot = await getStatusSnapshot(Math.max(1, Math.min(day, CAMPAIGN_TOTAL_DAYS)));
  const now = new Date();
  const nextRunAt = new Date(now.getTime() + TICK_MS).toISOString();
  const nextCampaignDay = getNextCampaignDay();
  return {
    ...snapshot,
    currentDay: day,
    currentDateLagos: getCurrentDateInLagos(),
    nextCampaignDay,
    nextSendDate: nextCampaignDay ? (() => {
      const d = new Date(now);
      d.setUTCDate(d.getUTCDate() + 1);
      return d.toISOString().slice(0, 10);
    })() : null,
    nextSendWindow: "Hourly server-side scheduler tick",
    nextRunAt,
    scheduler: getSchedulerHealth(),
  };
}
