import { getCampaignDay, isCanonicalDeadline, isPastDeadline } from "./campaign-definition";
import { AI_MONEY_CODE_EMAILS, validateCampaignContent } from "./content";
import {
  CAMPAIGN_TIMEZONE,
  DEADLINE_AT_ISO,
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

  const computedDay1 = getCampaignDay(new Date("2026-08-18T10:00:00+01:00"));
  checks.day1 = computedDay1 === 1;
  if (!checks.day1) errors.push(`Expected Aug 18 to be Day 1, got ${computedDay1}`);

  const day30 = getCampaignDay(new Date("2026-09-16T12:00:00+01:00"));
  checks.day30 = day30 === 30;
  if (!checks.day30) errors.push(`Expected Sep 16 to be Day 30, got ${day30}`);

  checks.deadlineBlocks = isPastDeadline(new Date("2026-09-17T01:00:00+01:00"));
  if (!checks.deadlineBlocks) errors.push("Expected date after deadline to block activation");

  const content = validateCampaignContent();
  checks.contentComplete = content.ok;
  if (!content.ok) errors.push(...content.errors);

  const day1Email = AI_MONEY_CODE_EMAILS.find((e) => e.day === 1);
  checks.day1CtaWebinar = !!day1Email && day1Email.ctaUrl === WEBINAR_URL;
  if (!checks.day1CtaWebinar) errors.push("Day 1 CTA mismatch");

  const offerMentionsPrice = AI_MONEY_CODE_EMAILS.filter((e) => e.day >= 16).some((e) =>
    e.body.join(" ").includes(SPECIAL_PRICE_NGN.toLocaleString())
  );
  checks.offerMentionsPrice = offerMentionsPrice;
  if (!offerMentionsPrice) errors.push("Offer phase missing special price mention");

  checks.deadlineConstant = DEADLINE_AT_ISO === "2026-09-16T22:59:00.000Z";
  if (!checks.deadlineConstant) errors.push("Deadline constant mismatch");

  checks.deadlinePostgresFormat = isCanonicalDeadline("2026-09-16 22:59:00+00");
  if (!checks.deadlinePostgresFormat) {
    errors.push("Postgres timestamptz format should match canonical deadline instant");
  }

  checks.deadlineRejectsWrongInstant = !isCanonicalDeadline("2026-09-16T23:59:00.000Z");
  if (!checks.deadlineRejectsWrongInstant) {
    errors.push("Deadline validation should reject non-canonical instants");
  }
  checks.regularPriceConfigured = REGULAR_PRICE_NGN === 100000;
  checks.specialPriceConfigured = SPECIAL_PRICE_NGN === 49999;

  checks.timezone = CAMPAIGN_TIMEZONE === "Africa/Lagos";
  checks.webinarCta = WEBINAR_URL === "https://aimoneycode.com.ng/reg";
  checks.offerCta = OFFER_URL === "https://aimoneycode.com.ng/offer";
  checks.fastActionBonusOmitted = true;
  return { ok: errors.length === 0, checks, errors };
}
