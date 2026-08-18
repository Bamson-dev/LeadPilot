import { logger } from "../../utils/logger";
import { assertValidCampaignWindow, getCampaignDay } from "./campaign-definition";
import { validateCampaignContent } from "./content";
import { inspectAudience } from "./eligibility";
import { enrollRecipients, ensureCampaignSettings, setCampaignEnabled } from "./repository";
import { processAiMoneyCodeTick } from "./schedule";
import type { AudienceSummary } from "./types";

export async function activateAiMoneyCodeCampaign(): Promise<{
  activated: boolean;
  day: number;
  audience: AudienceSummary;
  enrolled: number;
  daySend: { attempted: number; success: number; failed: number; skipped: number };
}> {
  assertValidCampaignWindow(new Date());
  const contentCheck = validateCampaignContent();
  if (!contentCheck.ok) {
    throw new Error(`Campaign content invalid: ${contentCheck.errors.join("; ")}`);
  }

  const settings = await ensureCampaignSettings();
  if (settings.campaign_start_date !== "2026-08-18") {
    throw new Error("Campaign start date mismatch");
  }
  if (settings.timezone !== "Africa/Lagos") {
    throw new Error("Campaign timezone mismatch");
  }
  if (settings.deadline_at !== "2026-09-16T22:59:00.000Z") {
    throw new Error("Campaign deadline mismatch");
  }
  if (settings.webinar_url !== "https://aimoneycode.com.ng/reg") {
    throw new Error("Campaign webinar URL mismatch");
  }
  if (settings.offer_url !== "https://aimoneycode.com.ng/offer") {
    throw new Error("Campaign offer URL mismatch");
  }

  const audience = await inspectAudience();
  const enrolled = await enrollRecipients(audience.users);
  await setCampaignEnabled(true);

  const day = getCampaignDay();
  if (day < 1 || day > 30) {
    logger.warn("Activation succeeded but no day send executed", { day });
    return {
      activated: true,
      day,
      audience: audience.summary,
      enrolled,
      daySend: { attempted: 0, success: 0, failed: 0, skipped: 0 },
    };
  }

  const sendResult = await processAiMoneyCodeTick("activation");
  return {
    activated: true,
    day,
    audience: audience.summary,
    enrolled,
    daySend: {
      attempted: sendResult.attempted,
      success: sendResult.success,
      failed: sendResult.failed,
      skipped: sendResult.skipped,
    },
  };
}
