import {
  countSearchLeads,
  getSearchJob,
  tryClaimFailureEmailSend,
  updateSearchJob,
} from "../database/search-repository";
import { getLicenseEmailBySearchId } from "../database/license-repository";
import {
  sendSearchFailedEmail,
  sendSearchQueueFailureEmail,
} from "./email";
import { logger } from "../utils/logger";

export type SearchFailureEmailKind = "queue" | "scraper";

function isStillActivelySearching(job: {
  status: string;
  scrapingInProgress?: boolean;
  emailScrapingComplete?: boolean;
}): boolean {
  if (job.emailScrapingComplete) return false;
  if (job.status === "completed") return false;
  if (job.status === "running") return true;
  if (job.scrapingInProgress) return true;
  return false;
}

/**
 * Send a terminal search-failure email only when the job is truly dead.
 * Suppresses BullMQ stall / hard-timeout races where the original worker is
 * still scraping and later completes successfully (failure + success emails).
 */
export async function notifySearchTerminalFailure(options: {
  searchId: string;
  query: string;
  location: string;
  licenseEmail?: string | null;
  errorMessage: string;
  kind?: SearchFailureEmailKind;
  /** When true, mark the job failed in DB (default true). */
  markFailed?: boolean;
  /** Extra settle time before re-checking for an in-flight scrape. */
  settleMs?: number;
}): Promise<{ sent: boolean; reason: string }> {
  const {
    searchId,
    query,
    location,
    licenseEmail,
    errorMessage,
    kind = "queue",
    markFailed = true,
    settleMs = 4_000,
  } = options;

  if (settleMs > 0) {
    await new Promise((resolve) => setTimeout(resolve, settleMs));
  }

  const existing = await getSearchJob(searchId).catch(() => null);
  if (!existing) {
    return { sent: false, reason: "missing_job" };
  }

  if (existing.emailScrapingComplete || existing.status === "completed") {
    logger.info("[search-failure] Skipping failure email — search already completed", {
      searchId,
      status: existing.status,
      emailScrapingComplete: existing.emailScrapingComplete,
    });
    return { sent: false, reason: "already_completed" };
  }

  if (isStillActivelySearching(existing)) {
    logger.warn(
      "[search-failure] Skipping failure email — scrape still active (likely stall race)",
      {
        searchId,
        status: existing.status,
        scrapingInProgress: existing.scrapingInProgress,
      }
    );
    return { sent: false, reason: "still_active" };
  }

  const leadsCollected = await countSearchLeads(searchId).catch(() => 0);
  if (leadsCollected > 0 && !existing.emailScrapingComplete) {
    logger.warn(
      "[search-failure] Skipping failure email — leads exist without Phase 2 finish",
      { searchId, leadsCollected }
    );
    return { sent: false, reason: "leads_pending_phase2" };
  }

  if (markFailed && existing.status !== "failed") {
    await updateSearchJob(searchId, {
      status: "failed",
      error: errorMessage,
      scrapingInProgress: false,
    }).catch((err) =>
      logger.error("[search-failure] Failed to mark search failed", {
        searchId,
        error: err instanceof Error ? err.message : "unknown",
      })
    );
  }

  let claimed = false;
  try {
    claimed = await tryClaimFailureEmailSend(searchId);
  } catch (err) {
    logger.error("[search-failure] Failure email claim failed", {
      searchId,
      error: err instanceof Error ? err.message : "unknown",
    });
    return { sent: false, reason: "claim_error" };
  }

  if (!claimed) {
    logger.info("[search-failure] Skipping failure email — already claimed or results sent", {
      searchId,
    });
    return { sent: false, reason: "already_claimed" };
  }

  const email =
    licenseEmail?.trim().toLowerCase() ||
    (await getLicenseEmailBySearchId(searchId).catch(() => null));

  if (!email) {
    return { sent: false, reason: "no_email" };
  }

  try {
    if (kind === "scraper") {
      await sendSearchFailedEmail(email, query, location);
    } else {
      await sendSearchQueueFailureEmail(email, query, location);
    }
    logger.info("[search-failure] Terminal failure email sent", {
      searchId,
      kind,
      email,
    });
    return { sent: true, reason: "sent" };
  } catch (err) {
    logger.error("[search-failure] Failed to send failure email", {
      searchId,
      error: err instanceof Error ? err.message : "unknown",
    });
    return { sent: false, reason: "send_error" };
  }
}
