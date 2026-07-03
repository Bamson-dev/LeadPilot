import { config } from "../config/env";

const FONT_STACK =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

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
  body { margin: 0; padding: 0; background: #ffffff; font-family: ${FONT_STACK}; color: #111111; }
  .outer { background: #ffffff; padding: 24px 16px; }
  .wrap { max-width: 600px; margin: 0 auto; background: #ffffff; }
  .header { padding: 8px 0 28px; border-bottom: 1px solid #e5e5e5; }
  .logo { font-size: 20px; font-weight: 700; color: #111111; letter-spacing: -0.3px; }
  .body { padding: 32px 0; }
  h1 { font-size: 22px; font-weight: 700; color: #111111; margin: 0 0 20px; line-height: 1.35; }
  p { font-size: 16px; color: #444444; line-height: 1.75; margin: 0 0 18px; }
  .highlight { border-left: 3px solid #111111; padding: 14px 0 14px 18px; margin: 24px 0; font-size: 16px; color: #333333; line-height: 1.75; }
  .btn { display: inline-block; background: #111111; color: #ffffff !important; text-align: center; padding: 14px 28px; border-radius: 4px; text-decoration: none; font-weight: 600; font-size: 15px; margin: 8px 0 24px; }
  .meta { font-size: 14px; color: #666666; line-height: 1.7; margin: 0 0 18px; }
  .sig { margin-top: 28px; padding-top: 20px; border-top: 1px solid #e5e5e5; font-size: 15px; color: #444444; line-height: 1.6; }
  .sig strong { color: #111111; display: block; margin-bottom: 2px; }
  .footer { padding: 24px 0 8px; border-top: 1px solid #e5e5e5; }
  .footer p { font-size: 12px; color: #777777; line-height: 1.7; margin: 0; }
  .footer a { color: #111111; text-decoration: underline; }
  .stat-box { border: 1px solid #e5e5e5; padding: 24px; margin: 24px 0; text-align: center; }
  .stat-number { font-size: 40px; font-weight: 700; color: #111111; line-height: 1; margin-bottom: 8px; }
  .stat-label { font-size: 14px; color: #666666; }
  .detail-row { display: block; padding: 10px 0; border-bottom: 1px solid #eeeeee; font-size: 14px; color: #444444; }
  .detail-row strong { color: #111111; }
`;

export type EmailTemplateOptions = {
  body: string;
  recipientEmail?: string;
  trialStep?: number;
  trialFooterNote?: string;
  trackingPixelUrl?: string | null;
};

export function buildEmailHtml(options: EmailTemplateOptions): string {
  const { body, recipientEmail, trialStep, trialFooterNote, trackingPixelUrl } = options;
  const unsubscribeUrl = recipientEmail ? getUnsubscribeUrl(recipientEmail) : null;
  const openedUrl =
    trackingPixelUrl ??
    (recipientEmail && trialStep ? getTrialEmailOpenedUrl(recipientEmail, trialStep) : null);

  const footerNote =
    trialFooterNote ??
    (recipientEmail
      ? "You are receiving this because you use LeadThur."
      : "You are receiving this from LeadThur.");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>LeadThur</title>
  <style>${EMAIL_STYLES}</style>
</head>
<body>
  <div class="outer">
    <div class="wrap">
      <div class="header">
        <div class="logo">LeadThur</div>
      </div>
      <div class="body">
        ${body}
      </div>
      <div class="footer">
        <p>
          ${footerNote}<br>
          ${unsubscribeUrl ? `<a href="${unsubscribeUrl}">Unsubscribe</a> · ` : ""}
          Pdigital Marketstore Ltd · RC 8015428 · Lagos, Nigeria
        </p>
        ${openedUrl ? `<img src="${openedUrl}" alt="" width="1" height="1" style="display:block;opacity:0;width:1px;height:1px;border:0;margin-top:4px" />` : ""}
      </div>
    </div>
  </div>
</body>
</html>`;
}

export function emailButton(label: string, href: string): string {
  return `<a href="${escapeHtml(href)}" class="btn">${escapeHtml(label)}</a>`;
}

export function emailHeading(text: string): string {
  return `<h1>${escapeHtml(text)}</h1>`;
}

export function emailParagraph(text: string): string {
  return `<p>${escapeHtml(text)}</p>`;
}

export function emailHighlight(text: string): string {
  return `<div class="highlight">${escapeHtml(text)}</div>`;
}

export function emailSignature(): string {
  return `<div class="sig"><strong>Bamidele</strong>Founder, LeadThur</div>`;
}
