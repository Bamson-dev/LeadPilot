import {
  listTrialSignupsDueForPostSearchEmail,
  listTrialSignupsDueForSequence,
  markPostSearchEmailSent,
  updateTrialSequenceProgress,
  type FreeTrialSignup,
} from "../database/free-trial-repository";
import { sendTrialEmail, sendTrialPostSearchEmail } from "./email";
import {
  getMaxSequenceStep,
  getTrialStepHoursFromSignup,
} from "./trial-email-content";
import { logger } from "../utils/logger";

const HOUR_MS = 60 * 60 * 1000;

function hoursSinceSignup(signedUpAt: string): number {
  return (Date.now() - new Date(signedUpAt).getTime()) / HOUR_MS;
}

function nextStepForUser(user: FreeTrialSignup): number | null {
  const maxStep = getMaxSequenceStep(user.sequence_version ?? 1);
  if (user.converted || user.sequence_paused || user.sequence_step >= maxStep) {
    return null;
  }
  return user.sequence_step + 1;
}

function isStepDue(user: FreeTrialSignup, step: number): boolean {
  const version = user.sequence_version ?? 1;
  const hoursRequired = getTrialStepHoursFromSignup(version, step);
  if (hoursRequired === undefined) return false;
  return hoursSinceSignup(user.signed_up_at) >= hoursRequired;
}

export async function processTrialEmailSequence(): Promise<void> {
  const users = await listTrialSignupsDueForSequence();

  for (const user of users) {
    const nextStep = nextStepForUser(user);
    if (!nextStep || !isStepDue(user, nextStep)) continue;

    try {
      await sendTrialEmail(user.email, nextStep, user.sequence_version ?? 1);
      await updateTrialSequenceProgress(user.email, nextStep);
      logger.info("Trial sequence email sent", {
        email: user.email,
        step: nextStep,
        sequenceVersion: user.sequence_version ?? 1,
      });
    } catch (error) {
      logger.error("Trial sequence email failed", {
        email: user.email,
        step: nextStep,
        sequenceVersion: user.sequence_version ?? 1,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
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
