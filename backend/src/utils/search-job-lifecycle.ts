import { countSearchLeads } from "../database/search-repository";
import { logger } from "./logger";
import { trackEvent } from "../observability/track";
import { EVENT_NAMES } from "../observability/event-taxonomy";

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

const STAGE_TO_EVENT: Partial<Record<SearchLifecycleStage, string>> = {
  job_enqueued: EVENT_NAMES.SEARCH_QUEUED,
  job_dequeued: EVENT_NAMES.SEARCH_DEQUEUED,
  job_processing_start: EVENT_NAMES.SEARCH_WORKER_START,
  job_processing_end: EVENT_NAMES.SEARCH_WORKER_END,
};

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

  const eventName = STAGE_TO_EVENT[stage];
  if (eventName) {
    trackEvent({
      eventName,
      eventCategory: "search",
      source: "worker",
      searchId,
      jobId: typeof extra?.jobId === "string" ? extra.jobId : null,
      correlationId: typeof extra?.correlationId === "string" ? extra.correlationId : searchId,
      durationMs: typeof extra?.elapsedMs === "number" ? extra.elapsedMs : null,
      properties: {
        stage,
        ...extra,
      },
      idempotencyKey: `search:${searchId}:${stage}:${typeof extra?.attempt === "number" ? extra.attempt : 0}`,
    });
  }

  if (stage === "job_processing_end") {
    const success = extra?.success === true || extra?.status === "completed";
    trackEvent({
      eventName: success ? EVENT_NAMES.SEARCH_COMPLETED : EVENT_NAMES.SEARCH_FAILED,
      eventCategory: "search",
      source: "worker",
      searchId,
      durationMs: typeof extra?.elapsedMs === "number" ? extra.elapsedMs : null,
      properties: { stage, ...extra },
      idempotencyKey: `search:${searchId}:result:${success ? "ok" : "fail"}`,
    });
  }
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
