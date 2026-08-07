import { supabase } from "../database/client";
import { trackEvent } from "./track";
import { EVENT_NAMES } from "./event-taxonomy";
import { hashEmail } from "./privacy";

/**
 * Emit first_search / second_search once per user (idempotent).
 * Uses prior search_started count; current event may still be in the flush batch.
 */
export function trackSearchOrdinals(input: {
  userEmail?: string | null;
  licenseId?: string | null;
  searchId: string;
  isTrial?: boolean;
}): void {
  const emailHash = hashEmail(input.userEmail);
  if (!emailHash && !input.licenseId) return;

  void (async () => {
    try {
      let query = supabase
        .from("analytics_events")
        .select("id", { count: "exact", head: true })
        .eq("event_name", EVENT_NAMES.SEARCH_STARTED)
        .eq("source", "server");

      if (emailHash) {
        query = query.eq("user_email_hash", emailHash);
      } else if (input.licenseId) {
        query = query.eq("license_id", input.licenseId);
      }

      const { count } = await query;
      const prior = count ?? 0;
      const ordinal = prior + 1; // current search not necessarily flushed yet

      if (ordinal === 1) {
        trackEvent({
          eventName: EVENT_NAMES.FIRST_SEARCH,
          source: "server",
          userEmail: input.userEmail,
          licenseId: input.licenseId,
          searchId: input.searchId,
          properties: { isTrial: Boolean(input.isTrial) },
          idempotencyKey: `first_search:${emailHash || input.licenseId}`,
        });
      } else if (ordinal === 2) {
        trackEvent({
          eventName: EVENT_NAMES.SECOND_SEARCH,
          source: "server",
          userEmail: input.userEmail,
          licenseId: input.licenseId,
          searchId: input.searchId,
          properties: { isTrial: Boolean(input.isTrial) },
          idempotencyKey: `second_search:${emailHash || input.licenseId}`,
        });
      }
    } catch {
      /* never block search */
    }
  })();
}
