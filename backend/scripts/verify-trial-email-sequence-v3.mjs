#!/usr/bin/env node
/**
 * Verifies trial email sequence v3 content, timing, links, migration mapping, and copy rules.
 */
import {
  CURRENT_TRIAL_SEQUENCE_VERSION,
  getMaxSequenceStep,
  getTrialEmailBody,
  getTrialEmailSubject,
  getTrialPostSearchEmailBody,
  getTrialStepHoursFromSignup,
  mapOldSequenceStepToV3,
  TRIAL_POST_SEARCH_EMAIL_SUBJECT,
  TRIAL_SEQUENCE_VERSION_V1,
  TRIAL_SEQUENCE_VERSION_V2,
  TRIAL_SEQUENCE_VERSION_V3,
} from "../dist/services/trial-email-content.js";
import {
  V3_TRIAL_EMAIL_SUBJECTS,
  V3_TRIAL_STEP_HOURS_FROM_SIGNUP,
} from "../dist/services/trial-email-content-v3.js";

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

const EXPECTED_V3_OFFSETS = {
  1: 0,
  2: 5,
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
  16: 528,
  17: 576,
  18: 624,
  19: 672,
  20: 720,
  21: 768,
  22: 816,
  23: 864,
  24: 912,
  25: 960,
  26: 1008,
  27: 1032,
  28: 1056,
  29: 1080,
  30: 1085,
};

const EXPECTED_CTA = {
  1: "https://leadthur.com/dashboard",
  2: "https://leadthur.com/dashboard",
  3: "https://leadthur.com/dashboard",
  4: "https://pdigitalhq.com/lp/",
  5: "https://leadthur.com/freetrial",
  6: "https://leadthur.com/freetrial",
  7: "https://paystack.shop/pay/Leadthur",
  8: "https://leadthur.com/",
  9: "https://paystack.shop/pay/Leadthur",
  10: "https://pdigitalhq.com/nl",
  11: "https://leadthur.com/freetrial",
  12: "https://pdigitalhq.com/lp/",
  13: "https://leadthur.com/",
  14: "https://paystack.shop/pay/Leadthur",
  15: "https://pdigitalhq.com/nl",
  16: "https://paystack.shop/pay/Leadthur",
  17: "https://leadthur.com/freetrial",
  18: "https://leadthur.com/",
  19: "https://paystack.shop/pay/Leadthur",
  20: "https://leadthur.com/freetrial",
  21: "https://leadthur.com/",
  22: "https://paystack.shop/pay/Leadthur",
  23: "https://pdigitalhq.com/lp/",
  24: "https://paystack.shop/pay/Leadthur",
  25: "https://leadthur.com/",
  26: "https://pdigitalhq.com/lp/",
  27: "https://leadthur.com/",
  28: "https://leadthur.com/",
  29: "https://paystack.shop/pay/Leadthur",
  30: "https://leadthur.com/",
};

const LIVE_URLS = [
  "https://leadthur.com/",
  "https://leadthur.com/dashboard",
  "https://leadthur.com/freetrial",
  "https://pdigitalhq.com/nl",
  "https://pdigitalhq.com/lp/",
  "https://paystack.shop/pay/Leadthur",
];

const CHECKOUT_URL = "https://paystack.shop/pay/Leadthur";
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
    if (new RegExp(`\\b${word}\\b`, "i").test(plain)) {
      issues.push(`${label}: banned word "${word}"`);
    }
  }
  if (/[—–]/.test(text)) issues.push(`${label}: contains em dash`);

  const unlimitedMatches = [...plain.matchAll(/\bunlimited\b/gi)];
  for (const match of unlimitedMatches) {
    const idx = match.index ?? 0;
    const window = plain.slice(Math.max(0, idx - 40), idx + 60);
    if (!/csv export/i.test(window)) {
      issues.push(`${label}: "unlimited" used outside CSV export context (${window.trim()})`);
    }
  }
}

function extractHrefs(html) {
  return [...html.matchAll(/href="([^"]+)"/g)].map((m) => m[1]);
}

async function checkLiveUrl(url) {
  try {
    const res = await fetch(url, { method: "GET", redirect: "follow" });
    return { ok: res.status >= 200 && res.status < 400, status: res.status };
  } catch (err) {
    return { ok: false, status: 0, error: err instanceof Error ? err.message : String(err) };
  }
}

if (CURRENT_TRIAL_SEQUENCE_VERSION !== TRIAL_SEQUENCE_VERSION_V3) {
  issues.push(`CURRENT_TRIAL_SEQUENCE_VERSION should be 3, got ${CURRENT_TRIAL_SEQUENCE_VERSION}`);
}

for (const [step, hours] of Object.entries(EXPECTED_V3_OFFSETS)) {
  const got = V3_TRIAL_STEP_HOURS_FROM_SIGNUP[Number(step)];
  if (got !== hours) {
    issues.push(`v3 step ${step}: expected ${hours}h offset, got ${got}`);
  }
}

if (V3_TRIAL_STEP_HOURS_FROM_SIGNUP[2] !== 5) {
  issues.push("v3 email 2 must be 5 hours after email 1");
}
if (V3_TRIAL_STEP_HOURS_FROM_SIGNUP[30] - V3_TRIAL_STEP_HOURS_FROM_SIGNUP[29] !== 5) {
  issues.push("v3 email 30 must be 5 hours after email 29 on day 45");
}

