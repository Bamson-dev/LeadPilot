import { logger } from "../utils/logger";
import { getActiveConnection } from "./repository";
import { runGscSync } from "./sync";

const HOUR_MS = 60 * 60 * 1000;
let interval: ReturnType<typeof setInterval> | null = null;
let tickRunning = false;

export async function processGscSyncTick(): Promise<void> {
  if (tickRunning) return;
  tickRunning = true;
  try {
    const connection = await getActiveConnection();
    if (!connection || connection.status !== "connected") {
      return;
    }
    const next = connection.next_sync_at
      ? new Date(connection.next_sync_at).getTime()
      : 0;
    if (next && next > Date.now() + 30_000) {
      return;
    }
    logger.info("GSC scheduler tick — starting sync");
    await runGscSync("scheduler");
  } catch (err) {
    logger.error("GSC scheduler tick failed", {
      error: err instanceof Error ? err.message : "unknown",
    });
  } finally {
    tickRunning = false;
  }
}

export function startGoogleSearchConsoleScheduler(): void {
  if (interval) return;
  setTimeout(() => {
    void processGscSyncTick();
  }, 90_000);
  // Hourly due-check; sync itself runs about once per day via next_sync_at.
  interval = setInterval(() => {
    void processGscSyncTick();
  }, HOUR_MS);
  logger.info("Google Search Console scheduler started (hourly due-check, daily sync)");
}

export function stopGoogleSearchConsoleScheduler(): void {
  if (interval) {
    clearInterval(interval);
    interval = null;
  }
}
