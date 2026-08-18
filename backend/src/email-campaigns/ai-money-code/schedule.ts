import { logger } from "../../utils/logger";
import { buildRecipientUrgencyContext, getCurrentDateInLagos, getRecipientCampaignDay } from "./campaign-definition";
import { getCampaignEmail } from "./content";
import { discoverAndEnrollNewRecipients } from "./enrollment";
import {
  createPendingSend,
  createRunLog,
  ensureCampaignSettings,
  finishRunLog,
  getLatestSend,
  getStatusSnapshot,
  getSuccessfulSend,
  hasSuccessfulSendOnDate,
  listActiveRecipients,
  markRecipientCompleted,
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
  attempted: number;
  success: number;
  failed: number;
  skipped: number;
  newlyEnrolled: number;
}> {
  if (tickRunning) {
    return { attempted: 0, success: 0, failed: 0, skipped: 0, newlyEnrolled: 0 };
  }
  tickRunning = true;
  const run = await createRunLog(trigger);
  let attempted = 0;
  let success = 0;
  let failed = 0;
  let skipped = 0;
  let newlyEnrolled = 0;
  let runError: string | null = null;
  try {
    const settings = await ensureCampaignSettings();
    if (!settings.enabled && trigger !== "activation") {
      return { attempted, success, failed, skipped, newlyEnrolled };
    }

    newlyEnrolled = await discoverAndEnrollNewRecipients();
    const lagosDate = getCurrentDateInLagos();
    const now = new Date();
    const recipients = await listActiveRecipients();

    for (const recipient of recipients) {
      const recipientDay = getRecipientCampaignDay(recipient.campaign_start_date, now);

      if (recipientDay < 1) {
        skipped += 1;
        continue;
      }

      if (recipientDay > CAMPAIGN_TOTAL_DAYS) {
        await markRecipientCompleted(recipient.id);
        skipped += 1;
        continue;
      }

      if (await hasSuccessfulSendOnDate(recipient.id, lagosDate)) {
        skipped += 1;
        continue;
      }

      const existingSuccess = await getSuccessfulSend(recipient.id, recipientDay);
      if (existingSuccess) {
        skipped += 1;
        if (recipientDay === CAMPAIGN_TOTAL_DAYS) {
          await markRecipientCompleted(recipient.id);
        }
        continue;
      }

      const latest = await getLatestSend(recipient.id, recipientDay);
      const retryCount = latest?.status === "failed" ? Math.min((latest.retry_count || 0) + 1, 3) : 0;
      if (latest?.status === "failed" && (latest.retry_count || 0) >= 3) {
        skipped += 1;
        continue;
      }

      const urgency = buildRecipientUrgencyContext(recipient.personal_deadline_at, now);
      const email = getCampaignEmail(recipientDay, urgency);

      const pending = await createPendingSend({
        recipient,
        day: recipientDay,
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
        if (recipientDay === CAMPAIGN_TOTAL_DAYS) {
          await markRecipientCompleted(recipient.id);
        }
      } else {
        await markSendFailed(pending.id, sent.error || "unknown");
        failed += 1;
      }
    }

    return { attempted, success, failed, skipped, newlyEnrolled };
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
  const snapshot = await getStatusSnapshot();
  const now = new Date();
  const nextRunAt = new Date(now.getTime() + TICK_MS).toISOString();
  return {
    ...snapshot,
    currentDateLagos: getCurrentDateInLagos(),
    nextSendWindow: "Hourly server-side scheduler tick (per-recipient evergreen)",
    nextRunAt,
    scheduler: getSchedulerHealth(),
  };
}
