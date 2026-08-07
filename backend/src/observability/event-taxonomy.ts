/**
 * LeadThur Phase 2 — Event Taxonomy
 * Passive product intelligence. Events are append-only and privacy-safe.
 */

export const EVENT_CATEGORIES = [
  "funnel",
  "product",
  "behaviour",
  "business",
  "search",
  "technical",
  "error",
  "outreach",
  "billing",
  "affiliate",
] as const;

export type EventCategory = (typeof EVENT_CATEGORIES)[number];

/** Canonical event names used by client + server emitters */
export const EVENT_NAMES = {
  // Funnel
  LANDING_VIEWED: "landing_viewed",
  FREETRIAL_VIEWED: "freetrial_viewed",
  TRIAL_EMAIL_SUBMITTED: "trial_email_submitted",
  TRIAL_STARTED: "trial_started",
  TRIAL_SEARCH_STARTED: "trial_search_started",
  TRIAL_SEARCH_COMPLETED: "trial_search_completed",
  RESULTS_DISPLAYED: "results_displayed",
  PAYWALL_VIEWED: "paywall_viewed",
  CHECKOUT_STARTED: "checkout_started",
  PAYMENT_INITIATED: "payment_initiated",
  PAYMENT_COMPLETED: "payment_completed",
  PAYMENT_FAILED: "payment_failed",
  LICENSE_ACTIVATED: "license_activated",
  DASHBOARD_ENTERED: "dashboard_entered",
  FIRST_SEARCH: "first_search",
  SECOND_SEARCH: "second_search",
  CSV_EXPORT: "csv_export",
  MAILBOX_CONNECTED: "mailbox_connected",
  MAILBOX_DISCONNECTED: "mailbox_disconnected",
  FIRST_OUTREACH: "first_outreach",
  SECOND_VISIT: "second_visit",
  RETURNING_CUSTOMER: "returning_customer",

  // Product / Discovery
  SEARCH_STARTED: "search_started",
  SEARCH_COMPLETED: "search_completed",
  SEARCH_FAILED: "search_failed",
  SEARCH_CANCELLED: "search_cancelled",
  BUSINESS_SAVED: "business_saved",
  BUSINESS_OPENED: "business_opened",
  BUSINESS_DETAILS_VIEWED: "business_details_viewed",

  // Outreach
  EMAIL_SENT: "email_sent",
  EMAIL_FAILED: "email_failed",
  EMAIL_OPENED: "email_opened",
  EMAIL_CLICKED: "email_clicked",
  EMAIL_QUEUED: "email_queued",
  REPLY_RECEIVED: "reply_received",
  TEMPLATE_USED: "template_used",

  // Affiliate
  REFERRAL_CLICK: "referral_click",
  REFERRAL_SIGNUP: "referral_signup",
  REFERRAL_CONVERSION: "referral_conversion",
  WITHDRAWAL_REQUESTED: "withdrawal_requested",

  // Billing / License health
  CHECKOUT_ABANDONED: "checkout_abandoned",
  SUBSCRIPTION_RENEWAL: "subscription_renewal",
  LICENSE_ACTIVATION_FAILED: "license_activation_failed",
  LICENSE_INVALID: "license_invalid",
  LICENSE_DEVICE_DENIED: "license_device_denied",
  LICENSE_EXPIRED: "license_expired",
  DUPLICATE_ACTIVATION: "duplicate_activation",

  // Behaviour
  PAGE_VIEW: "page_view",
  PAGE_EXIT: "page_exit",
  CLICK: "click",
  DEAD_CLICK: "dead_click",
  FORM_ABANDONED: "form_abandoned",
  VALIDATION_FAILURE: "validation_failure",
  MODAL_OPENED: "modal_opened",
  MODAL_CLOSED: "modal_closed",
  DRAWER_OPENED: "drawer_opened",
  DRAWER_CLOSED: "drawer_closed",

  // Technical / Search lifecycle
  SEARCH_QUEUED: "search_queued",
  SEARCH_DEQUEUED: "search_dequeued",
  SEARCH_WORKER_START: "search_worker_start",
  SEARCH_WORKER_END: "search_worker_end",
  QUEUE_BACKLOG: "queue_backlog",
  WORKER_OFFLINE: "worker_offline",
  BROWSER_CRASH: "browser_crash",
  SMTP_FAILURE: "smtp_failure",
  WEBHOOK_FAILURE: "webhook_failure",
  API_ERROR: "api_error",
  EXCEPTION: "exception",
} as const;

export type EventName = (typeof EVENT_NAMES)[keyof typeof EVENT_NAMES];

export const FUNNEL_STEPS = [
  EVENT_NAMES.LANDING_VIEWED,
  EVENT_NAMES.FREETRIAL_VIEWED,
  EVENT_NAMES.TRIAL_EMAIL_SUBMITTED,
  EVENT_NAMES.TRIAL_STARTED,
  EVENT_NAMES.TRIAL_SEARCH_STARTED,
  EVENT_NAMES.TRIAL_SEARCH_COMPLETED,
  EVENT_NAMES.RESULTS_DISPLAYED,
  EVENT_NAMES.PAYWALL_VIEWED,
  EVENT_NAMES.CHECKOUT_STARTED,
  EVENT_NAMES.PAYMENT_INITIATED,
  EVENT_NAMES.PAYMENT_COMPLETED,
  EVENT_NAMES.LICENSE_ACTIVATED,
  EVENT_NAMES.DASHBOARD_ENTERED,
  EVENT_NAMES.FIRST_SEARCH,
  EVENT_NAMES.SECOND_SEARCH,
  EVENT_NAMES.CSV_EXPORT,
  EVENT_NAMES.MAILBOX_CONNECTED,
  EVENT_NAMES.FIRST_OUTREACH,
  EVENT_NAMES.SECOND_VISIT,
  EVENT_NAMES.RETURNING_CUSTOMER,
] as const;

export function categoryForEvent(name: string): EventCategory {
  if (FUNNEL_STEPS.includes(name as (typeof FUNNEL_STEPS)[number])) return "funnel";
  if (name.startsWith("search_") || name.includes("search")) return "search";
  if (
    name.includes("email_") ||
    name.includes("mailbox") ||
    name.includes("outreach") ||
    name.includes("template") ||
    name.includes("reply")
  ) {
    return "outreach";
  }
  if (
    name.includes("payment") ||
    name.includes("checkout") ||
    name.includes("license") ||
    name.includes("subscription") ||
    name.includes("activation") ||
    name.includes("duplicate_activation")
  ) {
    return "billing";
  }
  if (name.includes("referral") || name.includes("withdrawal")) return "affiliate";
  if (
    name.includes("click") ||
    name.includes("page_") ||
    name.includes("modal") ||
    name.includes("drawer") ||
    name.includes("form_") ||
    name.includes("validation") ||
    name.includes("scroll") ||
    name === "returning_customer" ||
    name === "second_visit"
  ) {
    return "behaviour";
  }
  if (
    name.includes("queue") ||
    name.includes("worker") ||
    name.includes("browser") ||
    name.includes("smtp") ||
    name.includes("webhook") ||
    name.includes("api_error") ||
    name === "exception"
  ) {
    return "technical";
  }
  if (name === "exception" || name.includes("failed")) return "error";
  return "product";
}
