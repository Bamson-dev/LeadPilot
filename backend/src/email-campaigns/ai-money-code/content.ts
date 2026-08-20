import {
  CAMPAIGN_TOTAL_DAYS,
  OFFER_URL,
  WEBINAR_URL,
  type CampaignEmail,
  type CampaignEmailTemplate,
  type RecipientUrgencyContext,
} from "./types";
import { getPhaseForDay } from "./campaign-definition";
import { AI_MONEY_CODE_EMAIL_TEMPLATES } from "./content-templates";

export { AI_MONEY_CODE_EMAIL_TEMPLATES };
export const AI_MONEY_CODE_EMAILS = AI_MONEY_CODE_EMAIL_TEMPLATES;

const BANNED_PHRASES = [
  "imagine a world where",
  "revolutionary opportunity",
  "unlock your potential",
  "leverage ai",
  "game-changing",
  "seize this opportunity",
  "the future is here",
  "in today's fast-paced world",
  "let's dive in",
  "picture yourself",
  "dear valued customer",
  "enrollment closes permanently",
  "1-on-1 build review",
];

/** Varied, natural urgency tied to the recipient's stored personal deadline. */
function urgencyLineForDay(day: number, ctx: RecipientUrgencyContext): string {
  const deadline = ctx.personalDeadlineLagos;
  const dateOnly = ctx.personalDeadlineDate;

  if (ctx.isPastDeadline) {
    return `Your personal ₦49,999 special price has expired. How To Build Software With AI And Get Paid For It remains available at the regular ₦100,000 price.`;
  }

  if (day === 1) {
    return `You still have until ${deadline} to decide whether you want to enter the full program at ₦49,999. After that, the training remains available, but the price becomes ₦100,000.`;
  }
  if (day === 4) {
    return `I would rather you watch the free training and decide before your personal ₦49,999 price window ends than wake up after ${dateOnly} wishing you had looked into it properly. After that deadline, the program remains available at ₦100,000.`;
  }
  if (day === 14) {
    return `You do not have to buy today. But you should understand what you are deciding about before your personal deadline on ${deadline} passes. After that date, ₦49,999 becomes ₦100,000 while the program remains available.`;
  }
  if (day === 15) {
    return `The training is not disappearing. Your ₦49,999 window is what expires on ${deadline}. After that, the program remains available at ₦100,000. Until then, start with the free webinar.`;
  }
  if (day === 28) {
    return `Your current ₦49,999 access expires on ${deadline}. After that exact moment, the program remains available at ₦100,000.`;
  }
  if (day === 29) {
    return `Waiting has a financial consequence now: after ${deadline}, entry moves from ₦49,999 to ₦100,000 while the same program stays open.`;
  }
  if (day === 30) {
    if (ctx.hoursRemaining <= 24) {
      return `Your ₦49,999 special price expires tonight at ${deadline}. After that, the program remains available at ₦100,000.`;
    }
    return `Today is the final day of your personal ₦49,999 window. Your deadline is ${deadline}. The program stays available afterward at ₦100,000.`;
  }

  if (getPhaseForDay(day) === "webinar") {
    if (ctx.daysRemaining > 7) {
      return `When you are ready for the complete program, your ₦49,999 special price remains available until ${deadline}. After that deadline, the program stays open at ₦100,000.`;
    }
    if (ctx.daysRemaining >= 1) {
      return `You have ${ctx.daysRemaining} day${ctx.daysRemaining === 1 ? "" : "s"} left on your personal special-price window (${deadline}). The program remains available after that; only the ₦49,999 price expires.`;
    }
    return `Your personal ₦49,999 special price expires in about ${ctx.hoursRemaining} hour${ctx.hoursRemaining === 1 ? "" : "s"} (${deadline}). The program remains available afterward at ₦100,000.`;
  }

  if (ctx.daysRemaining > 7) {
    return `Your ₦49,999 special price is available until ${deadline}. You have ${ctx.daysRemaining} days left. After your deadline, the program remains available at ₦100,000.`;
  }
  if (ctx.daysRemaining >= 1) {
    return `You have ${ctx.daysRemaining} day${ctx.daysRemaining === 1 ? "" : "s"} left before your personal ₦49,999 price expires on ${dateOnly}. The program stays open at ₦100,000 afterward.`;
  }
  return `Your ₦49,999 special price expires in about ${ctx.hoursRemaining} hour${ctx.hoursRemaining === 1 ? "" : "s"} (${deadline}). The program remains available at ₦100,000 after that.`;
}

export function renderCampaignEmail(
  template: CampaignEmailTemplate,
  ctx: RecipientUrgencyContext
): CampaignEmail {
  const urgency = urgencyLineForDay(template.day, ctx);
  const body = [...template.body];
  // Place urgency near the end so the argument leads and the deadline closes the letter.
  if (body.length >= 2) {
    body.splice(body.length - 1, 0, urgency);
  } else {
    body.push(urgency);
  }
  return { ...template, body };
}

