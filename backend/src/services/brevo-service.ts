import { config } from "../config/env";
import { logger } from "../utils/logger";

function buildEmailTemplate({
  title,
  preheader,
  body,
}: {
  title: string;
  preheader: string;
  body: string;
}): string {
  const frontendUrl = config.FRONTEND_URL.replace(/\/$/, "");

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>${title}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { background-color: #F4F4F8; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; -webkit-font-smoothing: antialiased; }
    .wrapper { width: 100%; background-color: #F4F4F8; padding: 40px 20px; }
    .container { max-width: 580px; margin: 0 auto; }
    .header { background-color: #7C3AED; border-radius: 16px 16px 0 0; padding: 28px 36px; display: flex; align-items: center; }
    .header-icon { width: 44px; height: 44px; background: rgba(255,255,255,0.15); border-radius: 10px; display: inline-flex; align-items: center; justify-content: center; margin-right: 14px; flex-shrink: 0; }
    .header-brand { display: inline-block; }
    .header-wordmark { font-size: 22px; font-weight: 700; color: white; line-height: 1; }
    .header-wordmark span { color: #C4B5FD; }
    .header-tagline { font-size: 9px; color: rgba(255,255,255,0.55); letter-spacing: 2.5px; text-transform: uppercase; margin-top: 4px; }
    .body { background-color: #FFFFFF; padding: 40px 36px; }
    .footer { background-color: #F0F0F6; border-radius: 0 0 16px 16px; padding: 24px 36px; text-align: center; border-top: 1px solid #E5E5EE; }
    .footer-brand { font-size: 13px; font-weight: 700; color: #1A1A2E; margin-bottom: 6px; }
    .footer-brand span { color: #7C3AED; }
    .footer-links { font-size: 12px; color: #888888; margin-bottom: 6px; }
    .footer-links a { color: #7C3AED; text-decoration: none; }
    .footer-links a:hover { text-decoration: underline; }
    .footer-copy { font-size: 11px; color: #BBBBBB; margin-top: 8px; }
    .btn { display: inline-block; padding: 14px 32px; border-radius: 10px; font-size: 15px; font-weight: 700; text-decoration: none; text-align: center; }
    .btn-primary { background-color: #7C3AED; color: white; }
    .btn-success { background-color: #10B981; color: white; }
    .info-box { background-color: #F8F8FB; border-radius: 12px; padding: 24px; margin: 24px 0; }
    .info-row { display: flex; justify-content: space-between; align-items: center; padding: 10px 0; border-bottom: 1px solid #EEEEEE; font-size: 14px; }
    .info-row:last-child { border-bottom: none; }
    .info-label { color: #888888; }
    .info-value { font-weight: 700; color: #1A1A2E; }
    .highlight-box { border-radius: 12px; padding: 16px 20px; margin: 20px 0; font-size: 13px; font-weight: 600; line-height: 1.6; }
    .highlight-success { background-color: #ECFDF5; border: 1px solid #A7F3D0; color: #065F46; }
    .highlight-purple { background-color: #F5F3FF; border: 1px solid #DDD6FE; color: #5B21B6; }
    .highlight-warning { background-color: #FFFBEB; border: 1px solid #FDE68A; color: #92400E; }
    h1 { font-size: 26px; font-weight: 800; color: #1A1A2E; letter-spacing: -0.5px; margin-bottom: 10px; line-height: 1.2; }
    h2 { font-size: 20px; font-weight: 700; color: #1A1A2E; margin-bottom: 8px; }
    p { font-size: 15px; color: #444444; line-height: 1.75; margin-bottom: 16px; }
    p:last-child { margin-bottom: 0; }
    .divider { height: 1px; background-color: #EEEEEE; margin: 28px 0; }
    .stat-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin: 20px 0; }
    .stat-card { background: #F8F8FB; border-radius: 10px; padding: 16px; text-align: center; }
    .stat-value { font-size: 28px; font-weight: 900; color: #7C3AED; letter-spacing: -1px; line-height: 1; margin-bottom: 4px; }
    .stat-label { font-size: 11px; color: #888888; }
    .stat-sub { font-size: 10px; color: #BBBBBB; margin-top: 2px; }
    @media (max-width: 480px) {
      .body { padding: 28px 20px; }
      .header { padding: 20px 24px; }
      .footer { padding: 20px 24px; }
      h1 { font-size: 22px; }
      .stat-grid { grid-template-columns: 1fr 1fr; }
    }
  </style>
</head>
<body>
  <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">${preheader}</div>

  <div class="wrapper">
    <div class="container">

      <div class="header">
        <div class="header-icon">
          <svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="14" cy="14" r="11" stroke="rgba(255,255,255,0.25)" stroke-width="1.5" fill="none"/>
            <circle cx="14" cy="14" r="7" stroke="rgba(255,255,255,0.4)" stroke-width="1.5" fill="none"/>
            <circle cx="14" cy="14" r="3.5" stroke="rgba(255,255,255,0.6)" stroke-width="1.5" fill="none"/>
            <circle cx="14" cy="14" r="1.5" fill="white"/>
            <line x1="14" y1="14" x2="21" y2="7" stroke="white" stroke-width="1.5" stroke-linecap="round"/>
            <circle cx="21" cy="7" r="2" fill="#C4B5FD"/>
          </svg>
        </div>
        <div class="header-brand">
          <div class="header-wordmark">Lead<span>Thur</span></div>
          <div class="header-tagline">Business Discovery</div>
        </div>
      </div>

      <div class="body">
        ${body}
      </div>

      <div class="footer">
        <div class="footer-brand">Lead<span>Thur</span></div>
        <div class="footer-links">
          <a href="https://wa.me/2349067285890">WhatsApp 09067285890</a>
          &nbsp;&middot;&nbsp;
          <a href="mailto:access@leadthur.com">access@leadthur.com</a>
          &nbsp;&middot;&nbsp;
          <a href="${frontendUrl}">leadthur.com</a>
        </div>
        <div class="footer-copy">&copy; ${new Date().getFullYear()} LeadThur. Business Discovery Intelligence.</div>
      </div>

    </div>
  </div>
</body>
</html>
  `;
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
  const frontendUrl = config.FRONTEND_URL.replace(/\/$/, "");

  const body = `
    <h1>Your account is ready.</h1>
    <p>Welcome to LeadThur. Your lifetime access is activated. You can now find business contacts in any city in the world in under 60 seconds.</p>

    <div class="info-box">
      <div class="info-row">
        <span class="info-label">Email</span>
        <span class="info-value">${email}</span>
      </div>
      <div class="info-row">
        <span class="info-label">License key</span>
        <span class="info-value" style="font-family:monospace;font-size:13px;">${licenseKey}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Access</span>
        <span class="info-value" style="color:#10B981;">Lifetime &mdash; no expiry</span>
      </div>
    </div>

    <p>Enter your license key on the activation page to log in. Keep it somewhere safe.</p>

    <div style="text-align:center;margin:28px 0;">
      <a href="${frontendUrl}/activate" class="btn btn-primary">
        Activate My Account &rarr;
      </a>
    </div>

    <div class="divider"></div>

    <p style="font-size:13px;color:#888888;">
      Questions? Reply to this email or reach us on WhatsApp <strong style="color:#1A1A2E;">09067285890</strong>. We respond within minutes.
    </p>
  `;

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
  const frontendUrl = config.FRONTEND_URL.replace(/\/$/, "");

  const body = `
    <div style="text-align:center;margin-bottom:24px;">
      <div style="font-size:44px;margin-bottom:12px;">&#127881;</div>
      <h1>You just earned $${commissionUsd.toFixed(2)}</h1>
      <p>Someone bought LeadThur through your referral link. Your commission has been added to your balance.</p>
    </div>

    <div class="stat-grid">
      <div class="stat-card">
        <div class="stat-value" style="color:#10B981;">$${commissionUsd.toFixed(2)}</div>
        <div class="stat-label">This commission</div>
        <div class="stat-sub">&#8358;${commissionNgn.toLocaleString()}</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">$${totalEarnedUsd.toFixed(2)}</div>
        <div class="stat-label">Total earned</div>
        <div class="stat-sub">&#8358;${totalEarnedNgn.toLocaleString()}</div>
      </div>
    </div>

    ${
      pendingNgn >= 7500
        ? `
    <div class="highlight-box highlight-success">
      &#10003; You have &#8358;${pendingNgn.toLocaleString()} pending. You can request a payout from your dashboard now.
    </div>
    `
        : `
    <div class="highlight-box highlight-purple">
      Keep sharing your link. One more referral and you can request your first payout.
    </div>
    `
    }

    <p>Every person who buys through your link earns you <strong>$7.50 (&#8358;7,500)</strong>. No cap on how much you can earn.</p>

    <div style="text-align:center;margin:28px 0;">
      <a href="${frontendUrl}/dashboard" class="btn btn-primary">
        View My Earnings &rarr;
      </a>
    </div>
  `;

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
  const frontendUrl = config.FRONTEND_URL.replace(/\/$/, "");

  const body = `
    <div style="text-align:center;margin-bottom:24px;">
      <div style="font-size:44px;margin-bottom:12px;">&#127968;</div>
      <h1>Payout request received</h1>
      <p>We have received your payout request and it is being processed. Expect your money within 24 hours.</p>
    </div>

    <div class="info-box">
      <div class="info-row">
        <span class="info-label">Amount</span>
        <span class="info-value">&#8358;${amountNgn.toLocaleString()} <span style="color:#888;font-weight:400;font-size:13px;">($${amountUsd.toFixed(2)})</span></span>
      </div>
      <div class="info-row">
        <span class="info-label">Account name</span>
        <span class="info-value">${accountName}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Bank</span>
        <span class="info-value">${bankName}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Status</span>
        <span class="info-value" style="color:#FBBF24;">Processing</span>
      </div>
    </div>

    <p>Keep sharing your referral link while you wait. Every new referral adds to your next payout. There is no limit to how much you can earn.</p>

    <div style="text-align:center;margin:28px 0;">
      <a href="${frontendUrl}/dashboard" class="btn btn-primary">
        View My Dashboard &rarr;
      </a>
    </div>
  `;

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
  const frontendUrl = config.FRONTEND_URL.replace(/\/$/, "");

  const body = `
    <div style="text-align:center;margin-bottom:24px;">
      <div style="font-size:44px;margin-bottom:12px;">&#128184;</div>
      <h1>Your money is on the way</h1>
      <p>Your payout has been processed and the transfer has been initiated to your bank account. Check your account within a few hours.</p>
    </div>

    <div class="info-box" style="background:#ECFDF5;border:1px solid #A7F3D0;">
      <div class="info-row" style="border-color:#D1FAE5;">
        <span class="info-label" style="color:#065F46;">Amount paid</span>
        <span class="info-value" style="color:#065F46;font-size:20px;">&#8358;${amountNgn.toLocaleString()}</span>
      </div>
      <div class="info-row" style="border-color:#D1FAE5;">
        <span class="info-label">Account name</span>
        <span class="info-value">${accountName}</span>
      </div>
      <div class="info-row" style="border-color:#D1FAE5;">
        <span class="info-label">Bank</span>
        <span class="info-value">${bankName}</span>
      </div>
      <div class="info-row" style="border-color:transparent;">
        <span class="info-label">Account number</span>
        <span class="info-value" style="font-family:monospace;">${accountNumber}</span>
      </div>
    </div>

    <p>Thank you for promoting LeadThur. Keep sharing your referral link and you can request your next payout anytime your balance reaches &#8358;7,500. There is no limit on how much you can earn.</p>

    <div style="text-align:center;margin:28px 0;">
      <a href="${frontendUrl}/dashboard" class="btn btn-success">
        View My Dashboard &rarr;
      </a>
    </div>
  `;

  const html = buildEmailTemplate({
    title: `Your ₦${amountNgn.toLocaleString()} payout has been sent — LeadThur`,
    preheader: `Your payout of ₦${amountNgn.toLocaleString()} to ${bankName} has been sent.`,
    body,
  });

  await sendEmail({
    to: email,
    subject: `Your ₦${amountNgn.toLocaleString()} payout has been sent — LeadThur`,
    html,
  });
}

export async function sendDomainChangeEmail(email: string): Promise<void> {
  const frontendUrl = config.FRONTEND_URL.replace(/\/$/, "");

  const body = `
    <h1>We have a new name and a new home.</h1>

    <p>Quick update from us. LeadPilot has moved to a new domain and a new name. Everything works exactly the same. Nothing has changed about your account or access.</p>

    <div class="info-box">
      <div class="info-row">
        <span class="info-label">Old name</span>
        <span class="info-value" style="text-decoration:line-through;color:#888;">LeadPilot</span>
      </div>
      <div class="info-row">
        <span class="info-label">New name</span>
        <span class="info-value" style="color:#7C3AED;">LeadThur</span>
      </div>
      <div class="info-row">
        <span class="info-label">Old address</span>
        <span class="info-value" style="text-decoration:line-through;color:#888;">leadpilot.live</span>
      </div>
      <div class="info-row">
        <span class="info-label">New address</span>
        <span class="info-value" style="color:#7C3AED;">leadthur.com</span>
      </div>
    </div>

    <div class="highlight-box highlight-purple">
      Why the change? We discovered LeadPilot is already a registered brand name belonging to another company. Rather than risk any legal issues, we made the switch early and cleanly.
    </div>

    <p>Your dashboard is now at <a href="${frontendUrl}/dashboard" style="color:#7C3AED;font-weight:600;">leadthur.com/dashboard</a> and your login page is at <a href="${frontendUrl}/activate" style="color:#7C3AED;font-weight:600;">leadthur.com/activate</a>.</p>

    <p>If you visit the old address it will automatically redirect you to the new one, so your bookmarks will still work.</p>

    <div style="text-align:center;margin:28px 0;">
      <a href="${frontendUrl}/dashboard" class="btn btn-primary">
        Go to My Dashboard &rarr;
      </a>
    </div>

    <div class="divider"></div>

    <p style="font-size:13px;color:#888888;">
      Questions? Reach us on WhatsApp <strong style="color:#1A1A2E;">09067285890</strong> and we will sort you out immediately.
    </p>
  `;

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

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function sendAdminMessage(
  email: string,
  subject: string,
  message: string
): Promise<void> {
  const safeSubject = escapeHtml(subject);
  const safeMessage = escapeHtml(message);
  const preheader = message.replace(/\s+/g, " ").trim().slice(0, 120);

  const body = `
    <h1>${safeSubject}</h1>
    <div style="font-size:15px;color:#444444;line-height:1.8;white-space:pre-wrap;border-left:3px solid #7C3AED;padding-left:16px;margin-top:8px;">
      ${safeMessage}
    </div>
  `;

  const html = buildEmailTemplate({
    title: safeSubject,
    preheader: preheader || safeSubject,
    body,
  });

  await sendEmail({
    to: email,
    subject,
    html,
  });
}
