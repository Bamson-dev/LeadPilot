import {
  listTrialSignupsDueForSequence,
  updateTrialSequenceProgress,
  type FreeTrialSignup,
} from "../database/free-trial-repository";
import { sendTrialEmail } from "./email";
import {
  TRIAL_STEP_HOURS_FROM_SIGNUP,
} from "./trial-email-content";
import { logger } from "../utils/logger";

const HOUR_MS = 60 * 60 * 1000;

function hoursSinceSignup(signedUpAt: string): number {
  return (Date.now() - new Date(signedUpAt).getTime()) / HOUR_MS;
}

function nextStepForUser(user: FreeTrialSignup): number | null {
  if (user.converted || user.sequence_paused || user.sequence_step >= 10) {
    return null;
  }
  return user.sequence_step + 1;
}

function isStepDue(user: FreeTrialSignup, step: number): boolean {
  const hoursRequired = TRIAL_STEP_HOURS_FROM_SIGNUP[step];
  if (hoursRequired === undefined) return false;
  return hoursSinceSignup(user.signed_up_at) >= hoursRequired;
}

export async function processTrialEmailSequence(): Promise<void> {
  const users = await listTrialSignupsDueForSequence();

  for (const user of users) {
    const nextStep = nextStepForUser(user);
    if (!nextStep || !isStepDue(user, nextStep)) continue;

    try {
      await sendTrialEmail(user.email, nextStep);
      await updateTrialSequenceProgress(user.email, nextStep);
      logger.info("Trial sequence email sent", {
        email: user.email,
        step: nextStep,
      });
    } catch (error) {
      logger.error("Trial sequence email failed", {
        email: user.email,
        step: nextStep,
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
  };

  // Run once on startup after a short delay, then hourly.
  setTimeout(tick, 30_000);
  sequenceInterval = setInterval(tick, HOUR_MS);
  logger.info("Trial email sequence scheduler started (hourly)");
}
