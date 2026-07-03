import { Resend } from "resend";
import { COMMISSION_NGN, COMMISSION_USD, MIN_PAYOUT_NGN } from "../constants/pricing";
import { config } from "../config/env";
import { displayCityFromLocation } from "../scraper/googleMaps/grid-search";
import { logger } from "../utils/logger";
import { sendViaZeptoMail, type EmailSendResult } from "./zeptomail";

let resendClient: Resend | null = null;

function getResendClient(): Resend | null {
  const key = process.env.RESEND_API_KEY?.trim();
  if (!key) return null;
  if (!resendClient) resendClient = new Resend(key);
  return resendClient;
}

// Transactional email — ZeptoMail primary (Coolify env), Resend fallback.
const FROM = process.env.EMAIL_FROM || "access@leadthur.com";

async function sendViaResend(params: {
  to: string;
  subject: string;
  html: string;
}): Promise<EmailSendResult> {
  const resend = getResendClient();
  if (!resend) {
    return { success: false, error: "Resend is not configured" };
  }

  try {
    const { error } = await resend.emails.send({
      from: FROM,
      to: params.to,
      subject: params.subject,
      html: params.html,
    });

    if (error) {
      logger.error("Resend send failed", {
        to: params.to,
        subject: params.subject,
        error: error.message,
      });
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err) {
    const error = err instanceof Error ? err.message : "unknown error";
    logger.error("Resend send failed", {
      to: params.to,
      subject: params.subject,
      error,
    });
    return { success: false, error };
  }
}

export async function sendEmail(params: {
  to: string;
  subject: string;
  html: string;
  replyTo?: string;
  toName?: string;
}): Promise<boolean> {
  const zeptoResult = await sendViaZeptoMail({
    to: params.to,
    subject: params.subject,
    htmlBody: params.html,
    replyTo: params.replyTo,
    toName: params.toName,
  });

  if (zeptoResult.success) {
    return true;
  }

  logger.warn("ZeptoMail send failed, falling back to Resend", {
    to: params.to,
    subject: params.subject,
    error: zeptoResult.success ? undefined : zeptoResult.error,
  });

  const resendResult = await sendViaResend({
    to: params.to,
    subject: params.subject,
    html: params.html,
  });

  if (resendResult.success) {
    return true;
  }

  logger.error("Email send failed", {
    to: params.to,
    subject: params.subject,
    error: resendResult.success ? undefined : resendResult.error,
  });
  return false;
}

const baseStyle = `
  font-family: Inter, -apple-system, sans-serif;
  max-width: 520px;
  margin: 0 auto;
  padding: 40px 32px;
  background: #06060A;
  color: #F0EEFF;
  border-radius: 16px;
`;

const btnStyle = `
  display: block;
  background: #7C3AED;
  color: #ffffff;
  text-align: center;
  padding: 14px 24px;
  border-radius: 10px;
  text-decoration: none;
  font-weight: 700;
  font-size: 15px;
  margin: 24px 0 16px;
`;

const mutedStyle = `font-size: 12px; color: #555575; line-height: 1.7;`;

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

function wrapper(body: string): string {
  return `
    <!DOCTYPE html>
    <html>
    <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
    <body style="margin:0;padding:24px;background:#0A0812">
      <div style="${baseStyle}">
        <div style="margin-bottom:28px">
          <span style="background:#7C3AED;color:#fff;padding:6px 12px;border-radius:6px;font-size:13px;font-weight:800;letter-spacing:0.05em">LeadThur</span>
        </div>
        ${body}
        <hr style="border:none;border-top:1px solid rgba(255,255,255,0.07);margin:28px 0">
        <p style="${mutedStyle}">Questions? WhatsApp us on <strong style="color:#F0EEFF">09067285890</strong>. We respond fast.<br>LeadThur by Pdigital Marketstore Ltd.</p>
      </div>
    </body>
    </html>
  `;
}

async function deliver(params: { to: string; subject: string; html: string }): Promise<void> {
  try {
    await sendEmail(params);
  } catch (err) {
    logger.error("Unexpected email delivery error", {
      to: params.to,
      subject: params.subject,
      error: err instanceof Error ? err.message : "unknown",
    });
  }
}

export async function sendAccessEmail(to: string, licenseKey: string): Promise<void> {
  const html = wrapper(`
    <h1 style="font-size:26px;font-weight:900;letter-spacing:-0.5px;margin:0 0 8px">You are in. 🎉</h1>
    <p style="color:#7878A0;margin:0 0 28px;line-height:1.7">Your lifetime access to LeadThur is now active. Here is your license key.</p>
    <div style="background:#111118;border:1px solid rgba(167,139,250,0.2);border-radius:10px;padding:20px;margin-bottom:28px">
      <div style="font-size:10px;color:#7878A0;text-transform:uppercase;letter-spacing:2px;margin-bottom:10px;font-weight:700">Your License Key</div>
      <div style="font-size:20px;font-weight:800;color:#A78BFA;letter-spacing:3px;word-break:break-all">${escapeHtml(licenseKey)}</div>
    </div>
    <p style="color:#7878A0;margin:0 0 4px;line-height:1.7">Go to your dashboard, enter this key, and start your first search. Type any business type and any city. 1,000+ contacts back in 60 seconds.</p>
    <a href="https://leadthur.com/dashboard" style="${btnStyle}">Go to your dashboard →</a>
    <p style="${mutedStyle}">If you have any trouble activating, send us a message on WhatsApp immediately and we will sort it out.</p>
  `);

  await deliver({
    to,
    subject: "Your LeadThur access is ready",
    html,
  });
}

export async function sendWelcomeEmail(to: string): Promise<void> {
  const html = wrapper(`
    <h1 style="font-size:26px;font-weight:900;letter-spacing:-0.5px;margin:0 0 8px">Welcome to LeadThur.</h1>
    <p style="color:#7878A0;margin:0 0 28px;line-height:1.7">You now have access to 1,000+ business contacts in any city in the world. Here is how to get your first list in the next 60 seconds.</p>
    <div style="margin-bottom:28px">
      <div style="display:flex;gap:14px;margin-bottom:18px;align-items:flex-start">
        <div style="width:30px;height:30px;min-width:30px;background:rgba(124,58,237,0.15);border:1px solid rgba(124,58,237,0.25);border-radius:8px;text-align:center;line-height:30px;font-weight:800;color:#A78BFA">1</div>
        <div><strong style="color:#F0EEFF;display:block;margin-bottom:3px">Type any business type</strong><span style="color:#7878A0;font-size:13px">Restaurants, salons, law firms, gyms, real estate agencies. Anything.</span></div>
      </div>
      <div style="display:flex;gap:14px;margin-bottom:18px;align-items:flex-start">
        <div style="width:30px;height:30px;min-width:30px;background:rgba(124,58,237,0.15);border:1px solid rgba(124,58,237,0.25);border-radius:8px;text-align:center;line-height:30px;font-weight:800;color:#A78BFA">2</div>
        <div><strong style="color:#F0EEFF;display:block;margin-bottom:3px">Type any city in the world</strong><span style="color:#7878A0;font-size:13px">Lagos, London, Dubai, New York, Nairobi, Accra. 195 countries covered.</span></div>
      </div>
      <div style="display:flex;gap:14px;align-items:flex-start">
        <div style="width:30px;height:30px;min-width:30px;background:rgba(124,58,237,0.15);border:1px solid rgba(124,58,237,0.25);border-radius:8px;text-align:center;line-height:30px;font-weight:800;color:#A78BFA">3</div>
        <div><strong style="color:#F0EEFF;display:block;margin-bottom:3px">Export and start pitching</strong><span style="color:#7878A0;font-size:13px">One click downloads your entire list as a clean spreadsheet. Start the same day.</span></div>
      </div>
    </div>
    <a href="https://leadthur.com/dashboard" style="${btnStyle}">Start your first search →</a>
    <p style="${mutedStyle}">One payment. No monthly fees. No renewal. LeadThur is yours forever.</p>
  `);

  await deliver({
    to,
    subject: "Start finding clients in 60 seconds",
    html,
  });
}

export async function sendPaymentConfirmationEmail(to: string, amount: string): Promise<void> {
  const html = wrapper(`
    <h1 style="font-size:26px;font-weight:900;letter-spacing:-0.5px;margin:0 0 8px">Payment confirmed. ✓</h1>
    <p style="color:#7878A0;margin:0 0 28px;line-height:1.7">We received your payment and your LeadThur lifetime access is now active.</p>
    <div style="background:#111118;border:1px solid rgba(16,185,129,0.2);border-radius:10px;padding:20px;margin-bottom:28px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;padding-bottom:10px;border-bottom:1px solid rgba(255,255,255,0.05)">
        <span style="color:#7878A0;font-size:13px">Product</span>
        <span style="color:#F0EEFF;font-weight:700;font-size:13px">LeadThur Lifetime Access</span>
      </div>
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;padding-bottom:10px;border-bottom:1px solid rgba(255,255,255,0.05)">
        <span style="color:#7878A0;font-size:13px">Amount paid</span>
        <span style="color:#10B981;font-weight:800;font-size:15px">${escapeHtml(amount)}</span>
      </div>
      <div style="display:flex;justify-content:space-between;align-items:center">
        <span style="color:#7878A0;font-size:13px">Access</span>
        <span style="color:#10B981;font-weight:700;font-size:13px">Lifetime. No renewal.</span>
      </div>
    </div>
    <a href="https://leadthur.com/dashboard" style="${btnStyle}">Go to your dashboard →</a>
    <p style="${mutedStyle}">Keep this email for your records. If you ever need support, WhatsApp 09067285890.</p>
  `);

  await deliver({
    to,
    subject: "Payment confirmed — LeadThur lifetime access activated",
    html,
  });
}

export async function sendPasswordResetEmail(to: string, resetLink: string): Promise<void> {
  const html = wrapper(`
    <h1 style="font-size:26px;font-weight:900;letter-spacing:-0.5px;margin:0 0 8px">Reset your password</h1>
    <p style="color:#7878A0;margin:0 0 28px;line-height:1.7">We received a request to reset your LeadThur password. Click the button below to set a new one. This link expires in 1 hour.</p>
    <a href="${escapeHtml(resetLink)}" style="${btnStyle}">Reset my password →</a>
    <p style="${mutedStyle}">If you did not request a password reset, ignore this email. Your account is safe.</p>
  `);

  await deliver({
    to,
    subject: "Reset your LeadThur password",
    html,
  });
}

export async function sendTrialWelcomeEmail(to: string): Promise<void> {
  const html = wrapper(`
    <h1 style="font-size:26px;font-weight:900;letter-spacing:-0.5px;margin:0 0 8px">Your free trial is ready.</h1>
    <p style="color:#7878A0;margin:0 0 28px;line-height:1.7">You have two free searches on LeadThur. No card. No commitment. See exactly what you get before deciding anything.</p>
    <div style="background:#111118;border:1px solid rgba(124,58,237,0.2);border-radius:10px;padding:20px;margin-bottom:28px">
      <div style="font-size:13px;color:#C0C0D8;margin-bottom:8px">✓ &nbsp;Type any business type and city</div>
      <div style="font-size:13px;color:#C0C0D8;margin-bottom:8px">✓ &nbsp;See 1,000+ results stream in live</div>
      <div style="font-size:13px;color:#C0C0D8">✓ &nbsp;No card needed for the trial</div>
    </div>
    <a href="https://leadthur.com/dashboard" style="${btnStyle}">Start my free trial →</a>
    <p style="${mutedStyle}">After your two free searches, lifetime access is a one-time payment. No subscriptions.</p>
  `);

  await deliver({
    to,
    subject: "Your LeadThur free trial is ready",
    html,
  });
}

export async function sendDirectEmailHtml({
  to,
  subject,
  html,
}: {
  to: string;
  subject: string;
  html: string;
}): Promise<void> {
  await deliver({ to, subject, html });
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
    .map(
      (para) =>
        `<p style="color:#7878A0;margin:0 0 16px;line-height:1.7">${escapeHtml(para).replace(/\n/g, "<br>")}</p>`
    )
    .join("");

  const html = wrapper(`
    ${paragraphs}
    <p style="${mutedStyle}">This message was sent from the LeadThur team.</p>
  `);

  await deliver({ to, subject, html });
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
  const pendingNote =
    pendingNgn >= MIN_PAYOUT_NGN
      ? `You have ₦${pendingNgn.toLocaleString()} pending. Request a payout from your dashboard now.`
      : "Keep sharing your link. One more referral and you can request your first payout.";

  const html = wrapper(`
    <h1 style="font-size:26px;font-weight:900;letter-spacing:-0.5px;margin:0 0 8px">You just earned $${commissionUsd.toFixed(2)} 🎉</h1>
    <p style="color:#7878A0;margin:0 0 28px;line-height:1.7">Someone bought LeadThur through your referral link. Your commission has been added to your balance.</p>
    <div style="background:#111118;border:1px solid rgba(16,185,129,0.2);border-radius:10px;padding:20px;margin-bottom:28px">
      <div style="color:#10B981;font-size:28px;font-weight:900;margin-bottom:6px">$${commissionUsd.toFixed(2)}</div>
      <div style="color:#7878A0;font-size:13px;margin-bottom:16px">₦${commissionNgn.toLocaleString()} this commission</div>
      <div style="color:#A78BFA;font-size:18px;font-weight:800">$${totalEarnedUsd.toFixed(2)} total earned</div>
      <div style="color:#7878A0;font-size:13px">₦${totalEarnedNgn.toLocaleString()} lifetime</div>
    </div>
    <p style="color:#C0C0D8;margin:0 0 24px;line-height:1.7">${escapeHtml(pendingNote)}</p>
    <p style="color:#7878A0;margin:0 0 24px;line-height:1.7">Every referral earns you <strong style="color:#F0EEFF">$${COMMISSION_USD.toFixed(2)} (₦${COMMISSION_NGN.toLocaleString()})</strong>.</p>
    <a href="${getFrontendUrl()}/dashboard" style="${btnStyle}">View my earnings →</a>
  `);

  await deliver({
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
  const html = wrapper(`
    <h1 style="font-size:26px;font-weight:900;letter-spacing:-0.5px;margin:0 0 8px">Payout request received</h1>
    <p style="color:#7878A0;margin:0 0 28px;line-height:1.7">We have received your payout request and it is being processed. Expect your money within 24 hours.</p>
    <div style="background:#111118;border:1px solid rgba(255,255,255,0.07);border-radius:10px;padding:20px;margin-bottom:28px">
      <div style="color:#F0EEFF;font-weight:700;margin-bottom:8px">₦${amountNgn.toLocaleString()} ($${amountUsd.toFixed(2)})</div>
      <div style="color:#7878A0;font-size:13px;margin-bottom:4px">${escapeHtml(accountName)}</div>
      <div style="color:#7878A0;font-size:13px">${escapeHtml(bankName)}</div>
    </div>
    <a href="${getFrontendUrl()}/dashboard" style="${btnStyle}">View my dashboard →</a>
  `);

  await deliver({
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
  const html = wrapper(`
    <h1 style="font-size:26px;font-weight:900;letter-spacing:-0.5px;margin:0 0 8px">Your money is on the way 💸</h1>
    <p style="color:#7878A0;margin:0 0 28px;line-height:1.7">Your payout has been processed and the transfer has been initiated to your bank account.</p>
    <div style="background:#111118;border:1px solid rgba(16,185,129,0.2);border-radius:10px;padding:20px;margin-bottom:28px">
      <div style="color:#10B981;font-size:24px;font-weight:900;margin-bottom:12px">₦${amountNgn.toLocaleString()}</div>
      <div style="color:#7878A0;font-size:13px;margin-bottom:4px">${escapeHtml(accountName)} · ${escapeHtml(bankName)}</div>
      <div style="color:#7878A0;font-size:13px;font-family:monospace">${escapeHtml(accountNumber)}</div>
    </div>
    <p style="color:#7878A0;margin:0 0 24px;line-height:1.7">($${amountUsd.toFixed(2)} USD equivalent)</p>
    <a href="${getFrontendUrl()}/dashboard" style="${btnStyle}">View my dashboard →</a>
  `);

  await deliver({
    to: email,
    subject: `Your ₦${amountNgn.toLocaleString()} payout has been sent — LeadThur`,
    html,
  });
}

export async function sendDomainChangeEmail(email: string): Promise<void> {
  const html = wrapper(`
    <h1 style="font-size:26px;font-weight:900;letter-spacing:-0.5px;margin:0 0 8px">We have a new name and a new home.</h1>
    <p style="color:#7878A0;margin:0 0 28px;line-height:1.7">LeadPilot has moved to LeadThur. Everything works the same. Your account and access are unchanged.</p>
    <div style="background:#111118;border:1px solid rgba(124,58,237,0.2);border-radius:10px;padding:20px;margin-bottom:28px">
      <div style="color:#7878A0;font-size:13px;margin-bottom:8px">New home: <strong style="color:#A78BFA">leadthur.com</strong></div>
      <div style="color:#7878A0;font-size:13px">Old address redirects automatically.</div>
    </div>
    <a href="${getFrontendUrl()}/dashboard" style="${btnStyle}">Go to my dashboard →</a>
  `);

  await deliver({
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
  const html = wrapper(`
    <h1 style="font-size:26px;font-weight:900;letter-spacing:-0.5px;margin:0 0 8px">Your results are ready</h1>
    <p style="color:#7878A0;margin:0 0 28px;line-height:1.7">Your search for <strong style="color:#F0EEFF">${escapeHtml(query)}</strong> in <strong style="color:#F0EEFF">${escapeHtml(location)}</strong> is complete.</p>
    <div style="background:#111118;border:1px solid rgba(167,139,250,0.2);border-radius:10px;padding:24px;margin-bottom:28px;text-align:center">
      <div style="font-size:48px;font-weight:900;color:#A78BFA;line-height:1">${totalFound}</div>
      <div style="color:#7878A0;font-size:14px;margin-top:8px">businesses found with contact details</div>
    </div>
    <a href="${getFrontendUrl()}/dashboard" style="${btnStyle}">View my results →</a>
  `);

  await deliver({
    to: email,
    subject: `Your search found ${totalFound} businesses — LeadThur`,
    html,
  });
}

function resultsEmailWrapper(body: string, email: string): string {
  const unsubscribeUrl = getUnsubscribeUrl(email);
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    body { margin: 0; padding: 0; background: #f4f4f5; font-family: Inter, -apple-system, 'Segoe UI', sans-serif; }
    .wrap { max-width: 560px; margin: 32px auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 4px rgba(0,0,0,0.08); }
    .header { padding: 28px 40px 20px; border-bottom: 1px solid #f0f0f0; }
    .logo { font-size: 18px; font-weight: 800; color: #09090b; letter-spacing: -0.5px; }
    .logo span { color: #7C3AED; }
    .body { padding: 36px 40px; }
    p { font-size: 15px; color: #18181b; line-height: 1.75; margin: 0 0 16px; }
    .btn { display: block; background: #7C3AED; color: #ffffff !important; text-align: center; padding: 16px 24px; border-radius: 10px; text-decoration: none; font-weight: 700; font-size: 16px; margin: 28px 0 8px; }
    .footer { padding: 20px 40px 28px; border-top: 1px solid #f0f0f0; }
    .footer p { font-size: 12px; color: #a1a1aa; line-height: 1.6; margin: 0; }
    .footer a { color: #7C3AED; text-decoration: none; }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="header">
      <div class="logo">Lead<span>Thur</span></div>
    </div>
    <div class="body">
      ${body}
    </div>
    <div class="footer">
      <p><a href="${unsubscribeUrl}">Unsubscribe</a> · LeadThur by Pdigital Marketstore Ltd</p>
    </div>
  </div>
</body>
</html>`;
}

export interface SearchResultsEmailStats {
  total: number;
  withPhone: number;
  withEmail: number;
  withWebsite: number;
}

export async function sendSearchResultsReadyEmail(
  email: string,
  searchId: string,
  _query: string,
  location: string,
  stats: SearchResultsEmailStats,
  options?: { timedOut?: boolean; skipEmailScraping?: boolean }
): Promise<void> {
  const resultsUrl = `${getFrontendUrl()}/dashboard/search/${searchId}`;
  const city = displayCityFromLocation(location);
  const countLabel = stats.total.toLocaleString("en-US");

  const skipEmailNote = options?.skipEmailScraping
    ? `<p style="color:#7878A0;margin:0 0 20px;line-height:1.7">Email addresses were not scraped for this search because server resources were limited. Phone numbers, websites, and addresses are ready now. Run this search again later for email coverage.</p>`
    : "";

  const body = `
    <p>Good news. We just finished searching ${escapeHtml(city)} for you and found ${countLabel} potential clients ready for you to reach out to.</p>
    ${skipEmailNote}
    <p>These are real businesses with direct contact details. The sooner you reach out the better your chances of landing them before anyone else does.</p>
    <a href="${resultsUrl}" class="btn">View my ${countLabel} potential clients</a>
  `;

  await deliver({
    to: email,
    subject: `we found ${countLabel} potential clients for you in ${city}`,
    html: resultsEmailWrapper(body, email),
  });
}

export async function sendSearchRunningEmail(
  email: string,
  query: string,
  location: string
): Promise<void> {
  const html = wrapper(`
    <h1 style="font-size:26px;font-weight:900;letter-spacing:-0.5px;margin:0 0 8px">Still searching. Hang tight.</h1>
    <p style="color:#7878A0;margin:0 0 28px;line-height:1.7">Your search for <strong style="color:#F0EEFF">${escapeHtml(query)}</strong> in <strong style="color:#F0EEFF">${escapeHtml(location)}</strong> is taking a bit longer than usual.</p>
    <p style="color:#7878A0;margin:0 0 24px;line-height:1.7">You do not need to keep the page open. Your results will be saved to your dashboard when the search finishes.</p>
    <a href="${getFrontendUrl()}/dashboard" style="${btnStyle}">Go to dashboard →</a>
  `);

  await deliver({
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
  const html = wrapper(`
    <h1 style="font-size:26px;font-weight:900;letter-spacing:-0.5px;margin:0 0 8px">Search did not complete</h1>
    <p style="color:#7878A0;margin:0 0 28px;line-height:1.7">Your search for <strong style="color:#F0EEFF">${escapeHtml(query)}</strong> in <strong style="color:#F0EEFF">${escapeHtml(location)}</strong> did not return results this time.</p>
    <p style="color:#7878A0;margin:0 0 24px;line-height:1.7">Try a broader location, a more common business type, or wait a few minutes and try again. This search has not been counted against your monthly limit.</p>
    <a href="${getFrontendUrl()}/dashboard" style="${btnStyle}">Try another search →</a>
  `);

  await deliver({
    to: email,
    subject: "Your LeadThur search did not complete — here is what to try",
    html,
  });
}

export async function sendSearchQueueFailureEmail(
  email: string,
  query: string,
  location: string
): Promise<void> {
  const html = resultsEmailWrapper(
    `
    <h1>Your search ran into a problem</h1>
    <p>We could not finish your search for <strong>${escapeHtml(query)}</strong> in <strong>${escapeHtml(location)}</strong> this time.</p>
    <p>Please try again in a few minutes. If the problem continues, try a broader city or business type.</p>
    <a href="${getFrontendUrl()}/dashboard" class="btn">Try another search →</a>
  `,
    email
  );

  await deliver({
    to: email,
    subject: "your search ran into a problem, please try again",
    html,
  });
}

export async function sendLimitReachedEmail(email: string, resetDate: string): Promise<void> {
  const html = wrapper(`
    <h1 style="font-size:26px;font-weight:900;letter-spacing:-0.5px;margin:0 0 8px">Search limit reached</h1>
    <p style="color:#7878A0;margin:0 0 28px;line-height:1.7">You have used all your searches for this billing period. Upgrade from your dashboard to continue, or wait until your limit resets on <strong style="color:#F0EEFF">${escapeHtml(resetDate)}</strong>.</p>
    <a href="${getFrontendUrl()}/dashboard" style="${btnStyle}">Upgrade on dashboard →</a>
  `);

  await deliver({
    to: email,
    subject: "Your LeadThur search limit has been reached",
    html,
  });
}

export async function sendTopUpConfirmationEmail({
  email,
  credits,
  amountNgn,
}: {
  email: string;
  credits: number;
  amountNgn: number;
}): Promise<void> {
  const html = wrapper(`
    <h1 style="font-size:26px;font-weight:900;letter-spacing:-0.5px;margin:0 0 8px">Top up confirmed ✓</h1>
    <p style="color:#7878A0;margin:0 0 28px;line-height:1.7">Your search credits have been added to your account.</p>
    <div style="background:#111118;border:1px solid rgba(16,185,129,0.2);border-radius:10px;padding:20px;margin-bottom:28px">
      <div style="display:flex;justify-content:space-between;margin-bottom:10px">
        <span style="color:#7878A0;font-size:13px">Credits added</span>
        <span style="color:#F0EEFF;font-weight:700">${credits}</span>
      </div>
      <div style="display:flex;justify-content:space-between">
        <span style="color:#7878A0;font-size:13px">Amount paid</span>
        <span style="color:#10B981;font-weight:800">₦${amountNgn.toLocaleString()}</span>
      </div>
    </div>
    <a href="${getFrontendUrl()}/dashboard" style="${btnStyle}">Back to dashboard →</a>
  `);

  await deliver({
    to: email,
    subject: "Your search credits have been added",
    html,
  });
}

function getUnsubscribeUrl(email: string): string {
  const frontend = getFrontendUrl();
  const backend = frontend.includes("staging.leadthur")
    ? "https://staging-backend.leadthur.com"
    : "https://backend.leadthur.com";
  return `${backend}/unsubscribe?email=${encodeURIComponent(email)}`;
}

function getTrialEmailOpenedUrl(email: string, step: number): string {
  const frontend = getFrontendUrl();
  const backend = frontend.includes("staging.leadthur")
    ? "https://staging-backend.leadthur.com"
    : "https://backend.leadthur.com";
  return `${backend}/trial/email-opened?email=${encodeURIComponent(email)}&step=${step}`;
}

function trialEmailWrapper(body: string, email: string, step?: number): string {
  const unsubscribeUrl = getUnsubscribeUrl(email);
  const openedUrl = step ? getTrialEmailOpenedUrl(email, step) : null;
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <style>
    body { margin: 0; padding: 0; background: #f4f4f5; font-family: -apple-system, 'Segoe UI', Inter, sans-serif; }
    .wrap { max-width: 560px; margin: 32px auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 4px rgba(0,0,0,0.08); }
    .header { padding: 28px 40px 20px; border-bottom: 1px solid #f0f0f0; }
    .logo { font-size: 18px; font-weight: 800; color: #09090b; letter-spacing: -0.5px; }
    .logo span { color: #7C3AED; }
    .body { padding: 36px 40px; }
    h1 { font-size: 22px; font-weight: 800; color: #09090b; margin: 0 0 16px; line-height: 1.3; letter-spacing: -0.3px; }
    p { font-size: 15px; color: #3f3f46; line-height: 1.75; margin: 0 0 16px; }
    .highlight { background: #faf5ff; border-left: 3px solid #7C3AED; padding: 14px 18px; border-radius: 0 8px 8px 0; margin: 20px 0; font-size: 14px; color: #3f3f46; line-height: 1.7; }
    .btn { display: block; background: #7C3AED; color: #ffffff !important; text-align: center; padding: 15px 24px; border-radius: 10px; text-decoration: none; font-weight: 700; font-size: 15px; margin: 28px 0 8px; }
    .btn-ghost { display: block; text-align: center; padding: 12px 24px; border-radius: 10px; text-decoration: none; font-weight: 600; font-size: 14px; color: #7C3AED !important; border: 1.5px solid #7C3AED; margin-bottom: 24px; }
    .footer { padding: 20px 40px 28px; border-top: 1px solid #f0f0f0; }
    .footer p { font-size: 12px; color: #a1a1aa; line-height: 1.6; margin: 0; }
    .footer a { color: #7C3AED; text-decoration: none; }
    .sig { margin-top: 24px; padding-top: 20px; border-top: 1px solid #f4f4f5; font-size: 14px; color: #3f3f46; }
    .sig strong { color: #09090b; display: block; margin-bottom: 2px; }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="header">
      <div class="logo">Lead<span>Thur</span></div>
    </div>
    <div class="body">
      ${body}
    </div>
    <div class="footer">
      <p>You are receiving this because you signed up for a LeadThur free trial.<br>
      <a href="${unsubscribeUrl}">Unsubscribe</a> · LeadThur by Pdigital Marketstore Ltd</p>
      ${openedUrl ? `<img src="${openedUrl}" alt="" width="1" height="1" style="display:block;opacity:0;width:1px;height:1px;border:0;margin-top:4px" />` : ""}
    </div>
  </div>
</body>
</html>`;
}

export async function sendTrialEmail(email: string, step: number): Promise<void> {
  const { getTrialEmailBody, TRIAL_EMAIL_SUBJECTS } = await import("./trial-email-content");
  const subject = TRIAL_EMAIL_SUBJECTS[step];
  const body = getTrialEmailBody(step);
  if (!subject || !body) {
    throw new Error(`Invalid trial email step: ${step}`);
  }

  const html = trialEmailWrapper(body, email, step);
  await deliver({ to: email, subject, html });
}

function formatBroadcastBody(body: string): string {
  const lines = body
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const htmlLines = lines.map((line) => `<p>${escapeHtml(line)}</p>`).join("");
  return `${htmlLines}<a href="https://leadthur.com" class="btn">Open LeadThur</a><div class="sig"><strong>Bamidele</strong>Founder, LeadThur</div>`;
}

export async function sendTrialBroadcastEmail(
  email: string,
  subject: string,
  body: string
): Promise<void> {
  const html = trialEmailWrapper(formatBroadcastBody(body), email);
  await deliver({ to: email, subject, html });
}
