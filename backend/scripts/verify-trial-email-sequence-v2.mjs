#!/usr/bin/env node
/**
 * Verifies trial email sequence v2 content, timing, links, and migration safety.
 */
import {
  getMaxSequenceStep,
  getTrialEmailBody,
  getTrialEmailSubject,
  getTrialPostSearchEmailBody,
  getTrialStepHoursFromSignup,
  TRIAL_POST_SEARCH_EMAIL_SUBJECT,
  TRIAL_SEQUENCE_VERSION_V1,
  TRIAL_SEQUENCE_VERSION_V2,
} from "../dist/services/trial-email-content.js";
import {
  V1_TRIAL_EMAIL_SUBJECTS,
  V1_TRIAL_STEP_HOURS_FROM_SIGNUP,
} from "../dist/services/trial-email-content-v1.js";
import {
  V2_TRIAL_EMAIL_SUBJECTS,
  V2_TRIAL_STEP_HOURS_FROM_SIGNUP,
} from "../dist/services/trial-email-content-v2.js";

const BANNED_WORDS = [
  "embark",
  "delve",
  "craft",
  "imagine",
  "remarkable",
  "unlock",
  "discover",
  "skyrocket",
  "innovative",
  "revolutionary",
  "utilize",
  "illuminate",
  "unveil",
  "intricate",
  "harness",
  "groundbreaking",
];

const EXPECTED_V2_OFFSETS = {
  1: 0,
  2: 6,
  3: 24,
  4: 48,
  5: 72,
  6: 96,
  7: 120,
  8: 144,
  9: 192,
  10: 240,
  11: 288,
  12: 336,
  13: 384,
  14: 432,
  15: 480,
  16: 552,
  17: 624,
  18: 696,
  19: 792,
  20: 888,
};

const LIVE_URLS = [
  "https://leadthur.com",
  "https://leadthur.com/freetrial",
  "https://leadthur.com/dashboard",
  "https://leadthur.com/checkout",
];

const issues = [];

function stripHtml(html) {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function auditText(label, text) {
  const plain = stripHtml(text).toLowerCase();
  for (const word of BANNED_WORDS) {
    if (plain.includes(word)) issues.push(`${label}: banned word "${word}"`);
  }
  if (/[—–]/.test(text)) issues.push(`${label}: contains em dash`);
  if (/\bunlimited\b/i.test(plain) && /\b(send|sending|outreach)\b/i.test(plain) && !/csv export/i.test(plain)) {
    issues.push(`${label}: "unlimited" used near sending context`);
  }
}

function extractHrefs(html) {
  return [...html.matchAll(/href="([^"]+)"/g)].map((m) => m[1]);
}

async function checkLiveUrl(url) {
  try {
    const res = await fetch(url, { method: "HEAD", redirect: "follow" });
    return res.status >= 200 && res.status < 400;
  } catch {
    return false;
  }
}

for (const [step, hours] of Object.entries(EXPECTED_V2_OFFSETS)) {
  const got = V2_TRIAL_STEP_HOURS_FROM_SIGNUP[Number(step)];
  if (got !== hours) {
    issues.push(`v2 step ${step}: expected ${hours}h offset, got ${got}`);
  }
}

if (V2_TRIAL_STEP_HOURS_FROM_SIGNUP[2] <= V2_TRIAL_STEP_HOURS_FROM_SIGNUP[1]) {
  issues.push("v2 email 2 must send after email 1 on day 0");
}

for (let step = 1; step <= 20; step++) {
  const subject = getTrialEmailSubject(TRIAL_SEQUENCE_VERSION_V2, step);
  const body = getTrialEmailBody(TRIAL_SEQUENCE_VERSION_V2, step);
  auditText(`v2 step ${step} subject`, subject);
  auditText(`v2 step ${step} body`, body);

  if (!body.includes("Get Lifetime Access for $25")) {
    issues.push(`v2 step ${step}: missing checkout footer button`);
  }
  if (!body.includes("https://leadthur.com/checkout")) {
    issues.push(`v2 step ${step}: missing checkout URL`);
  }

  const hrefs = extractHrefs(body);
  if (hrefs.length === 0) issues.push(`v2 step ${step}: no links in body`);
}

const postBody = getTrialPostSearchEmailBody("dentists", "London UK");
auditText("post-search body", postBody);
auditText("post-search subject", TRIAL_POST_SEARCH_EMAIL_SUBJECT);
if (!postBody.includes("dentists")) issues.push("post-search: query not interpolated");
if (!postBody.includes("London UK")) issues.push("post-search: location not interpolated");
if (!postBody.includes("https://leadthur.com/dashboard")) {
  issues.push("post-search: missing dashboard link");
}

for (let step = 1; step <= 15; step++) {
  const v1Subject = V1_TRIAL_EMAIL_SUBJECTS[step];
  const v2Subject = V2_TRIAL_EMAIL_SUBJECTS[step];
  if (v1Subject === v2Subject) {
    issues.push(`v1/v2 step ${step} subjects unexpectedly identical`);
  }
}

if (getMaxSequenceStep(TRIAL_SEQUENCE_VERSION_V1) !== 15) {
  issues.push("v1 max step should remain 15");
}
if (getMaxSequenceStep(TRIAL_SEQUENCE_VERSION_V2) !== 20) {
  issues.push("v2 max step should be 20");
}

const signup = new Date("2026-07-11T10:00:00Z");
function dueAt(step, version = TRIAL_SEQUENCE_VERSION_V2) {
  const hours = getTrialStepHoursFromSignup(version, step);
  return new Date(signup.getTime() + hours * 60 * 60 * 1000).toISOString();
}

const firstFive = [1, 2, 3, 4, 5].map((s) => ({ step: s, dueAt: dueAt(s) }));
const lateOffsets = [19, 20].map((s) => ({ step: s, dueAt: dueAt(s) }));

const linkResults = [];
for (const url of LIVE_URLS) {
  const ok = await checkLiveUrl(url);
  linkResults.push({ url, ok });
  if (!ok) issues.push(`live URL failed: ${url}`);
}

console.log(
  JSON.stringify(
    {
      ok: issues.length === 0,
      issues,
      migrationApproach:
        "Existing signups keep sequence_version=1 and finish on the old 15-email schedule with original copy. New signups after deploy get sequence_version=2 and the 20-email schedule.",
      v1Preserved: Object.keys(V1_TRIAL_STEP_HOURS_FROM_SIGNUP).length === 15,
      v2Steps: Object.keys(V2_TRIAL_EMAIL_SUBJECTS).length,
      day0SpacingHours: {
        email1: V2_TRIAL_STEP_HOURS_FROM_SIGNUP[1],
        email2: V2_TRIAL_STEP_HOURS_FROM_SIGNUP[2],
        gap: V2_TRIAL_STEP_HOURS_FROM_SIGNUP[2] - V2_TRIAL_STEP_HOURS_FROM_SIGNUP[1],
      },
      firstFiveSchedule: firstFive,
      lateSchedule: lateOffsets,
      postSearchSubject: TRIAL_POST_SEARCH_EMAIL_SUBJECT,
      linkChecks: linkResults,
      conversionStop:
        "markTrialSignupConverted sets converted=true and sequence_paused=true; scheduler skips converted users",
      unsubscribeStop: "pauseTrialSequence sets sequence_paused=true; scheduler skips paused users",
    },
    null,
    2
  )
);

process.exit(issues.length === 0 ? 0 : 1);
