import { Router, type Request, type Response } from "express";
import { trackEvents, type AnalyticsEventInput } from "./track";
import { categoryForEvent } from "./event-taxonomy";
import { sanitizeProperties } from "./privacy";
import { logger } from "../utils/logger";

const router = Router();

const ALLOWED_CLIENT_EVENTS = new Set([
  "landing_viewed",
  "freetrial_viewed",
  "trial_email_submitted",
  "trial_started",
  "trial_search_started",
  "trial_search_completed",
  "results_displayed",
  "paywall_viewed",
  "checkout_started",
  "payment_initiated",
  "checkout_abandoned",
  "license_activated",
  "dashboard_entered",
  "first_search",
  "second_search",
  "csv_export",
  "mailbox_connected",
  "mailbox_disconnected",
  "first_outreach",
  "second_visit",
  "returning_customer",
  "search_started",
  "search_completed",
  "search_failed",
  "search_cancelled",
  "business_saved",
  "business_opened",
  "business_details_viewed",
  "email_sent",
  "email_opened",
  "template_used",
  "referral_click",
  "page_view",
  "page_exit",
  "click",
  "dead_click",
  "form_abandoned",
  "validation_failure",
  "modal_opened",
  "modal_closed",
  "drawer_opened",
  "drawer_closed",
  "scroll_depth",
]);

/**
 * POST /public/events
 * Append-only client event ingest. Never blocks UX — always 202.
 * Does not change any product API.
 */
router.post("/events", (req: Request, res: Response) => {
  res.status(202).json({ accepted: true });

  try {
    const body = req.body as {
      events?: Array<Record<string, unknown>>;
      sessionId?: string;
      anonymousId?: string;
    };

    const rawEvents = Array.isArray(body?.events) ? body.events.slice(0, 40) : [];
    if (rawEvents.length === 0) return;

    const inputs: AnalyticsEventInput[] = [];
    for (const raw of rawEvents) {
      const eventName = typeof raw.eventName === "string" ? raw.eventName : "";
      if (!eventName || !ALLOWED_CLIENT_EVENTS.has(eventName)) continue;

      inputs.push({
        eventName,
        eventCategory: categoryForEvent(eventName),
        occurredAt: typeof raw.occurredAt === "string" ? raw.occurredAt : undefined,
        sessionId: (typeof raw.sessionId === "string" ? raw.sessionId : body.sessionId) || null,
        anonymousId:
          (typeof raw.anonymousId === "string" ? raw.anonymousId : body.anonymousId) || null,
        userEmail: typeof raw.userEmail === "string" ? raw.userEmail : null,
        licenseId: typeof raw.licenseId === "string" ? raw.licenseId : null,
        correlationId: typeof raw.correlationId === "string" ? raw.correlationId : null,
        searchId: typeof raw.searchId === "string" ? raw.searchId : null,
        source: "client",
        pagePath: typeof raw.pagePath === "string" ? raw.pagePath : null,
        referrer: typeof raw.referrer === "string" ? raw.referrer : null,
        utmSource: typeof raw.utmSource === "string" ? raw.utmSource : null,
        utmMedium: typeof raw.utmMedium === "string" ? raw.utmMedium : null,
        utmCampaign: typeof raw.utmCampaign === "string" ? raw.utmCampaign : null,
        utmContent: typeof raw.utmContent === "string" ? raw.utmContent : null,
        utmTerm: typeof raw.utmTerm === "string" ? raw.utmTerm : null,
        fbclid: typeof raw.fbclid === "string" ? raw.fbclid : null,
        gclid: typeof raw.gclid === "string" ? raw.gclid : null,
        landingPage: typeof raw.landingPage === "string" ? raw.landingPage : null,
        country: typeof raw.country === "string" ? raw.country : null,
        device: typeof raw.device === "string" ? raw.device : null,
        browser: typeof raw.browser === "string" ? raw.browser : null,
        os: typeof raw.os === "string" ? raw.os : null,
        durationMs: typeof raw.durationMs === "number" ? raw.durationMs : null,
        idempotencyKey: typeof raw.idempotencyKey === "string" ? raw.idempotencyKey : null,
        properties: sanitizeProperties(
          (raw.properties && typeof raw.properties === "object"
            ? (raw.properties as Record<string, unknown>)
            : {}) as Record<string, unknown>
        ),
      });
    }

    if (inputs.length > 0) trackEvents(inputs);
  } catch (err) {
    logger.debug("[observability] public events ingest error", {
      error: err instanceof Error ? err.message : "unknown",
    });
  }
});

export default router;