for (let step = 1; step <= 30; step++) {
  const subject = getTrialEmailSubject(TRIAL_SEQUENCE_VERSION_V3, step);
  const body = getTrialEmailBody(TRIAL_SEQUENCE_VERSION_V3, step);
  auditText(`v3 step ${step} subject`, subject);
  auditText(`v3 step ${step} body`, body);

  if (subject !== V3_TRIAL_EMAIL_SUBJECTS[step]) {
    issues.push(`v3 step ${step}: subject mismatch`);
  }
  if (!body.includes("Get Lifetime Access for $25")) {
    issues.push(`v3 step ${step}: missing checkout footer button`);
  }
  if (!body.includes(CHECKOUT_URL)) {
    issues.push(`v3 step ${step}: missing Paystack checkout URL`);
  }

  const hrefs = extractHrefs(body);
  if (hrefs.length === 0) issues.push(`v3 step ${step}: no links in body`);
  if (!hrefs.includes(EXPECTED_CTA[step])) {
    issues.push(`v3 step ${step}: missing expected CTA ${EXPECTED_CTA[step]}`);
  }
}

const postBody = getTrialPostSearchEmailBody("dentists", "London UK");
auditText("post-search body", postBody);
auditText("post-search subject", TRIAL_POST_SEARCH_EMAIL_SUBJECT);
if (TRIAL_POST_SEARCH_EMAIL_SUBJECT !== "You Searched. You Haven't Sent Anything Yet.") {
  issues.push("post-search subject mismatch");
}
if (!postBody.includes("dentists")) issues.push("post-search: query not interpolated");
if (!postBody.includes("London UK")) issues.push("post-search: location not interpolated");
if (!postBody.includes("https://leadthur.com/dashboard")) {
  issues.push("post-search: missing dashboard link");
}
if (!postBody.includes(CHECKOUT_URL)) {
  issues.push("post-search: missing Paystack checkout URL");
}

if (getMaxSequenceStep(TRIAL_SEQUENCE_VERSION_V1) !== 15) {
  issues.push("v1 max step should remain 15");
}
if (getMaxSequenceStep(TRIAL_SEQUENCE_VERSION_V2) !== 20) {
  issues.push("v2 max step should remain 20");
}
if (getMaxSequenceStep(TRIAL_SEQUENCE_VERSION_V3) !== 30) {
  issues.push("v3 max step should be 30");
}

const mappingCases = [
  { old: 1, max: 15, expectStore: 1, expectNext: 2 },
  { old: 8, max: 15, expectStore: 15, expectNext: 16 },
  { old: 15, max: 15, expectStore: 30, expectNext: null },
  { old: 0, max: 15, expectStore: 0, expectNext: 1 },
  { old: 10, max: 20, expectStore: 14, expectNext: 15 },
  { old: 20, max: 20, expectStore: 30, expectNext: null },
];

for (const c of mappingCases) {
  const stored = mapOldSequenceStepToV3(c.old, c.max);
  if (stored !== c.expectStore) {
    issues.push(
      `migration map(${c.old}/${c.max}): expected store ${c.expectStore}, got ${stored}`
    );
  }
  const next = stored >= 30 ? null : stored + 1;
  if (next !== c.expectNext) {
    issues.push(
      `migration map(${c.old}/${c.max}): expected next ${c.expectNext}, got ${next}`
    );
  }
}

const signup = new Date("2026-07-11T10:00:00Z");
function dueAt(step) {
  const hours = getTrialStepHoursFromSignup(TRIAL_SEQUENCE_VERSION_V3, step);
  return new Date(signup.getTime() + hours * 60 * 60 * 1000).toISOString();
}

const firstFive = [1, 2, 3, 4, 5].map((s) => ({ step: s, hours: EXPECTED_V3_OFFSETS[s], dueAt: dueAt(s) }));
const lateOffsets = [26, 27, 28, 29, 30].map((s) => ({
  step: s,
  hours: EXPECTED_V3_OFFSETS[s],
  dueAt: dueAt(s),
}));

const linkResults = [];
for (const url of LIVE_URLS) {
  const result = await checkLiveUrl(url);
  linkResults.push({ url, ...result });
  if (!result.ok) issues.push(`live URL failed: ${url} (status ${result.status})`);
}

console.log(
  JSON.stringify(
    {
      ok: issues.length === 0,
      issues,
      currentVersion: CURRENT_TRIAL_SEQUENCE_VERSION,
      v3Steps: Object.keys(V3_TRIAL_EMAIL_SUBJECTS).length,
      day0SpacingHours: {
        email1: V3_TRIAL_STEP_HOURS_FROM_SIGNUP[1],
        email2: V3_TRIAL_STEP_HOURS_FROM_SIGNUP[2],
        gap: V3_TRIAL_STEP_HOURS_FROM_SIGNUP[2] - V3_TRIAL_STEP_HOURS_FROM_SIGNUP[1],
      },
      day45SpacingHours: {
        email29: V3_TRIAL_STEP_HOURS_FROM_SIGNUP[29],
        email30: V3_TRIAL_STEP_HOURS_FROM_SIGNUP[30],
        gap: V3_TRIAL_STEP_HOURS_FROM_SIGNUP[30] - V3_TRIAL_STEP_HOURS_FROM_SIGNUP[29],
      },
      firstFiveSchedule: firstFive,
      lateSchedule: lateOffsets,
      postSearchSubject: TRIAL_POST_SEARCH_EMAIL_SUBJECT,
      linkChecks: linkResults,
      migrationExamples: mappingCases.map((c) => ({
        ...c,
        stored: mapOldSequenceStepToV3(c.old, c.max),
      })),
      conversionStop:
        "markTrialSignupConverted sets converted=true and sequence_paused=true; scheduler skips converted users",
      unsubscribeStop: "pauseTrialSequence sets sequence_paused=true; scheduler skips paused users",
    },
    null,
    2
  )
);

process.exit(issues.length === 0 ? 0 : 1);
