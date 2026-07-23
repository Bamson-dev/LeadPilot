import {
  TRIAL_SEQUENCE_MAX_STEP_V1,
  TRIAL_SEQUENCE_VERSION_V1,
  V1_TRIAL_EMAIL_SUBJECTS,
  V1_TRIAL_STEP_HOURS_FROM_SIGNUP,
  getV1TrialEmailBody,
} from "./trial-email-content-v1";
import {
  TRIAL_SEQUENCE_MAX_STEP_V2,
  TRIAL_SEQUENCE_VERSION_V2,
  V2_TRIAL_EMAIL_SUBJECTS,
  V2_TRIAL_STEP_HOURS_FROM_SIGNUP,
  getV2TrialEmailBody,
} from "./trial-email-content-v2";
import {
  TRIAL_POST_SEARCH_EMAIL_SUBJECT,
  TRIAL_POST_SEARCH_TRACKING_STEP,
  TRIAL_SEQUENCE_MAX_STEP_V3,
  TRIAL_SEQUENCE_VERSION_V3,
  V3_TRIAL_EMAIL_SUBJECTS,
  V3_TRIAL_STEP_HOURS_FROM_SIGNUP,
  getTrialPostSearchEmailBody,
  getV3TrialEmailBody,
  mapOldSequenceStepToV3,
} from "./trial-email-content-v3";

export {
  TRIAL_POST_SEARCH_EMAIL_SUBJECT,
  TRIAL_POST_SEARCH_TRACKING_STEP,
  TRIAL_SEQUENCE_VERSION_V1,
  TRIAL_SEQUENCE_VERSION_V2,
  TRIAL_SEQUENCE_VERSION_V3,
  mapOldSequenceStepToV3,
};

export const CURRENT_TRIAL_SEQUENCE_VERSION = TRIAL_SEQUENCE_VERSION_V3;

export function getMaxSequenceStep(version: number): number {
  if (version === TRIAL_SEQUENCE_VERSION_V1) return TRIAL_SEQUENCE_MAX_STEP_V1;
  if (version === TRIAL_SEQUENCE_VERSION_V2) return TRIAL_SEQUENCE_MAX_STEP_V2;
  return TRIAL_SEQUENCE_MAX_STEP_V3;
}

export function getTrialStepHoursFromSignup(version: number, step: number): number | undefined {
  if (version === TRIAL_SEQUENCE_VERSION_V1) {
    return V1_TRIAL_STEP_HOURS_FROM_SIGNUP[step];
  }
  if (version === TRIAL_SEQUENCE_VERSION_V2) {
    return V2_TRIAL_STEP_HOURS_FROM_SIGNUP[step];
  }
  return V3_TRIAL_STEP_HOURS_FROM_SIGNUP[step];
}

export function getTrialEmailSubject(version: number, step: number): string | undefined {
  if (version === TRIAL_SEQUENCE_VERSION_V1) {
    return V1_TRIAL_EMAIL_SUBJECTS[step];
  }
  if (version === TRIAL_SEQUENCE_VERSION_V2) {
    return V2_TRIAL_EMAIL_SUBJECTS[step];
  }
  return V3_TRIAL_EMAIL_SUBJECTS[step];
}

export function getTrialEmailBody(version: number, step: number): string {
  if (version === TRIAL_SEQUENCE_VERSION_V1) {
    return getV1TrialEmailBody(step);
  }
  if (version === TRIAL_SEQUENCE_VERSION_V2) {
    return getV2TrialEmailBody(step);
  }
  return getV3TrialEmailBody(step);
}

/** @deprecated Use getTrialStepHoursFromSignup(version, step) */
export const TRIAL_STEP_HOURS_FROM_SIGNUP = V3_TRIAL_STEP_HOURS_FROM_SIGNUP;

/** @deprecated Use getTrialEmailSubject(version, step) */
export const TRIAL_EMAIL_SUBJECTS = V3_TRIAL_EMAIL_SUBJECTS;

export { getTrialPostSearchEmailBody };
