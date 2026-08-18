import { Router, type Request, type Response } from "express";
import { requireAdminAuth } from "../../middleware/admin-auth";
import {
  formatDeadlineInLagos,
  getCampaignDay,
  getCurrentDateInLagos,
  isCanonicalDeadline,
} from "./campaign-definition";
import { DEADLINE_AT_ISO } from "./types";
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
    res.json({
      campaignKey: settings.campaign_key,
      campaignName: settings.campaign_name,
      enabled: settings.enabled,
      activatedAt: settings.activated_at,
      currentDateLagos: getCurrentDateInLagos(),
      currentCampaignDay: getCampaignDay(),
      settings,
      deadline: {
        canonicalUtc: DEADLINE_AT_ISO,
        canonicalLagos: formatDeadlineInLagos(),
        storedValue: settings.deadline_at,
        storedLagos: formatDeadlineInLagos(settings.deadline_at),
        valid: isCanonicalDeadline(settings.deadline_at),
      },
      audience: audience.summary,
      operational,
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
