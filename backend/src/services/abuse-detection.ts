import { supabase } from "../database/client";
import { logger } from "../utils/logger";

const hourlyTracker = new Map<string, { count: number; resetAt: number }>();

async function flagAbuse(licenseId: string, count: number): Promise<void> {
  logger.warn("High search volume detected", { licenseId, count });

  const { error } = await supabase
    .from("license_keys")
    .update({
      notes: `Abuse flag: ${count} searches in 1 hour at ${new Date().toISOString()}`,
    })
    .eq("id", licenseId);

  if (error) {
    logger.error("Failed to flag abuse in license notes", {
      licenseId,
      error: error.message,
    });
  }
}

export function trackSearch(licenseId: string): void {
  const now = Date.now();
  const record = hourlyTracker.get(licenseId);

  if (!record || now > record.resetAt) {
    hourlyTracker.set(licenseId, {
      count: 1,
      resetAt: now + 60 * 60 * 1000,
    });
    return;
  }

  record.count++;

  if (record.count === 20) {
    void flagAbuse(licenseId, record.count);
  }
}
