import { Router, type Request, type Response } from "express";
import { requireAdminAuth } from "../../middleware/admin-auth";
import {
  calculatePersonalDeadlineAt,
  formatDeadlineInLagos,
  getCurrentDateInLagos,
  getEnrollmentStartDate,
} from "./campaign-definition";
import { activateAiMoneyCodeCampaign } from "./activation";
import { inspectAudience } from "./eligibility";
import { ensureCampaignSettings } from "./repository";
import { getCampaignOperationalStatus, processAiMoneyCodeTick } from "./schedule";
import { runAiMoneyCodeSelfTest } from "./selftest";

export const aiMoneyCodeCampaignRouter = Router();
aiMoneyCodeCampaignRouter.use(requireAdminAuth);

aiMoneyCodeCampaignRouter.get("/status", async (_req: Request, res: Response) => {
  try {
    const [settings, operational, audience, selftest] = await Promise.all([
      ensureCampaignSettings(),
      getCampaignOperationalStatus(),
      inspectAudience(),
      Promise.resolve(runAiMoneyCodeSelfTest()),
    ]);

    const exampleStartToday = getEnrollmentStartDate();
    const exampleDeadlineToday = calculatePersonalDeadlineAt(exampleStartToday);
    const exampleStartDecember = "2026-12-10";
    const exampleDeadlineDecember = calculatePersonalDeadlineAt(exampleStartDecember);

    res.json({
      campaignKey: settings.campaign_key,
      campaignName: settings.campaign_name,
      enabled: settings.enabled,
      evergreenMode: settings.evergreen_mode,
      activatedAt: settings.activated_at,
      currentDateLagos: getCurrentDateInLagos(),
      settings,
      audience: audience.summary,
      operational,
      progress: operational.progress,
      deadlines: {
        exampleJoinToday: {
          startDate: exampleStartToday,
          personalDeadlineUtc: exampleDeadlineToday,
          personalDeadlineLagos: formatDeadlineInLagos(exampleDeadlineToday),
        },
        exampleJoinDecember: {
          startDate: exampleStartDecember,
          personalDeadlineUtc: exampleDeadlineDecember,
          personalDeadlineLagos: formatDeadlineInLagos(exampleDeadlineDecember),
        },
        nextUpcomingRecipientDeadline: operational.progress.nextUpcomingDeadline
          ? formatDeadlineInLagos(operational.progress.nextUpcomingDeadline)
          : null,
        activeSpecialPriceDeadlines: operational.progress.activeDeadlines,
        expiredSpecialPriceDeadlines: operational.progress.expiredDeadlines,
      },
      selftest,
    });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "status_failed" });
  }
});

aiMoneyCodeCampaignRouter.post("/activate", async (_req: Request, res: Response) => {
  try {
    const result = await activateAiMoneyCodeCampaign();
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "activation_failed" });
  }
});

aiMoneyCodeCampaignRouter.post("/tick", async (_req: Request, res: Response) => {
  try {
    const tick = await processAiMoneyCodeTick("admin_tick");
    res.json({ ok: true, ...tick });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "tick_failed" });
  }
});

aiMoneyCodeCampaignRouter.get("/audience", async (_req: Request, res: Response) => {
  try {
    const audience = await inspectAudience();
    res.json(audience);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "audience_failed" });
  }
});

aiMoneyCodeCampaignRouter.get("/selftest", async (_req: Request, res: Response) => {
  try {
    res.json(runAiMoneyCodeSelfTest());
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "selftest_failed" });
  }
});
