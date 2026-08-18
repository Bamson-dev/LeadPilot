import { inspectAudience } from "./eligibility";
import {
  calculatePersonalDeadlineAt,
  getEnrollmentStartDate,
} from "./campaign-definition";
import { enrollNewRecipients, ensureCampaignSettings } from "./repository";
import { logger } from "../../utils/logger";
import type { EligiblePaidUser } from "./types";

export async function discoverAndEnrollNewRecipients(): Promise<number> {
  const settings = await ensureCampaignSettings();
  if (!settings.enabled) return 0;

  const { users } = await inspectAudience();
  if (!users.length) return 0;

  const startDate = getEnrollmentStartDate();
  const personalDeadlineAt = calculatePersonalDeadlineAt(startDate);
  const enrolledNow = await enrollNewRecipients(users, startDate, personalDeadlineAt);

  if (enrolledNow > 0) {
    logger.info("AI money code auto-enrolled recipients", { count: enrolledNow });
  }
  return enrolledNow;
}

export async function tryEnrollEligibleLicense(input: {
  licenseId: string;
  email: string;
}): Promise<"enrolled" | "existing" | "skipped"> {
  const settings = await ensureCampaignSettings();
  if (!settings.enabled) return "skipped";

  const normalizedEmail = input.email.trim().toLowerCase();
  const { users } = await inspectAudience();
  const match = users.find((u) => u.licenseId === input.licenseId || u.normalizedEmail === normalizedEmail);
  if (!match) return "skipped";

  const startDate = getEnrollmentStartDate();
  const personalDeadlineAt = calculatePersonalDeadlineAt(startDate);
  const enrolledNow = await enrollNewRecipients([match], startDate, personalDeadlineAt);
  return enrolledNow > 0 ? "enrolled" : "existing";
}

export async function tryEnrollFromEligibleUser(user: EligiblePaidUser): Promise<"enrolled" | "existing" | "skipped"> {
  const settings = await ensureCampaignSettings();
  if (!settings.enabled) return "skipped";

  const startDate = getEnrollmentStartDate();
  const personalDeadlineAt = calculatePersonalDeadlineAt(startDate);
  const enrolledNow = await enrollNewRecipients([user], startDate, personalDeadlineAt);
  return enrolledNow > 0 ? "enrolled" : "existing";
}
