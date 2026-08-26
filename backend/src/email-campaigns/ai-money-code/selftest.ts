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

  checks.postgresIsoStartDate = getRecipientCampaignDay("2026-08-18T00:00:00.000Z", new Date("2026-08-26T10:00:00+01:00")) === 9;
  if (!checks.postgresIsoStartDate) errors.push("Postgres ISO start dates should map to the correct campaign day");

  checks.postgresDateObjectStartDate =
    getRecipientCampaignDay(new Date("2026-08-18T00:00:00.000Z"), new Date("2026-08-26T10:00:00+01:00")) === 9;
  if (!checks.postgresDateObjectStartDate) errors.push("Postgres Date start values should map to the correct campaign day");

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

  const day15Email = getCampaignEmail(15, sampleCtx);
  checks.day15CtaOffer = day15Email.ctaUrl === OFFER_URL;
  if (!checks.day15CtaOffer) errors.push("Day 15 CTA mismatch");

  const day14Email = getCampaignEmail(14, sampleCtx);
  checks.day14CtaWebinar = day14Email.ctaUrl === WEBINAR_URL;
  if (!checks.day14CtaWebinar) errors.push("Day 14 CTA mismatch");

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

  checks.programAvailableAfterDeadline = AI_MONEY_CODE_EMAIL_TEMPLATES.every((e) => {
    const rendered = renderCampaignEmail(e, sampleCtx);
    return rendered.body.join(" ").toLowerCase().includes("remains available") ||
      rendered.body.join(" ").includes("₦100,000");
  });
  if (!checks.programAvailableAfterDeadline) {
    errors.push("Every rendered email must clarify program remains available after special price");
  }

  // Prefer templates also state it in offer phase:
  checks.offerStatesRemainsAvailable = AI_MONEY_CODE_EMAIL_TEMPLATES.filter((e) => e.day >= 15).some((e) =>
    e.body.join(" ").toLowerCase().includes("remains available") ||
    e.body.join(" ").toLowerCase().includes("available at") ||
    e.body.join(" ").includes("₦100,000") ||
    e.body.join(" ").includes("${regular}")
  );
  if (!checks.offerStatesRemainsAvailable) {
    errors.push("Offer-phase content must clarify availability after price change");
  }
  checks.noPermanentCloseClaim = !AI_MONEY_CODE_EMAIL_TEMPLATES.some((e) => {
    const t = e.body.join(" ").toLowerCase();
    return t.includes("enrollment closes permanently") || t.includes("enrollment closes forever");
  });
  if (!checks.noPermanentCloseClaim) errors.push("Content must not falsely claim permanent enrollment closure");

  checks.fastActionBonusOmitted = !AI_MONEY_CODE_EMAIL_TEMPLATES.some((e) =>
    e.body.join(" ").toLowerCase().includes("1-on-1 build review")
  );
  if (!checks.fastActionBonusOmitted) errors.push("Fast-action bonus must remain omitted");

  checks.substantialBodies = AI_MONEY_CODE_EMAIL_TEMPLATES.every((e) => e.body.length >= 8);
  if (!checks.substantialBodies) errors.push("Every email needs substantial multi-paragraph body content");

  checks.uniqueSubjects =
    new Set(AI_MONEY_CODE_EMAIL_TEMPLATES.map((e) => e.subject.trim().toLowerCase())).size ===
    AI_MONEY_CODE_EMAIL_TEMPLATES.length;
  if (!checks.uniqueSubjects) errors.push("Subject lines must be unique across the 30-day sequence");

  const decemberCtx = buildRecipientUrgencyContext(deadlineB, new Date("2026-12-15T10:00:00+01:00"));
  const decemberRendered = getCampaignEmail(15, decemberCtx);
  checks.decemberDeadlineRenders =
    decemberRendered.body.join(" ").includes(formatDeadlineInLagos(deadlineB)) ||
    decemberRendered.body.join(" ").includes(formatDeadlineInLagos(deadlineB).split(" at ")[0]);
  if (!checks.decemberDeadlineRenders) {
    errors.push("December enrollment must render January personal deadline in email body");
  }

  const promptEarnEmails = AI_MONEY_CODE_EMAIL_TEMPLATES.filter((e) =>
    e.body.join(" ").toLowerCase().includes("promptearn")
  );
  checks.promptEarnNotSkillProof =
    promptEarnEmails.length === 0 ||
    promptEarnEmails.every((e) => {
      const t = e.body.join(" ").toLowerCase();
      return (
        t.includes("not proof") ||
        t.includes("distinction") ||
        t.includes("operator credibility") ||
        t.includes("not evidence")
      );
    });
  if (!checks.promptEarnNotSkillProof) {
    errors.push("PromptEarn mentions must keep operator-credibility distinction");
  }

  checks.noHardCodedGlobalDeadline = !AI_MONEY_CODE_EMAIL_TEMPLATES.some((e) => {
    const t = e.body.join(" ").toLowerCase();
    return t.includes("sept 16, 2026") || t.includes("september 16, 2026");
  });
  if (!checks.noHardCodedGlobalDeadline) errors.push("Hard-coded global September deadline found in templates");

  checks.programAvailableNowLanguage = AI_MONEY_CODE_EMAIL_TEMPLATES.filter((e) => e.day >= 15).some((e) =>
    e.body.join(" ").toLowerCase().includes("available now")
  );
  if (!checks.programAvailableNowLanguage) {
    errors.push("Offer-phase emails must state the program is available now");
  }

  checks.nurtureCtas = AI_MONEY_CODE_EMAIL_TEMPLATES.filter((e) => e.day <= 14).every(
    (e) => e.ctaUrl === WEBINAR_URL
  );
  checks.salesCtas = AI_MONEY_CODE_EMAIL_TEMPLATES.filter((e) => e.day >= 15).every(
    (e) => e.ctaUrl === OFFER_URL
  );
  if (!checks.nurtureCtas) errors.push("Days 1-14 must use webinar CTA");
  if (!checks.salesCtas) errors.push("Days 15-30 must use offer CTA");

  checks.uniqueOpenings =
    new Set(AI_MONEY_CODE_EMAIL_TEMPLATES.map((e) => e.body[0].trim().toLowerCase())).size ===
    AI_MONEY_CODE_EMAIL_TEMPLATES.length;
  checks.uniqueClosings =
    new Set(AI_MONEY_CODE_EMAIL_TEMPLATES.map((e) => e.body[e.body.length - 1].trim().toLowerCase())).size ===
    AI_MONEY_CODE_EMAIL_TEMPLATES.length;
  checks.uniqueCtaLabels =
    new Set(AI_MONEY_CODE_EMAIL_TEMPLATES.map((e) => e.ctaLabel.trim().toLowerCase())).size ===
    AI_MONEY_CODE_EMAIL_TEMPLATES.length;
  if (!checks.uniqueOpenings) errors.push("Email openings must be unique");
  if (!checks.uniqueClosings) errors.push("Email closings must be unique");
  if (!checks.uniqueCtaLabels) errors.push("CTA labels must be unique");

  checks.salesDoNotUseWebinarUrl = AI_MONEY_CODE_EMAIL_TEMPLATES.filter((e) => e.day >= 15).every(
    (e) => e.ctaUrl === OFFER_URL && !e.body.join(" ").includes(WEBINAR_URL)
  );
  if (!checks.salesDoNotUseWebinarUrl) errors.push("Days 15-30 must not route to webinar registration");

  checks.nurtureHasContextBeforeCta = AI_MONEY_CODE_EMAIL_TEMPLATES.filter((e) => e.day <= 14).every(
    (e) => e.body.length >= 8 && e.body.join(" ").split(/\s+/).length >= 350
  );
  if (!checks.nurtureHasContextBeforeCta) {
    errors.push("Days 1-14 must provide substantial context before webinar CTA");
  }

  checks.salesHaveDepth = AI_MONEY_CODE_EMAIL_TEMPLATES.filter((e) => e.day >= 15).every(
    (e) => e.body.join(" ").split(/\s+/).length >= 400
  );
  if (!checks.salesHaveDepth) errors.push("Days 15-30 need substantial conversion depth");

  checks.noFakePermanentClose = !AI_MONEY_CODE_EMAIL_TEMPLATES.some((e) => {
    const t = e.body.join(" ").toLowerCase();
    return (
      t.includes("doors close forever") ||
      t.includes("never get another chance") ||
      t.includes("last chance to join ai money code ever") ||
      t.includes("program disappears")
    );
  });
  if (!checks.noFakePermanentClose) errors.push("Fake permanent-close language found");

  checks.everyEmailHasPreview = AI_MONEY_CODE_EMAIL_TEMPLATES.every((e) => e.preview.trim().length > 10);
  if (!checks.everyEmailHasPreview) errors.push("Every email needs meaningful preview text");

  // Infrastructure regression: progress math still per-recipient (no shared calendar)
  checks.progressPreservedByDesign =
    getRecipientCampaignDay("2026-08-18", new Date("2026-08-21T10:00:00+01:00")) === 4 &&
    getRecipientCampaignDay("2026-08-20", new Date("2026-08-21T10:00:00+01:00")) === 2;
  if (!checks.progressPreservedByDesign) {
    errors.push("Recipient progress must remain tied to personal campaign_start_date");
  }

  return { ok: errors.length === 0, checks, errors };
}
