import {
  canPublishScheduledJob,
  computeNextPublicationAfterPublish,
  computeNextPublicationAt,
  isPublicationIntervalElapsed,
} from "./publish-schedule";

function assert(name: string, ok: boolean) {
  if (!ok) throw new Error(`Assertion failed: ${name}`);
}

const baseSettings = {
  publishing_interval_hours: 3,
  last_publication_at: null as string | null,
};

// First publication allowed immediately
assert("first publish due", isPublicationIntervalElapsed(baseSettings));

// After publish at 10:00, next slot is 13:00
const at10 = new Date("2026-08-11T10:00:00.000Z");
const settingsAfterFirst = {
  ...baseSettings,
  last_publication_at: at10.toISOString(),
};
const next = computeNextPublicationAt(settingsAfterFirst, at10.getTime() + 30 * 60 * 1000);
assert(
  "restart at 10:30 waits until 13:00",
  next.toISOString() === "2026-08-11T13:00:00.000Z"
);

assert(
  "not due at 10:30",
  !isPublicationIntervalElapsed(settingsAfterFirst, at10.getTime() + 30 * 60 * 1000)
);

assert(
  "due at 13:00",
  isPublicationIntervalElapsed(settingsAfterFirst, at10.getTime() + 3 * 60 * 60 * 1000)
);

const afterPublish = computeNextPublicationAfterPublish(baseSettings, at10.getTime());
assert(
  "after publish next is +3h",
  afterPublish.toISOString() === "2026-08-11T13:00:00.000Z"
);

assert(
  "scheduled job blocked before interval",
  !canPublishScheduledJob(
    settingsAfterFirst,
    "2026-08-11T10:05:00.000Z",
    at10.getTime() + 5 * 60 * 1000
  )
);

assert(
  "scheduled job allowed after interval",
  canPublishScheduledJob(
    settingsAfterFirst,
    "2026-08-11T13:00:00.000Z",
    at10.getTime() + 3 * 60 * 60 * 1000
  )
);

console.log("publish-schedule selftest PASS");
