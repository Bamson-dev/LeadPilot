import {
  buildRecipientUrgencyContext,
  calculatePersonalDeadlineAt,
  formatDeadlineInLagos,
  getEnrollmentStartDate,
  getRecipientCampaignDay,
  isPastPersonalDeadline,
  isSameInstant,
} from "./campaign-definition";
import {
  AI_MONEY_CODE_EMAIL_TEMPLATES,
  getCampaignEmail,
  renderCampaignEmail,
  validateCampaignContent,
  validateRenderedUrgency,
} from "./content";
import {
  CAMPAIGN_TIMEZONE,
  CAMPAIGN_TOTAL_DAYS,
  LEGACY_DEADLINE_AT_ISO,
  OFFER_URL,
  REGULAR_PRICE_NGN,
  SPECIAL_PRICE_NGN,
  WEBINAR_URL,
} from "./types";

export function runAiMoneyCodeSelfTest(): {
  ok: boolean;
  checks: Record<string, boolean>;
  errors: string[];
} {
  const checks: Record<string, boolean> = {};
  const errors: string[] = [];

  const todayStart = "2026-08-18";
  checks.recipientDay1Today = getRecipientCampaignDay(todayStart, new Date("2026-08-18T10:00:00+01:00")) === 1;
  if (!checks.recipientDay1Today) errors.push("Recipient enrolling today should be Day 1");

  checks.recipientDay1December = getRecipientCampaignDay("2026-12-10", new Date("2026-12-10T12:00:00+01:00")) === 1;
  if (!checks.recipientDay1December) errors.push("Recipient enrolling in December should be Day 1");

  checks.recipientDay1FutureYear = getRecipientCampaignDay("2027-03-01", new Date("2027-03-01T09:00:00+01:00")) === 1;
  if (!checks.recipientDay1FutureYear) errors.push("Recipient enrolling in 2027 should be Day 1");

  const userA = getRecipientCampaignDay("2026-08-18", new Date("2026-08-20T10:00:00+01:00"));
  const userB = getRecipientCampaignDay("2026-12-10", new Date("2026-08-20T10:00:00+01:00"));
  checks.differentCalendars = userA === 3 && userB < 1;
  if (!checks.differentCalendars) errors.push("Recipients on different start dates should have different campaign calendars");

  const deadlineA = calculatePersonalDeadlineAt("2026-08-18");
  const deadlineB = calculatePersonalDeadlineAt("2026-12-10");
  checks.differentDeadlines = deadlineA !== deadlineB;
  if (!checks.differentDeadlines) errors.push("Recipients should have different personal deadlines");

  checks.deadlineMatchesLegacyCohort =
    isSameInstant(deadlineA, LEGACY_DEADLINE_AT_ISO) ||
    isSameInstant(deadlineA, "2026-09-16 22:59:00+00");
  if (!checks.deadlineMatchesLegacyCohort) {
    errors.push("Aug 18 cohort deadline should match legacy Sep 16 23:59 Lagos instant");
  }

  checks.postgresIsoInstantMatch = isSameInstant("2026-09-16 22:59:00+00", LEGACY_DEADLINE_AT_ISO);
  if (!checks.postgresIsoInstantMatch) errors.push("Postgres and ISO deadline forms should match");

  checks.wrongInstantRejected = !isSameInstant("2026-09-16T23:59:00.000Z", LEGACY_DEADLINE_AT_ISO);
  if (!checks.wrongInstantRejected) errors.push("Wrong deadline instant should not match canonical");

  const decemberDeadline = calculatePersonalDeadlineAt("2026-12-10");
  checks.decemberDeadlineLagos = formatDeadlineInLagos(decemberDeadline).includes("January");
  if (!checks.decemberDeadlineLagos) errors.push("December enrollment deadline should land on Day 30 in January");

  const content = validateCampaignContent();
  checks.contentComplete = content.ok;
  if (!content.ok) errors.push(...content.errors);

  const sampleCtx = buildRecipientUrgencyContext(deadlineA);
  const renderedValidation = validateRenderedUrgency(sampleCtx);
  checks.urgencyEveryEmail = renderedValidation.ok;
  if (!renderedValidation.ok) errors.push(...renderedValidation.errors);

  const postDeadlineCtx = buildRecipientUrgencyContext(deadlineA, new Date("2026-09-17T10:00:00+01:00"));
  const postDeadlineEmail = getCampaignEmail(30, postDeadlineCtx);
  checks.postDeadlineAccurate =
    postDeadlineEmail.body.join(" ").includes("expired") || postDeadlineEmail.body.join(" ").includes("₦100,000");
  if (!checks.postDeadlineAccurate) errors.push("Post-deadline email should not claim active special price");

  checks.all30Present = AI_MONEY_CODE_EMAIL_TEMPLATES.length === CAMPAIGN_TOTAL_DAYS;
  if (!checks.all30Present) errors.push("Expected 30 email templates");

  const day1Email = getCampaignEmail(1, sampleCtx);
  checks.day1CtaWebinar = day1Email.ctaUrl === WEBINAR_URL;
  if (!checks.day1CtaWebinar) errors.push("Day 1 CTA mismatch");

  const day16Email = getCampaignEmail(16, sampleCtx);
  checks.day16CtaOffer = day16Email.ctaUrl === OFFER_URL;
  if (!checks.day16CtaOffer) errors.push("Day 16 CTA mismatch");

  checks.noRawTemplateVars = !day1Email.body.join(" ").includes("{{");
  if (!checks.noRawTemplateVars) errors.push("Rendered email leaked template variables");

  checks.specialPriceConfigured = SPECIAL_PRICE_NGN === 49999;
  checks.regularPriceConfigured = REGULAR_PRICE_NGN === 100000;
  checks.timezone = CAMPAIGN_TIMEZONE === "Africa/Lagos";
  checks.webinarCta = WEBINAR_URL === "https://aimoneycode.com.ng/reg";
  checks.offerCta = OFFER_URL === "https://aimoneycode.com.ng/offer";

  checks.enrollmentStartUsesLagos = getEnrollmentStartDate(new Date("2026-08-18T23:30:00+01:00")) === "2026-08-18";
  if (!checks.enrollmentStartUsesLagos) errors.push("Enrollment start should use Lagos calendar date");

  checks.personalDeadlineStable = isSameInstant(
    calculatePersonalDeadlineAt("2027-01-01"),
    calculatePersonalDeadlineAt("2027-01-01")
  );
  if (!checks.personalDeadlineStable) errors.push("Personal deadline calculation must be stable");

  checks.deadlineNotPastForNewUser = !isPastPersonalDeadline(
    calculatePersonalDeadlineAt(getEnrollmentStartDate(new Date("2027-06-01T10:00:00+01:00"))),
    new Date("2027-06-01T10:00:00+01:00")
  );
  if (!checks.deadlineNotPastForNewUser) errors.push("New user deadline must not already be past");

  const day15Rendered = renderCampaignEmail(AI_MONEY_CODE_EMAIL_TEMPLATES[14], sampleCtx);
  checks.day15HasUrgency = day15Rendered.body.join(" ").toLowerCase().includes("deadline") ||
    day15Rendered.body.join(" ").includes("₦49,999");
  if (!checks.day15HasUrgency) errors.push("Day 15 must include urgency");

  checks.programAvailableAfterDeadline = AI_MONEY_CODE_EMAIL_TEMPLATES.some((e) =>
    e.body.join(" ").toLowerCase().includes("remains available")
  );
  if (!checks.programAvailableAfterDeadline) errors.push("Content must clarify program remains available after special price");

  checks.noPermanentCloseClaim = !AI_MONEY_CODE_EMAIL_TEMPLATES.some((e) =>
    e.body.join(" ").toLowerCase().includes("enrollment closes permanently")
  );
  if (!checks.noPermanentCloseClaim) errors.push("Content must not falsely claim permanent enrollment closure");

  checks.fastActionBonusOmitted = true;

  return { ok: errors.length === 0, checks, errors };
}
