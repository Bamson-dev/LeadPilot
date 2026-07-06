import { escapeHtml } from "./email-template";

const FONT_STACK =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

export function plainTextToHtml(text: string): string {
  return escapeHtml(text.replace(/\r\n/g, "\n")).replace(/\n/g, "<br />\n");
}

export function buildOutreachUnsubscribeUrl(trackingToken: string, baseUrl: string): string {
  return `${baseUrl.replace(/\/$/, "")}/outreach/unsubscribe?token=${encodeURIComponent(trackingToken)}`;
}

export function buildOutreachOptOutLine(unsubscribeUrl: string): string {
  return `If you'd rather not get messages like this, you can opt out here: ${unsubscribeUrl}`;
}

export function buildOutreachEmailContent(options: {
  body: string;
  trackingPixelUrl: string;
  unsubscribeUrl: string;
}): { html: string; text: string } {
  const bodyHtml = plainTextToHtml(options.body);
  const optOutHtml = `If you&rsquo;d rather not get messages like this, you can <a href="${escapeHtml(options.unsubscribeUrl)}" style="color:#666666;text-decoration:underline;">opt out here</a>.`;
  const text = `${options.body}\n\n---\n${buildOutreachOptOutLine(options.unsubscribeUrl)}`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title></title>
</head>
<body style="margin:0;padding:16px;font-family:${FONT_STACK};font-size:15px;line-height:1.6;color:#222222;">
  <div>${bodyHtml}</div>
  <p style="margin:24px 0 0;font-size:11px;line-height:1.5;color:#888888;">${optOutHtml}</p>
  <img src="${escapeHtml(options.trackingPixelUrl)}" alt="" width="1" height="1" style="display:block;width:1px;height:1px;border:0;opacity:0;" />
</body>
</html>`;

  return { html, text };
}

/** Guardrail for tests — outreach mail must never ship LeadThur transactional branding. */
export function outreachEmailMustNotContainBranding(content: string): string[] {
  const banned = ["LeadThur", "Lead Thur", "Pdigital", "pdigital", "RC 8015428"];
  return banned.filter((needle) => content.includes(needle));
}
