import { OUTREACH_GRACE_DAYS } from "../constants/outreach-pricing";
import { expireOutreachGraceAccounts } from "../database/outreach-repository";
import { logger } from "../utils/logger";

const HOUR_MS = 60 * 60 * 1000;

let graceInterval: ReturnType<typeof setInterval> | null = null;

export async function processOutreachGraceExpiry(): Promise<number> {
  const expired = await expireOutreachGraceAccounts();
  if (expired > 0) {
    logger.info("Outreach grace accounts expired", { count: expired });
  }
  return expired;
}

export function startOutreachGraceScheduler(): void {
  if (graceInterval) return;

  const tick = () => {
    void processOutreachGraceExpiry().catch((error) => {
      logger.error("Outreach grace scheduler tick failed", {
        error: error instanceof Error ? error.message : String(error),
      });
    });
  };

  setTimeout(tick, 45_000);
  graceInterval = setInterval(tick, HOUR_MS);
  logger.info("Outreach grace scheduler started (hourly)", {
    graceDays: OUTREACH_GRACE_DAYS,
  });
}
