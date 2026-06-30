import { countSearchLeads } from "../database/search-repository";
import { logger } from "./logger";

export type SearchLifecycleStage =
  | "job_enqueued"
  | "job_dequeued"
  | "job_processing_start"
  | "phase1_begin"
  | "phase1_heartbeat"
  | "phase1_complete"
  | "phase2_attempt_start"
  | "phase2_work_begin"
  | "phase2_first_playwright_tab"
  | "phase2_complete"
  | "phase2_recovery_start"
  | "job_processing_end";

export function logSearchLifecycle(
  stage: SearchLifecycleStage,
  searchId: string,
  extra?: Record<string, unknown>
): void {
  logger.info("[search-lifecycle]", {
    stage,
    searchId,
    at: new Date().toISOString(),
    ...extra,
  });
}

export function startPhase1Heartbeat(
  searchId: string,
  jobStartedAt: number,
  localLeadCount: () => number
): () => void {
  const timer = setInterval(() => {
    void (async () => {
      const dbCount = await countSearchLeads(searchId).catch(() => null);
      logSearchLifecycle("phase1_heartbeat", searchId, {
        elapsedMs: Date.now() - jobStartedAt,
        leadCount: dbCount ?? localLeadCount(),
      });
    })();
  }, 30_000);

  return () => clearInterval(timer);
}
