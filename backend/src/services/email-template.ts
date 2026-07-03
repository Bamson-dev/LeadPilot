import { config } from "../config/env";

const FONT_STACK =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

export const BRAND_PURPLE = "#7C3AED";
const BRAND_PURPLE_DARK = "#6D28D9";
const TEXT_PRIMARY = "#111111";
const TEXT_BODY = "#444444";
const TEXT_MUTED = "#666666";
const TEXT_FOOTER = "#888888";
const BORDER_COLOR = "#E5E7EB";
const PAGE_BG = "#F4F4F5";
const CARD_BG = "#FFFFFF";

export function getFrontendUrl(): string {
  return config.FRONTEND_URL.replace(/\/$/, "");
}

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function getUnsubscribeUrl(email: string): string {
  const frontend = getFrontendUrl();
  const backend = frontend.includes("staging.leadthur")
    ? "https://staging-backend.leadthur.com"
    : "https://backend.leadthur.com";
  return `${backend}/unsubscribe?email=${encodeURIComponent(email)}`;
}

export function getTrialEmailOpenedUrl(email: string, step: number): string {
  const frontend = getFrontendUrl();
  const backend = frontend.includes("staging.leadthur")
    ? "https://staging-backend.leadthur.com"
    : "https://backend.leadthur.com";
  return `${backend}/trial/email-opened?email=${encodeURIComponent(email)}&step=${step}`;
}

const EMAIL_STYLES = `
  body, table, td, p, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
  table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; border-collapse: collapse; }
  img { -ms-interpolation-mode: bicubic; border: 0; outline: none; text-decoration: none; }
  body { margin: 0 !important; padding: 0 !important; width: 100% !important; height: 100% !important; }
  a { color: ${BRAND_PURPLE}; }
  h1 { font-size: 22px; font-weight: 700; color: ${TEXT_PRIMARY}; margin: 0 0 20px; line-height: 1.35; }
  p { font-size: 16px; color: ${TEXT_BODY}; line-height: 1.75; margin: 0 0 18px; }
  .highlight { border-left: 3px solid ${BRAND_PURPLE}; padding: 14px 0 14px 18px; margin: 24px 0; font-size: 16px; color: #333333; line-height: 1.75; }
  .meta { font-size: 14px; color: ${TEXT_MUTED}; line-height: 1.7; margin: 0 0 18px; }
  .sig { margin-top: 28px; padding-top: 20px; border-top: 1px solid ${BORDER_COLOR}; font-size: 15px; color: ${TEXT_BODY}; line-height: 1.6; }
  .sig strong { color: ${TEXT_PRIMARY}; display: block; margin-bottom: 2px; }
  .stat-box { border: 1px solid ${BORDER_COLOR}; padding: 24px; margin: 24px 0; text-align: center; border-radius: 8px; }
  .stat-number { font-size: 40px; font-weight: 700; color: ${BRAND_PURPLE}; line-height: 1; margin-bottom: 8px; }
  .stat-label { font-size: 14px; color: ${TEXT_MUTED}; }
  .detail-row { display: block; padding: 10px 0; border-bottom: 1px solid #EEEEEE; font-size: 14px; color: ${TEXT_BODY}; }
  .detail-row strong { color: ${TEXT_PRIMARY}; }
  @media only screen and (max-width: 620px) {
    .email-container { width: 100% !important; }
    .content-cell { padding-left: 24px !important; padding-right: 24px !important; }
  }
`;

export type EmailTemplateOptions = {
  body: string;
  recipientEmail?: string;
  trialStep?: number;
  trialFooterNote?: string;
  trackingPixelUrl?: string | null;
  preheader?: string;
};

function brandLogoHtml(): string {
  return `<span style="font-family:${FONT_STACK};font-size:22px;font-weight:700;color:${TEXT_PRIMARY};letter-spacing:-0.3px;">Lead<span style="color:${BRAND_PURPLE};">Thur</span></span>`;
}

