import type { ContentAutomationSettings } from "./types";

const HOUR_MS = 60 * 60 * 1000;
const GRACE_MS = 60_000;

export function getPublishingIntervalMs(settings: {
  publishing_interval_hours?: number;
}): number {
  const hours = settings.publishing_interval_hours ?? 3;
  return Math.max(1, Math.min(12, hours)) * HOUR_MS;
}

/** True when enough time has passed since the last publication. */
export function isPublicationIntervalElapsed(
  settings: Pick<ContentAutomationSettings, "last_publication_at" | "publishing_interval_hours">,
  now = Date.now()
): boolean {
  if (!settings.last_publication_at) return true;
  const elapsed = now - new Date(settings.last_publication_at).getTime();
  return elapsed >= getPublishingIntervalMs(settings) - GRACE_MS;
}

/**
 * Next time a publication may occur.
 * Respects last_publication_at + interval (restart-safe).
 */
export function computeNextPublicationAt(
  settings: Pick<
    ContentAutomationSettings,
    "last_publication_at" | "publishing_interval_hours"
  >,
  now = Date.now()
): Date {
  const intervalMs = getPublishingIntervalMs(settings);
  if (settings.last_publication_at) {
    const nextFromLast =
      new Date(settings.last_publication_at).getTime() + intervalMs;
    if (nextFromLast > now + GRACE_MS) {
      return new Date(nextFromLast);
    }
  }
  return new Date(now);
}

/** After a successful publish, when should the next slot open? */
export function computeNextPublicationAfterPublish(
  settings: Pick<ContentAutomationSettings, "publishing_interval_hours">,
  publishedAt = Date.now()
): Date {
  return new Date(publishedAt + getPublishingIntervalMs(settings));
}

/** Whether a scheduled job is due and interval allows publishing. */
export function canPublishScheduledJob(
  settings: Pick<
    ContentAutomationSettings,
    "last_publication_at" | "publishing_interval_hours"
  >,
  scheduledFor: string | null,
  now = Date.now()
): boolean {
  if (!scheduledFor) return isPublicationIntervalElapsed(settings, now);
  if (new Date(scheduledFor).getTime() > now) return false;
  return isPublicationIntervalElapsed(settings, now);
}
