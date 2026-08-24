import { supabase } from "../database/client";
import { trackEvent } from "./track";
import { EVENT_NAMES } from "./event-taxonomy";
import { hashEmail } from "./privacy";
import { countLocalSearchStarted } from "../storage/local-analytics-store";
import { analyticsUsesSupabase } from "./analytics-data-source";

/**
 * Emit first_search / second_search once per user (idempotent).
 * Uses license search_count when possible to avoid Supabase analytics reads.
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
      let ordinal = 0;

      if (input.licenseId && !input.isTrial) {
        const { data } = await supabase
          .from("license_keys")
          .select("search_count, searches_used")
          .eq("id", input.licenseId)
          .maybeSingle();
        const used = Math.max(
          Number(data?.search_count ?? 0),
          Number(data?.searches_used ?? 0)
        );
        ordinal = used + 1;
      } else if (!analyticsUsesSupabase()) {
        const prior = await countLocalSearchStarted({
          userEmailHash: emailHash,
          licenseId: input.licenseId,
        });
        ordinal = prior + 1;
      } else {
        let query = supabase
          .from("analytics_events")
          .select("id", { count: "exact", head: true })
          .eq("event_name", EVENT_NAMES.SEARCH_STARTED)
          .eq("source", "server");
        if (emailHash) query = query.eq("user_email_hash", emailHash);
        else if (input.licenseId) query = query.eq("license_id", input.licenseId);
        const { count } = await query;
        ordinal = (count ?? 0) + 1;
      }

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
