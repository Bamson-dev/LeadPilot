import {
  getMaxSequenceStep,
  getTrialStepHoursFromSignup,
} from "./trial-email-content";

const HOUR_MS = 60 * 60 * 1000;

/** Minimum spacing when a step is already past its ideal signup-relative due time. */
export const POST_CATCHUP_MIN_GAP_HOURS = 24;

export function idealStepDueAt(
  signedUpAt: string,
  version: number,
  step: number
): Date | null {
  const hours = getTrialStepHoursFromSignup(version, step);
  if (hours === undefined) return null;
  return new Date(new Date(signedUpAt).getTime() + hours * HOUR_MS);
}

/**
 * When the ideal due time is still in the future, honor it.
 * When it is in the past, schedule from referenceTime instead of sending catch-up immediately.
 */
export function computeNextSequenceEmailAt(
  signedUpAt: string,
  version: number,
  nextStep: number,
  referenceTime: Date = new Date()
): string | null {
  const ideal = idealStepDueAt(signedUpAt, version, nextStep);
  if (!ideal) return null;

  if (ideal.getTime() > referenceTime.getTime()) {
    return ideal.toISOString();
  }

  const prevHours = getTrialStepHoursFromSignup(version, nextStep - 1) ?? 0;
  const currHours = getTrialStepHoursFromSignup(version, nextStep) ?? prevHours;
  const naturalGap = Math.max(POST_CATCHUP_MIN_GAP_HOURS, currHours - prevHours);
  return new Date(referenceTime.getTime() + naturalGap * HOUR_MS).toISOString();
}

export function scheduleAfterStepSent(
  signedUpAt: string,
  version: number,
  sentStep: number,
  sentAt: Date = new Date()
): string | null {
  const nextStep = sentStep + 1;
  if (nextStep > getMaxSequenceStep(version)) return null;
  return computeNextSequenceEmailAt(signedUpAt, version, nextStep, sentAt);
}

export function isSequenceStepDue(
  signedUpAt: string,
  sequenceVersion: number,
  nextStep: number,
  nextSequenceEmailAt: string | null | undefined
): boolean {
  if (nextSequenceEmailAt) {
    return Date.now() >= new Date(nextSequenceEmailAt).getTime();
  }

  const hoursRequired = getTrialStepHoursFromSignup(sequenceVersion, nextStep);
  if (hoursRequired === undefined) return false;
  const hoursSinceSignup =
    (Date.now() - new Date(signedUpAt).getTime()) / HOUR_MS;
  return hoursSinceSignup >= hoursRequired;
}
