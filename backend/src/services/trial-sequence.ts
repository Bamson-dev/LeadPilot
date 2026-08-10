import {
  listTrialSignupsDueForPostSearchEmail,
  listTrialSignupsDueForSequence,
  markPostSearchEmailSent,
  updateTrialSequenceProgress,
  type FreeTrialSignup,
} from "../database/free-trial-repository";
import { sendTrialEmail, sendTrialPostSearchEmail } from "./email";
import { getMaxSequenceStep } from "./trial-email-content";
import {
  isSequenceStepDue,
  scheduleAfterStepSent,
} from "./trial-sequence-schedule";
import { logger } from "../utils/logger";

const HOUR_MS = 60 * 60 * 1000;

function nextStepForUser(user: FreeTrialSignup): number | null {
  const maxStep = getMaxSequenceStep(user.sequence_version ?? 1);
  if (user.converted || user.sequence_paused || user.sequence_step >= maxStep) {
    return null;
  }
  return user.sequence_step + 1;
}

function isStepDue(user: FreeTrialSignup, step: number): boolean {
  return isSequenceStepDue(
    user.signed_up_at,
    user.sequence_version ?? 1,
    step,
    user.next_sequence_email_at
  );
}

export async function processTrialEmailSequence(): Promise<void> {
  const users = await listTrialSignupsDueForSequence();
  let due = 0;
  let sent = 0;
  let failed = 0;

  for (const user of users) {
    const nextStep = nextStepForUser(user);
    if (!nextStep || !isStepDue(user, nextStep)) continue;
    due += 1;

    try {
      await sendTrialEmail(user.email, nextStep, user.sequence_version ?? 1);
      const sentAt = new Date();
      const nextSendAt = scheduleAfterStepSent(
        user.signed_up_at,
        user.sequence_version ?? 1,
        nextStep,
        sentAt
      );
      await updateTrialSequenceProgress(user.email, nextStep, nextSendAt, sentAt);
      sent += 1;
      logger.info("Trial sequence email sent", {
        step: nextStep,
        sequenceVersion: user.sequence_version ?? 1,
      });
    } catch (error) {
      failed += 1;
      logger.error("Trial sequence email failed", {
        step: nextStep,
        sequenceVersion: user.sequence_version ?? 1,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  logger.info("Trial sequence scheduler tick", {
    eligibleUnpaused: users.length,
    due,
    sent,
    failed,
  });
}

export async function processTrialPostSearchEmails(): Promise<void> {
  const users = await listTrialSignupsDueForPostSearchEmail();

  for (const user of users) {
    if (!user.post_search_query || !user.post_search_location) continue;

    try {
      await sendTrialPostSearchEmail(
        user.email,
        user.post_search_query,
        user.post_search_location
      );
      await markPostSearchEmailSent(user.email);
      logger.info("Trial post-search email sent", {
        email: user.email,
        query: user.post_search_query,
        location: user.post_search_location,
      });
    } catch (error) {
      logger.error("Trial post-search email failed", {
        email: user.email,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}

let sequenceInterval: ReturnType<typeof setInterval> | null = null;

export function startTrialSequenceScheduler(): void {
  if (sequenceInterval) return;

  const tick = () => {
    void processTrialEmailSequence().catch((error) => {
      logger.error("Trial sequence scheduler tick failed", {
        error: error instanceof Error ? error.message : String(error),
      });
    });
    void processTrialPostSearchEmails().catch((error) => {
      logger.error("Trial post-search scheduler tick failed", {
        error: error instanceof Error ? error.message : String(error),
      });
    });
  };

  // Run once on startup after a short delay, then hourly.
  setTimeout(tick, 30_000);
  sequenceInterval = setInterval(tick, HOUR_MS);
  logger.info("Trial email sequence scheduler started (hourly)");
}
