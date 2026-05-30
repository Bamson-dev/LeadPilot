import { config } from "../config/env";
import { logger } from "../utils/logger";

function getFrontendUrl(): string {
  return config.FRONTEND_URL.replace(/\/$/, "");
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function emailH1(text: string): string {
  return `<h1 style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;font-size:26px;font-weight:800;color:#1A1A2E;letter-spacing:-0.5px;margin:0 0 12px 0;line-height:1.2;">${text}</h1>`;
}

function emailP(text: string, style = ""): string {
  return `<p style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;font-size:15px;color:#444444;line-height:1.75;margin:0 0 16px 0;${style}">${text}</p>`;
}

function emailDivider(): string {
  return `<table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0;"><tr><td style="height:1px;background-color:#EEEEEE;font-size:0;line-height:0;">&nbsp;</td></tr></table>`;
}

function emailButton(text: string, url: string, color = "#7C3AED"): string {
  return `<table cellpadding="0" cellspacing="0" border="0" align="center" style="margin:28px auto;">
    <tr>
      <td style="background-color:${color};border-radius:10px;text-align:center;">
        <a href="${url}" style="display:inline-block;padding:14px 36px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;font-size:15px;font-weight:700;color:white;text-decoration:none;">${text} &rarr;</a>
      </td>
    </tr>
  </table>`;
}

function emailInfoBox(
  rows: { label: string; value: string; valueStyle?: string }[],
  bgColor = "#F8F8FB",
  borderColor = "#EEEEEE"
): string {
  const rowsHtml = rows
    .map(
      (row, i) => `
    <tr>
      <td style="padding:10px 0;border-bottom:${i < rows.length - 1 ? `1px solid ${borderColor}` : "none"};">
        <table width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;font-size:14px;color:#888888;">${row.label}</td>
            <td align="right" style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;font-size:14px;font-weight:700;color:#1A1A2E;${row.valueStyle || ""}">${row.value}</td>
          </tr>
        </table>
      </td>
    </tr>
  `
    )
    .join("");

  return `<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${bgColor};border-radius:12px;padding:8px 20px;margin:20px 0;">
    ${rowsHtml}
  </table>`;
}

function emailHighlightBox(
  text: string,
  type: "success" | "purple" | "warning" = "purple"
): string {
  const styles = {
    success: { bg: "#ECFDF5", border: "#A7F3D0", color: "#065F46" },
    purple: { bg: "#F5F3FF", border: "#DDD6FE", color: "#5B21B6" },
    warning: { bg: "#FFFBEB", border: "#FDE68A", color: "#92400E" },
  };
  const s = styles[type];
  return `<table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:20px 0;">
    <tr>
      <td style="background-color:${s.bg};border:1px solid ${s.border};border-radius:12px;padding:16px 20px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;font-size:13px;font-weight:600;color:${s.color};line-height:1.6;">${text}</td>
    </tr>
  </table>`;
}

function emailStatGrid(
  stats: { value: string; label: string; sub?: string; color?: string }[]
): string {
  const width = Math.floor(100 / stats.length);
  const cols = stats
    .map(
      (s) => `
    <td width="${width}%" style="padding:4px;" valign="top">
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#F8F8FB;border-radius:10px;">
        <tr>
          <td align="center" style="padding:16px 8px;">
            <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;font-size:28px;font-weight:900;color:${s.color || "#7C3AED"};letter-spacing:-1px;line-height:1;">${s.value}</div>
            ${s.sub ? `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;font-size:10px;color:#BBBBBB;margin-top:3px;">${s.sub}</div>` : ""}
            <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;font-size:11px;color:#888888;margin-top:4px;">${s.label}</div>
          </td>
        </tr>
      </table>
    </td>
  `
    )
    .join("");

  return `<table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:20px 0;"><tr>${cols}</tr></table>`;
}

function buildEmailTemplate({
  title,
  preheader,
  body,
  accentColor = "#7C3AED",
}: {
  title: string;
  preheader: string;
  body: string;
  accentColor?: string;
}): string {
  const frontendUrl = getFrontendUrl();

  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="format-detection" content="telephone=no">
  <title>${title}</title>
  <!--[if mso]>
  <noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript>
  <![endif]-->
</head>
<body style="margin:0;padding:0;background-color:#F4F4F8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;-webkit-font-smoothing:antialiased;">

  <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;color:#F4F4F8;line-height:1px;">${preheader}&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;</div>

  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#F4F4F8;">
    <tr>
      <td align="center" style="padding:40px 20px;">

        <table width="580" cellpadding="0" cellspacing="0" border="0" style="max-width:580px;width:100%;">

          <tr>
            <td style="background-color:${accentColor};border-radius:16px 16px 0 0;padding:28px 36px;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td width="52" valign="middle">
                    <table cellpadding="0" cellspacing="0" border="0" width="48" style="width:48px;background:rgba(255,255,255,0.15);border-radius:10px;">
                      <tr>
                        <td align="center" valign="middle" width="48" height="48" style="width:48px;height:48px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;font-size:18px;font-weight:800;color:white;letter-spacing:-0.5px;text-align:center;">
                          LT
                        </td>
                      </tr>
                    </table>
                  </td>
                  <td width="16"></td>
                  <td valign="middle">
                    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;font-size:22px;font-weight:700;color:white;line-height:1;">
                      Lead<span style="color:#C4B5FD;">Thur</span>
                    </div>
                    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;font-size:9px;color:rgba(255,255,255,0.55);letter-spacing:2.5px;text-transform:uppercase;margin-top:4px;">
                      Business Discovery
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td style="background-color:#ffffff;padding:40px 36px;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;font-size:15px;color:#444444;line-height:1.75;">
                    ${body}
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td style="background-color:#F0F0F6;border-radius:0 0 16px 16px;padding:24px 36px;border-top:1px solid #E5E5EE;text-align:center;">
              <p style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;font-size:13px;font-weight:700;color:#1A1A2E;margin:0 0 8px 0;">
                Lead<span style="color:${accentColor};">Thur</span>
              </p>
              <p style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;font-size:12px;color:#888888;margin:0 0 6px 0;">
                <a href="https://wa.me/2349067285890" style="color:${accentColor};text-decoration:none;">WhatsApp 09067285890</a>
                &nbsp;&middot;&nbsp;
                <a href="mailto:access@leadthur.com" style="color:${accentColor};text-decoration:none;">access@leadthur.com</a>
                &nbsp;&middot;&nbsp;
                <a href="${frontendUrl}" style="color:${accentColor};text-decoration:none;">leadthur.com</a>
              </p>
              <p style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;font-size:11px;color:#BBBBBB;margin:0;">
                &copy; ${new Date().getFullYear()} LeadThur. Business Discovery Intelligence.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>

</body>
</html>`;
}

async function sendEmail(params: {
  to: string;
  subject: string;
  html: string;
}): Promise<void> {
  const apiKey = config.BREVO_API_KEY;
  if (!apiKey) {
    throw new Error("BREVO_API_KEY is not configured");
  }

  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "api-key": apiKey,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      sender: { email: config.BREVO_SENDER_EMAIL, name: "LeadThur" },
      to: [{ email: params.to }],
      subject: params.subject,
      htmlContent: params.html,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    logger.error("Brevo send failed", {
      status: res.status,
      body: body.slice(0, 200),
    });
    throw new Error("Failed to send email");
  }
}

export async function sendActivationEmail(email: string, licenseKey: string): Promise<void> {
  const body = [
    emailH1("Your account is ready."),
    emailP(
      "Welcome to LeadThur. Your lifetime access is activated. You can now find business contacts in any city in the world in under 60 seconds."
    ),
    emailInfoBox([
      { label: "Email", value: escapeHtml(email) },
      {
        label: "License key",
        value: `<span style="font-family:monospace;font-size:13px;">${escapeHtml(licenseKey)}</span>`,
      },
      { label: "Access", value: "Lifetime &mdash; no expiry", valueStyle: "color:#10B981;" },
    ]),
    emailP("Enter your license key on the activation page to log in. Keep it somewhere safe."),
    emailButton("Activate My Account", `${getFrontendUrl()}/activate`),
    emailDivider(),
    emailP(
      "Questions? Reply to this email or reach us on WhatsApp <strong>09067285890</strong>. We respond within minutes.",
      "font-size:13px;color:#888888;"
    ),
  ].join("");

  const html = buildEmailTemplate({
    title: "Your LeadThur account is ready",
    preheader: "Your lifetime access is activated. Log in and start finding leads.",
    body,
  });

  await sendEmail({
    to: email,
    subject: "Your LeadThur account is ready",
    html,
  });
}

export async function sendCommissionNotification(
  referrerEmail: string,
  _referredEmail: string,
  commissionNgn: number,
  commissionUsd: number,
  totalEarnedNgn: number,
  totalEarnedUsd: number,
  pendingNgn: number
): Promise<void> {
  const body = [
    `<table width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td align="center" style="padding:8px 0 20px;">`,
    `<div style="font-size:44px;margin-bottom:12px;">&#127881;</div>`,
    emailH1(`You just earned $${commissionUsd.toFixed(2)}`),
    emailP(
      "Someone bought LeadThur through your referral link. Your commission has been added to your balance."
    ),
    `</td></tr></table>`,
    emailStatGrid([
      {
        value: `$${commissionUsd.toFixed(2)}`,
        label: "This commission",
        sub: `&#8358;${commissionNgn.toLocaleString()}`,
        color: "#10B981",
      },
      {
        value: `$${totalEarnedUsd.toFixed(2)}`,
        label: "Total earned",
        sub: `&#8358;${totalEarnedNgn.toLocaleString()}`,
        color: "#7C3AED",
      },
    ]),
    pendingNgn >= 7500
      ? emailHighlightBox(
          `&#10003; You have &#8358;${pendingNgn.toLocaleString()} pending. You can request a payout from your dashboard now.`,
          "success"
        )
      : emailHighlightBox(
          "Keep sharing your link. One more referral and you can request your first payout.",
          "purple"
        ),
    emailP(
      "Every person who buys through your link earns you <strong>$7.50 (&#8358;7,500)</strong>. No cap on how much you can earn."
    ),
    emailButton("View My Earnings", `${getFrontendUrl()}/dashboard`),
  ].join("");

  const html = buildEmailTemplate({
    title: `You just earned $${commissionUsd.toFixed(2)} — LeadThur`,
    preheader: `Someone bought LeadThur through your link. You earned $${commissionUsd.toFixed(2)}.`,
    body,
  });

  await sendEmail({
    to: referrerEmail,
    subject: `You just earned $${commissionUsd.toFixed(2)} — LeadThur commission`,
    html,
  });
}

export async function sendPayoutRequestedEmail(
  email: string,
  amountNgn: number,
  amountUsd: number,
  accountName: string,
  bankName: string
): Promise<void> {
  const body = [
    `<table width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td align="center" style="padding:8px 0 20px;">`,
    `<div style="font-size:44px;margin-bottom:12px;">&#127968;</div>`,
    emailH1("Payout request received"),
    emailP(
      "We have received your payout request and it is being processed. Expect your money within 24 hours."
    ),
    `</td></tr></table>`,
    emailInfoBox([
      {
        label: "Amount",
        value: `&#8358;${amountNgn.toLocaleString()} <span style="color:#888888;font-weight:400;font-size:13px;">($${amountUsd.toFixed(2)})</span>`,
      },
      { label: "Account name", value: escapeHtml(accountName) },
      { label: "Bank", value: escapeHtml(bankName) },
      { label: "Status", value: "Processing", valueStyle: "color:#FBBF24;" },
    ]),
    emailP(
      "Keep sharing your referral link while you wait. Every new referral adds to your next payout."
    ),
    emailButton("View My Dashboard", `${getFrontendUrl()}/dashboard`),
  ].join("");

  const html = buildEmailTemplate({
    title: "Payout request received — LeadThur",
    preheader: `Your payout of ₦${amountNgn.toLocaleString()} is being processed. Expect payment within 24 hours.`,
    body,
  });

  await sendEmail({
    to: email,
    subject: "Your payout request is being processed — LeadThur",
    html,
  });
}

export async function sendPayoutPaidEmail(
  email: string,
  amountNgn: number,
  amountUsd: number,
  accountName: string,
  bankName: string,
  accountNumber: string
): Promise<void> {
  const body = [
    `<table width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td align="center" style="padding:8px 0 20px;">`,
    `<div style="font-size:44px;margin-bottom:12px;">&#128184;</div>`,
    emailH1("Your money is on the way"),
    emailP(
      "Your payout has been processed and the transfer has been initiated to your bank account. Check your account within a few hours."
    ),
    `</td></tr></table>`,
    emailInfoBox(
      [
        {
          label: "Amount paid",
          value: `&#8358;${amountNgn.toLocaleString()}`,
          valueStyle: "color:#10B981;font-size:18px;",
        },
        { label: "Account name", value: escapeHtml(accountName) },
        { label: "Bank", value: escapeHtml(bankName) },
        {
          label: "Account number",
          value: `<span style="font-family:monospace;">${escapeHtml(accountNumber)}</span>`,
        },
      ],
      "#ECFDF5",
      "#D1FAE5"
    ),
    emailP(
      "Thank you for promoting LeadThur. Keep sharing your referral link and you can request your next payout anytime your balance reaches &#8358;7,500."
    ),
    emailButton("View My Dashboard", `${getFrontendUrl()}/dashboard`, "#10B981"),
  ].join("");

  const html = buildEmailTemplate({
    title: `Your ₦${amountNgn.toLocaleString()} payout has been sent — LeadThur`,
    preheader: `Your payout of ₦${amountNgn.toLocaleString()} to ${escapeHtml(bankName)} has been sent.`,
    body,
  });

  await sendEmail({
    to: email,
    subject: `Your ₦${amountNgn.toLocaleString()} payout has been sent — LeadThur`,
    html,
  });
}

export async function sendDomainChangeEmail(email: string): Promise<void> {
  const body = [
    emailH1("We have a new name and a new home."),
    emailP(
      "Quick update from us. LeadPilot has moved to a new domain and a new name. Everything works exactly the same. Nothing has changed about your account or access."
    ),
    emailInfoBox([
      {
        label: "Old name",
        value: '<span style="text-decoration:line-through;color:#888888;">LeadPilot</span>',
      },
      { label: "New name", value: "LeadThur", valueStyle: "color:#7C3AED;" },
      {
        label: "Old address",
        value: '<span style="text-decoration:line-through;color:#888888;">leadpilot.live</span>',
      },
      { label: "New address", value: "leadthur.com", valueStyle: "color:#7C3AED;" },
    ]),
    emailHighlightBox(
      "Why the change? We discovered LeadPilot is already a registered brand name belonging to another company. Rather than risk any legal issues, we made the switch early and cleanly.",
      "purple"
    ),
    emailP(
      "Your dashboard and login page are now at <strong>leadthur.com</strong>. If you visit the old address it will automatically redirect you to the new one, so your bookmarks will still work."
    ),
    emailButton("Go to My Dashboard", `${getFrontendUrl()}/dashboard`),
    emailDivider(),
    emailP(
      "Questions? Reach us on WhatsApp <strong>09067285890</strong> and we will sort you out immediately.",
      "font-size:13px;color:#888888;"
    ),
  ].join("");

  const html = buildEmailTemplate({
    title: "LeadThur — We have a new name and a new home",
    preheader: "LeadPilot is now LeadThur. Same product, same access, new address.",
    body,
  });

  await sendEmail({
    to: email,
    subject: "We have a new name and a new home",
    html,
  });
}

export async function sendDirectMessageEmail(
  to: string,
  subject: string,
  messageBody: string
): Promise<void> {
  const paragraphs = messageBody
    .split("\n\n")
    .map((para) => para.trim())
    .filter(Boolean)
    .map((para) => escapeHtml(para).replace(/\n/g, "<br>"));

  const body = [
    ...paragraphs.map((para) => emailP(para)),
    emailDivider(),
    emailP(
      "This message was sent from the LeadThur team. If you have questions reach us on WhatsApp <strong>09067285890</strong>.",
      "font-size:13px;color:#888888;"
    ),
  ].join("");

  const html = buildEmailTemplate({
    title: subject,
    preheader: messageBody.substring(0, 100),
    body,
  });

  await sendEmail({
    to,
    subject,
    html,
  });
}

/** @deprecated Use sendDirectMessageEmail */
export async function sendAdminMessage(
  email: string,
  subject: string,
  message: string
): Promise<void> {
  await sendDirectMessageEmail(email, subject, message);
}

export async function sendSearchCompleteEmail(
  email: string,
  query: string,
  location: string,
  totalFound: number
): Promise<void> {
  const dashboardUrl = `${config.FRONTEND_URL}/dashboard`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
    <body style="margin:0;padding:0;background:#07070A;font-family:Arial,sans-serif;">
      <div style="max-width:520px;margin:0 auto;padding:40px 24px;">
        <div style="margin-bottom:32px;">
          <span style="background:#7C3AED;color:white;padding:6px 14px;border-radius:100px;font-size:12px;font-weight:700;letter-spacing:0.05em;">LEADTHUR</span>
        </div>
        <h1 style="color:#F4F4FF;font-size:28px;font-weight:800;margin:0 0 12px;line-height:1.2;">Your results are ready</h1>
        <p style="color:#A1A1AA;font-size:15px;line-height:1.6;margin:0 0 24px;">
          Your search for <strong style="color:#F4F4FF;">${query}</strong> in <strong style="color:#F4F4FF;">${location}</strong> is complete.
        </p>
        <div style="background:#0F0F14;border:1px solid rgba(255,255,255,0.07);border-radius:12px;padding:24px;margin-bottom:28px;text-align:center;">
          <div style="font-size:56px;font-weight:800;color:#A855F7;line-height:1;">${totalFound}</div>
          <div style="color:#A1A1AA;font-size:14px;margin-top:6px;">businesses found with contact details</div>
        </div>
        <p style="color:#A1A1AA;font-size:14px;line-height:1.6;margin:0 0 28px;">
          Your results include business names, phone numbers, emails, addresses, websites, and ratings. WE LOVE YOU. Go to your dashboard to view and export your CSV file.
        </p>
        <a href="${dashboardUrl}" style="display:block;background:#7C3AED;color:white;padding:16px 28px;border-radius:10px;text-decoration:none;font-weight:700;font-size:16px;text-align:center;margin-bottom:24px;">
          View My Results
        </a>
        <p style="color:#6B6B80;font-size:12px;line-height:1.6;margin:0;border-top:1px solid rgba(255,255,255,0.07);padding-top:20px;">
          LeadThur — Business Discovery Intelligence<br>Your results are saved and available any time you log in.
        </p>
      </div>
    </body>
    </html>
  `;

  await sendEmail({
    to: email,
    subject: `Your search found ${totalFound} businesses — LeadThur`,
    html,
  });
}

export async function sendSearchRunningEmail(
  email: string,
  query: string,
  location: string
): Promise<void> {
  const dashboardUrl = `${config.FRONTEND_URL}/dashboard`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
    <body style="margin:0;padding:0;background:#07070A;font-family:Arial,sans-serif;">
      <div style="max-width:520px;margin:0 auto;padding:40px 24px;">
        <div style="margin-bottom:32px;">
          <span style="background:#7C3AED;color:white;padding:6px 14px;border-radius:100px;font-size:12px;font-weight:700;letter-spacing:0.05em;">LEADTHUR</span>
        </div>
        <h1 style="color:#F4F4FF;font-size:28px;font-weight:800;margin:0 0 12px;line-height:1.2;">Still searching. Hang tight.</h1>
        <p style="color:#A1A1AA;font-size:15px;line-height:1.6;margin:0 0 24px;">
          Your search for <strong style="color:#F4F4FF;">${query}</strong> in <strong style="color:#F4F4FF;">${location}</strong> is taking a bit longer than usual.
        </p>
        <div style="background:#0F0F14;border:1px solid rgba(124,58,237,0.2);border-radius:12px;padding:24px;margin-bottom:28px;">
          <p style="color:#F4F4FF;font-size:14px;line-height:1.7;margin:0;">
            We are still scanning businesses and collecting business names, phone numbers, emails, addresses, websites, and ratings for you. WE LOVE YOU. You do not need to keep the page open. Your results will be saved automatically to your dashboard the moment the search finishes.
          </p>
        </div>
        <a href="${dashboardUrl}" style="display:block;background:#7C3AED;color:white;padding:16px 28px;border-radius:10px;text-decoration:none;font-weight:700;font-size:16px;text-align:center;margin-bottom:24px;">
          Go to Dashboard
        </a>
        <p style="color:#6B6B80;font-size:12px;line-height:1.6;margin:0;border-top:1px solid rgba(255,255,255,0.07);padding-top:20px;">
          LeadThur — Business Discovery Intelligence<br>We will notify you again when your results are ready.
        </p>
      </div>
    </body>
    </html>
  `;

  await sendEmail({
    to: email,
    subject: "Your LeadThur search is still running — we will notify you when done",
    html,
  });
}

export async function sendSearchFailedEmail(
  email: string,
  query: string,
  location: string
): Promise<void> {
  const dashboardUrl = `${config.FRONTEND_URL}/dashboard`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
    <body style="margin:0;padding:0;background:#07070A;font-family:Arial,sans-serif;">
      <div style="max-width:520px;margin:0 auto;padding:40px 24px;">
        <div style="margin-bottom:32px;">
          <span style="background:#7C3AED;color:white;padding:6px 14px;border-radius:100px;font-size:12px;font-weight:700;letter-spacing:0.05em;">LEADTHUR</span>
        </div>
        <h1 style="color:#F4F4FF;font-size:28px;font-weight:800;margin:0 0 12px;line-height:1.2;">Search did not complete</h1>
        <p style="color:#A1A1AA;font-size:15px;line-height:1.6;margin:0 0 24px;">
          Your search for <strong style="color:#F4F4FF;">${query}</strong> in <strong style="color:#F4F4FF;">${location}</strong> did not return results this time.
        </p>
        <div style="background:#0F0F14;border:1px solid rgba(255,255,255,0.07);border-radius:12px;padding:24px;margin-bottom:28px;">
          <p style="color:#F4F4FF;font-size:14px;font-weight:700;margin:0 0 12px;">Try these to get better results:</p>
          <ul style="color:#A1A1AA;font-size:14px;line-height:1.8;margin:0;padding-left:20px;">
            <li>Use a broader location. Instead of Lekki Lagos try Lagos Nigeria</li>
            <li>Use a common business type. Instead of fine dining try restaurants</li>
            <li>Try a different city or niche combination</li>
            <li>Wait a few minutes and try again</li>
          </ul>
        </div>
        <p style="color:#A1A1AA;font-size:14px;line-height:1.6;margin:0 0 28px;">
          This search has not been counted against your monthly limit.
        </p>
        <a href="${dashboardUrl}" style="display:block;background:#7C3AED;color:white;padding:16px 28px;border-radius:10px;text-decoration:none;font-weight:700;font-size:16px;text-align:center;margin-bottom:24px;">
          Try Another Search
        </a>
        <p style="color:#6B6B80;font-size:12px;line-height:1.6;margin:0;border-top:1px solid rgba(255,255,255,0.07);padding-top:20px;">
          LeadThur — Business Discovery Intelligence<br>If this keeps happening contact us and we will help you out.
        </p>
      </div>
    </body>
    </html>
  `;

  await sendEmail({
    to: email,
    subject: "Your LeadThur search did not complete — here is what to try",
    html,
  });
}

export async function sendLimitReachedEmail(
  email: string,
  resetDate: string
): Promise<void> {
  const html = `
    <!DOCTYPE html>
    <html>
    <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
    <body style="margin:0;padding:0;background:#07070A;font-family:Arial,sans-serif;">
      <div style="max-width:520px;margin:0 auto;padding:40px 24px;">
        <div style="margin-bottom:32px;">
          <span style="background:#7C3AED;color:white;padding:6px 14px;border-radius:100px;font-size:12px;font-weight:700;letter-spacing:0.05em;">LEADTHUR</span>
        </div>
        <h1 style="color:#F4F4FF;font-size:28px;font-weight:800;margin:0 0 12px;line-height:1.2;">You have used all your searches</h1>
        <p style="color:#A1A1AA;font-size:15px;line-height:1.6;margin:0 0 24px;">
          You have reached your monthly search limit. Your searches will reset automatically on <strong style="color:#F4F4FF;">${resetDate}</strong>.
        </p>
        <div style="background:#0F0F14;border:1px solid rgba(124,58,237,0.2);border-radius:12px;padding:24px;margin-bottom:28px;">
          <p style="color:#F4F4FF;font-size:15px;font-weight:700;margin:0 0 8px;">Need more searches before your reset date?</p>
          <p style="color:#A1A1AA;font-size:14px;line-height:1.6;margin:0 0 16px;">
            Contact us on WhatsApp and we will increase your limit manually.
          </p>
          <a href="https://wa.me/2349067285890" style="display:inline-block;background:#25D366;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:700;font-size:14px;">
            WhatsApp Us — 09067285890
          </a>
        </div>
        <div style="background:#0F0F14;border:1px solid rgba(255,255,255,0.07);border-radius:12px;padding:20px;margin-bottom:28px;">
          <p style="color:#A1A1AA;font-size:13px;line-height:1.6;margin:0;">
            While you wait for your reset you can still view and export all results from your previous searches in your dashboard.
          </p>
        </div>
        <p style="color:#6B6B80;font-size:12px;line-height:1.6;margin:0;border-top:1px solid rgba(255,255,255,0.07);padding-top:20px;">
          LeadThur — Business Discovery Intelligence<br>Your searches reset on ${resetDate}.
        </p>
      </div>
    </body>
    </html>
  `;

  await sendEmail({
    to: email,
    subject: `Your LeadThur monthly searches have been used — reset on ${resetDate}`,
    html,
  });
}

