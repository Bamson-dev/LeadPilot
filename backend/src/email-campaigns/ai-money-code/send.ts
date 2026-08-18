import {
  buildEmailHtml,
  emailButton,
  emailHeading,
  emailParagraph,
  emailSignature,
} from "../../services/email-template";
import { sendResendEmail } from "../../services/email";
import { logger } from "../../utils/logger";
import type { CampaignEmail } from "./types";

export function buildCampaignHtml(email: CampaignEmail, recipientEmail: string): string {
  const body = `
    ${emailHeading(email.subject)}
    ${email.body.map((line) => emailParagraph(line)).join("")}
    ${emailButton(email.ctaLabel, email.ctaUrl)}
    ${emailSignature()}
  `;
  return buildEmailHtml({
    body,
    recipientEmail,
    preheader: email.preview,
  });
}

export async function sendCampaignEmail(input: {
  to: string;
  campaignEmail: CampaignEmail;
}): Promise<{ success: boolean; messageId: string | null; error: string | null }> {
  const html = buildCampaignHtml(input.campaignEmail, input.to);
  const result = await sendResendEmail({
    to: input.to,
    subject: input.campaignEmail.subject,
    html,
  });
  if (!result.success) {
    logger.error("AI money code email send failed", {
      to: input.to,
      day: input.campaignEmail.day,
      error: result.error || "unknown",
    });
    return { success: false, messageId: null, error: result.error || "unknown" };
  }
  return { success: true, messageId: result.messageId || null, error: null };
}