export function buildEmailHtml(options: EmailTemplateOptions): string {
  const { body, recipientEmail, trialStep, trialFooterNote, trackingPixelUrl, preheader } =
    options;
  const unsubscribeUrl = recipientEmail ? getUnsubscribeUrl(recipientEmail) : null;
  const openedUrl =
    trackingPixelUrl ??
    (recipientEmail && trialStep ? getTrialEmailOpenedUrl(recipientEmail, trialStep) : null);

  const footerNote =
    trialFooterNote ??
    (recipientEmail
      ? "You are receiving this because you use LeadThur."
      : "You are receiving this from LeadThur.");

  const hiddenPreheader = preheader
    ? `<div style="display:none;font-size:1px;color:${PAGE_BG};line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">${escapeHtml(preheader)}</div>`
    : "";

  return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" lang="en">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <meta name="x-apple-disable-message-reformatting" />
  <meta name="format-detection" content="telephone=no,address=no,email=no,date=no,url=no" />
  <title>LeadThur</title>
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
  <style type="text/css">${EMAIL_STYLES}</style>
</head>
<body style="margin:0;padding:0;background-color:${PAGE_BG};font-family:${FONT_STACK};color:${TEXT_BODY};">
  ${hiddenPreheader}
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:${PAGE_BG};margin:0;padding:0;width:100%;">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" class="email-container" width="600" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:600px;background-color:${CARD_BG};border:1px solid ${BORDER_COLOR};border-radius:8px;overflow:hidden;">
          <tr>
            <td class="content-cell" style="padding:32px 40px 24px;border-bottom:1px solid ${BORDER_COLOR};">
              ${brandLogoHtml()}
            </td>
          </tr>
          <tr>
            <td class="content-cell" style="padding:32px 40px;font-family:${FONT_STACK};font-size:16px;line-height:1.75;color:${TEXT_BODY};">
              ${body}
            </td>
          </tr>
          <tr>
            <td class="content-cell" style="padding:24px 40px 32px;border-top:1px solid ${BORDER_COLOR};font-family:${FONT_STACK};font-size:12px;line-height:1.7;color:${TEXT_FOOTER};">
              ${footerNote}<br />
              ${
                unsubscribeUrl
                  ? `<a href="${unsubscribeUrl}" style="color:${BRAND_PURPLE};text-decoration:underline;">Unsubscribe</a> &middot; `
                  : ""
              }
              Pdigital Marketstore Ltd &middot; RC 8015428 &middot; Lagos, Nigeria
              ${
                openedUrl
                  ? `<img src="${openedUrl}" alt="" width="1" height="1" style="display:block;width:1px;height:1px;border:0;margin-top:8px;opacity:0;" />`
                  : ""
              }
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/** Bulletproof CTA button — works in Gmail, Outlook, and Apple Mail. */
export function emailButton(label: string, href: string): string {
  const safeHref = escapeHtml(href);
  const safeLabel = escapeHtml(label);
  return `<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:24px 0;">
  <tr>
    <td align="left">
      <!--[if mso]>
      <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${safeHref}" style="height:48px;v-text-anchor:middle;width:240px;" arcsize="12%" strokecolor="${BRAND_PURPLE}" fillcolor="${BRAND_PURPLE}">
        <w:anchorlock/>
        <center style="color:#ffffff;font-family:${FONT_STACK};font-size:15px;font-weight:600;">${safeLabel}</center>
      </v:roundrect>
      <![endif]-->
      <!--[if !mso]><!-->
      <a href="${safeHref}" target="_blank" style="display:inline-block;background-color:${BRAND_PURPLE};color:#ffffff !important;font-family:${FONT_STACK};font-size:15px;font-weight:600;line-height:48px;text-decoration:none;padding:0 28px;border-radius:8px;mso-hide:all;">${safeLabel}</a>
      <!--<![endif]-->
    </td>
  </tr>
</table>`;
}

export function emailHeading(text: string): string {
  return `<h1 style="margin:0 0 20px;font-family:${FONT_STACK};font-size:22px;font-weight:700;line-height:1.35;color:${TEXT_PRIMARY};">${escapeHtml(text)}</h1>`;
}

export function emailParagraph(text: string): string {
  return `<p style="margin:0 0 18px;font-family:${FONT_STACK};font-size:16px;line-height:1.75;color:${TEXT_BODY};">${escapeHtml(text)}</p>`;
}

export function emailHighlight(text: string): string {
  return `<div class="highlight" style="border-left:3px solid ${BRAND_PURPLE};padding:14px 0 14px 18px;margin:24px 0;font-family:${FONT_STACK};font-size:16px;line-height:1.75;color:#333333;">${escapeHtml(text)}</div>`;
}

export function emailSignature(): string {
  return `<div class="sig" style="margin-top:28px;padding-top:20px;border-top:1px solid ${BORDER_COLOR};font-family:${FONT_STACK};font-size:15px;line-height:1.6;color:${TEXT_BODY};"><strong style="display:block;margin-bottom:2px;color:${TEXT_PRIMARY};">Bamidele</strong>Founder, LeadThur</div>`;
}

export function emailLink(label: string, href: string): string {
  return `<a href="${escapeHtml(href)}" style="color:${BRAND_PURPLE};text-decoration:underline;">${escapeHtml(label)}</a>`;
}
