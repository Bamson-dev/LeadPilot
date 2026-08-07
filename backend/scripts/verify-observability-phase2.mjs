/**
 * Phase 2 Observability verification (offline/static checks).
 * Run: node backend/scripts/verify-observability-phase2.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const failures = [];

function assert(cond, msg) {
  if (!cond) failures.push(msg);
}

function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

function exists(rel) {
  return fs.existsSync(path.join(root, rel));
}

// Schema
assert(exists("supabase/migrations/039_analytics_observability.sql"), "migration 039 missing");
const mig = read("supabase/migrations/039_analytics_observability.sql");
assert(mig.includes("analytics_events"), "analytics_events table missing");
assert(mig.includes("analytics_alerts"), "analytics_alerts table missing");
assert(mig.includes("analytics_tech_snapshots"), "tech snapshots missing");
assert(mig.includes("idempotency_key"), "idempotency key missing");
assert(mig.includes("enable row level security"), "RLS missing");

// Backend modules
[
  "backend/src/observability/event-taxonomy.ts",
  "backend/src/observability/privacy.ts",
  "backend/src/observability/track.ts",
  "backend/src/observability/alerts.ts",
  "backend/src/observability/public-events-router.ts",
  "backend/src/observability/admin-observability-router.ts",
].forEach((f) => assert(exists(f), `${f} missing`));

const server = read("backend/src/server.ts");
assert(server.includes("publicEventsRouter"), "public events router not mounted");
assert(server.includes("/admin/observability"), "admin observability not mounted");
assert(server.includes("EVENT_NAMES.EXCEPTION"), "exception tracking missing");

const lifecycle = read("backend/src/utils/search-job-lifecycle.ts");
assert(lifecycle.includes("trackEvent"), "search lifecycle not instrumented");
assert(lifecycle.includes("SEARCH_COMPLETED"), "search completed event missing");

// Privacy
const privacy = read("backend/src/observability/privacy.ts");
assert(privacy.includes("password"), "password scrubbing missing");
assert(privacy.includes("license"), "license scrubbing missing");
assert(privacy.includes("hashEmail"), "email hashing missing");

const publicEvents = read("backend/src/observability/public-events-router.ts");
assert(publicEvents.includes("status(202)"), "public ingest must be non-blocking 202");
assert(publicEvents.includes("ALLOWED_CLIENT_EVENTS"), "client allowlist missing");

// Frontend
assert(exists("frontend/lib/analytics.ts"), "client analytics missing");
assert(exists("frontend/components/analytics/analytics-page-tracker.tsx"), "page tracker missing");
const analytics = read("frontend/lib/analytics.ts");
assert(analytics.includes("sendBeacon") || analytics.includes("/public/events"), "client flush missing");
assert(analytics.includes("idempotencyKey"), "client idempotency missing");

const layout = read("frontend/app/layout.tsx");
assert(layout.includes("AnalyticsPageTracker"), "page tracker not in layout");

const adminApi = read("frontend/services/admin-api.ts");
assert(adminApi.includes("getObservabilityOverview"), "admin API overview missing");
assert(adminApi.includes("getObservabilityFunnels"), "admin API funnels missing");
assert(adminApi.includes("events.csv"), "csv export missing");

const workspace = read("frontend/components/admin/workspaces/analytics-workspace.tsx");
assert(workspace.includes("Funnels"), "funnels tab missing");
assert(workspace.includes("Infrastructure"), "infrastructure tab missing");
assert(workspace.includes("Alerts"), "alerts tab missing");

// Client funnel hooks
assert(read("frontend/app/(marketing)/page.tsx").includes("landing_viewed"), "landing track missing");
assert(read("frontend/app/freetrial/page.tsx").includes("paywall_viewed"), "paywall track missing");
assert(read("frontend/app/checkout/page.tsx").includes("checkout_started"), "checkout track missing");
assert(read("frontend/app/activate/page.tsx").includes("dashboard_entered"), "activate dashboard track missing");
assert(read("backend/src/api/auth-router.ts").includes("LICENSE_ACTIVATED"), "server license_activated missing");
assert(read("frontend/features/export/csv-export.ts").includes("csv_export"), "csv export track missing");
assert(read("backend/src/routes/mailboxes.ts").includes("MAILBOX_DISCONNECTED"), "mailbox disconnect track missing");
assert(exists("frontend/components/analytics/analytics-behaviour-tracker.tsx"), "behaviour tracker missing");
assert(exists("backend/src/middleware/observability-latency.ts"), "latency middleware missing");
assert(read("backend/src/server.ts").includes("observabilityLatency"), "latency middleware not mounted");
assert(exists("backend/src/observability/admin-observability-polish.ts"), "polish routes missing");
assert(exists("supabase/migrations/040_analytics_attribution_polish.sql"), "migration 040 missing");
assert(read("backend/src/utils/search-job-lifecycle.ts").includes("explicitOk"), "search success classifier missing");
assert(read("backend/src/observability/alerts.ts").includes("updateAlertStatus"), "alert ack/resolve missing");
assert(!read("backend/src/observability/alerts.ts").includes("EVENT_NAMES.API_ERROR"), "alert must not emit api_error");
assert(read("frontend/lib/analytics.ts").includes("fbclid"), "attribution fbclid missing");
assert(read("frontend/lib/analytics.ts").includes("checkout_abandoned") || read("frontend/lib/analytics.ts").includes("maybeTrackCheckoutAbandoned"), "checkout abandon missing");
assert(read("frontend/components/admin/workspaces/dashboard-workspace.tsx").includes("Executive dashboard"), "executive dashboard missing");
assert(read("frontend/components/admin/workspaces/analytics-workspace.tsx").includes("timeline"), "timeline tab missing");
assert(read("backend/src/routes/outreach-tracking.ts").includes("EMAIL_OPENED"), "email_opened track missing");
assert(read("backend/src/api/auth-router.ts").includes("LICENSE_ACTIVATION_FAILED"), "activation failure track missing");

// Server hooks (best-effort presence)
const hookedFiles = [
  "backend/src/api/trial-router.ts",
  "backend/src/services/payment-fulfillment.ts",
  "backend/src/api/webhook-router.ts",
  "backend/src/api/auth-router.ts",
];
for (const f of hookedFiles) {
  if (exists(f)) {
    assert(read(f).includes("trackEvent"), `${f} missing trackEvent`);
  }
}

if (failures.length) {
  console.error("FAIL");
  for (const f of failures) console.error(" -", f);
  process.exit(1);
}

console.log("PASS — Phase 2 observability static verification");
console.log("Checked: schema, routers, privacy, client tracker, admin analytics, funnel hooks");