export function getCampaignEmailTemplate(day: number): CampaignEmailTemplate {
  const found = AI_MONEY_CODE_EMAIL_TEMPLATES.find((item) => item.day === day);
  if (!found) throw new Error(`Missing campaign email for day ${day}`);
  return found;
}

export function getCampaignEmail(day: number, ctx: RecipientUrgencyContext): CampaignEmail {
  return renderCampaignEmail(getCampaignEmailTemplate(day), ctx);
}

export function validateCampaignContent(): { ok: boolean; errors: string[] } {
  const errors: string[] = [];
  if (AI_MONEY_CODE_EMAIL_TEMPLATES.length !== CAMPAIGN_TOTAL_DAYS) {
    errors.push(`Expected ${CAMPAIGN_TOTAL_DAYS} emails, found ${AI_MONEY_CODE_EMAIL_TEMPLATES.length}`);
  }

  const days = new Set<number>();
  for (const email of AI_MONEY_CODE_EMAIL_TEMPLATES) {
    if (days.has(email.day)) errors.push(`Duplicate campaign day ${email.day}`);
    days.add(email.day);

    if (!email.subject.trim()) errors.push(`Day ${email.day}: subject missing`);
    if (!email.preview.trim()) errors.push(`Day ${email.day}: preview missing`);
    if (!email.ctaLabel.trim()) errors.push(`Day ${email.day}: cta label missing`);
    if (!email.body.length || email.body.some((line) => !line.trim())) {
      errors.push(`Day ${email.day}: body is incomplete`);
    }
    if (email.body.length < 6) {
      errors.push(`Day ${email.day}: body too short (${email.body.length} paragraphs; need substantial depth)`);
    }
    const bodyChars = email.body.join(" ").length;
    if (bodyChars < 900) {
      errors.push(`Day ${email.day}: body too thin (${bodyChars} chars)`);
    }
    if (email.day <= 15 && email.ctaUrl !== WEBINAR_URL) {
      errors.push(`Day ${email.day}: expected webinar CTA`);
    }
    if (email.day >= 16 && email.ctaUrl !== OFFER_URL) {
      errors.push(`Day ${email.day}: expected offer CTA`);
    }
    const bodyText = email.body.join(" ").toLowerCase();
    for (const phrase of BANNED_PHRASES) {
      if (bodyText.includes(phrase)) {
        errors.push(`Day ${email.day}: banned phrase "${phrase}"`);
      }
    }
    if (bodyText.includes("sept 16, 2026") || bodyText.includes("september 16, 2026")) {
      errors.push(`Day ${email.day}: must not hard-code a global calendar deadline`);
    }
    if (bodyText.includes("{{")) {
      errors.push(`Day ${email.day}: raw template variables must not appear in content`);
    }
    if (
      bodyText.includes("promptearn") &&
      (bodyText.includes("this skill created promptearn") ||
        bodyText.includes("ai software-building skill created promptearn") ||
        bodyText.includes("promptearn was created by this"))
    ) {
      errors.push(`Day ${email.day}: PromptEarn must not be presented as created by this AI skill`);
    }
  }

  for (let day = 1; day <= CAMPAIGN_TOTAL_DAYS; day += 1) {
    if (!days.has(day)) errors.push(`Missing campaign day ${day}`);
  }

  const subjects = AI_MONEY_CODE_EMAIL_TEMPLATES.map((e) => e.subject.trim().toLowerCase());
  if (new Set(subjects).size !== subjects.length) {
    errors.push("Duplicate subject lines detected");
  }

  return { ok: errors.length === 0, errors };
}

export function validateRenderedUrgency(ctx: RecipientUrgencyContext): { ok: boolean; errors: string[] } {
  const errors: string[] = [];
  for (const template of AI_MONEY_CODE_EMAIL_TEMPLATES) {
    const rendered = renderCampaignEmail(template, ctx);
    const text = rendered.body.join(" ");
    const lower = text.toLowerCase();

    if (!text.includes("₦49,999") && !text.includes("49,999")) {
      errors.push(`Day ${template.day}: rendered email missing special price urgency`);
    }
    if (!text.includes("100,000") && !text.includes("₦100,000")) {
      errors.push(`Day ${template.day}: rendered email missing regular price context`);
    }
    if (lower.includes("{{")) {
      errors.push(`Day ${template.day}: raw template variables leaked into rendered email`);
    }
    if (!ctx.isPastDeadline) {
      const hasDeadlineSignal =
        text.includes(ctx.personalDeadlineLagos) ||
        text.includes(ctx.personalDeadlineDate) ||
        lower.includes("deadline") ||
        lower.includes("window") ||
        lower.includes("expires");
      if (!hasDeadlineSignal) {
        errors.push(`Day ${template.day}: rendered email missing deadline urgency`);
      }
    }
  }
  return { ok: errors.length === 0, errors };
}
