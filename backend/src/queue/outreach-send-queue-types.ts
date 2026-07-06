export const OUTREACH_SEND_QUEUE_NAME = "leadthur-outreach-send-queue";

/** Upper bound on per-mailbox send spacing (outreach-send-service randomSpacingMs). */
export const OUTREACH_SEND_MAX_SPACING_MS = 15_000;

/**
 * BullMQ active-job lock for outreach sends.
 * Must exceed max spacing (15s) + SMTP socket timeouts (30s) + DB/crypto headroom.
 * Daily-cap waits use moveToDelayed — they do not hold this lock.
 */
export const OUTREACH_BULLMQ_LOCK_DURATION_MS = 120_000;

/** Stall check interval — well below lock duration to avoid false stalls during spacing/SMTP. */
export const OUTREACH_BULLMQ_STALLED_INTERVAL_MS = 60_000;

export const OUTREACH_BULLMQ_MAX_STALLED_COUNT = 5;

export type OutreachSendMode = "auto" | "manual";

export interface OutreachSendJobData {
  sentEmailId: string;
  userId: string;
  sendMode: OutreachSendMode;
  mailboxId?: string;
}
