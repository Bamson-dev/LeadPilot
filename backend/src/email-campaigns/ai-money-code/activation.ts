import { logger } from "../../utils/logger";
import { validateCampaignContent } from "./content";
import { inspectAudience } from "./eligibility";
import { enrollRecipients, ensureCampaignSettings, setCampaignEnabled } from "./repository";
import { processAiMoneyCodeTick } from "./schedule";
import type { AudienceSummary } from "./types";

export async function activateAiMoneyCodeCampaign(): Promise<{
  activated: boolean;
  audience: AudienceSummary;
  enrolled: number;
  tick: { attempted: number; success: number; failed: number; skipped: number; newlyEnrolled: number };
}> {
  const contentCheck = validateCampaignContent();
  if (!contentCheck.ok) {
    throw new Error(`Campaign content invalid: ${contentCheck.errors.join("; ")}`);
  }

  const settings = await ensureCampaignSettings();
  if (settings.timezone !== "Africa/Lagos") {
    throw new Error("Campaign timezone mismatch");
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

  const tick = await processAiMoneyCodeTick("activation");
  logger.info("AI money code campaign activated (evergreen)", {
    enrolled,
    tick,
  });

  return {
    activated: true,
    audience: audience.summary,
    enrolled,
    tick,
  };
}
