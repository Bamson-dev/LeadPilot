import { config } from "../config/env";
import { MIN_PAYOUT_NGN } from "../constants/pricing";
import { logger } from "../utils/logger";

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
      sender: { email: config.BREVO_SENDER_EMAIL, name: "LeadPilot" },
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

export async function sendCommissionNotification(
  referrerEmail: string,
  _referredEmail: string,
  commissionNgn: number,
  commissionUsd: number,
  totalEarnedNgn: number,
  totalEarnedUsd: number,
  pendingNgn: number
): Promise<void> {
  const dashboardUrl = `${config.FRONTEND_URL.replace(/\/$/, "")}/dashboard`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin:0;padding:0;background:#F4F4F8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;">
      <div style="max-width:560px;margin:0 auto;padding:40px 20px;">

        <div style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 2px 20px rgba(0,0,0,0.06);">

          <div style="background:#7C3AED;padding:24px 32px;">
            <div style="display:flex;align-items:center;gap:12px;">
              <div style="width:34px;height:34px;background:rgba(255,255,255,0.2);border-radius:8px;display:inline-flex;align-items:center;justify-content:center;">
                <span style="color:white;font-size:12px;font-weight:800;">LP</span>
              </div>
              <span style="font-size:18px;font-weight:800;color:white;letter-spacing:-0.5px;">LeadPilot</span>
            </div>
          </div>

          <div style="padding:36px 32px;text-align:center;">
            <div style="font-size:48px;margin-bottom:16px;">🎉</div>

            <h2 style="font-size:26px;font-weight:800;color:#111111;margin:0 0 8px;letter-spacing:-0.5px;">
              You just earned $${commissionUsd.toFixed(2)}!
            </h2>

            <p style="font-size:15px;color:#666666;margin:0 0 28px;line-height:1.6;">
              Someone just bought LeadPilot through your referral link.<br>
              Your commission has been added to your balance.
            </p>

            <div style="background:#F8F8FB;border-radius:14px;padding:24px;margin-bottom:28px;">
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
                <div style="text-align:center;">
                  <div style="font-size:28px;font-weight:900;color:#10B981;letter-spacing:-1px;">
                    $${commissionUsd.toFixed(2)}
                  </div>
                  <div style="font-size:12px;color:#999999;margin-top:4px;">This commission</div>
                  <div style="font-size:11px;color:#BBBBBB;">₦${commissionNgn.toLocaleString()}</div>
                </div>
                <div style="text-align:center;">
                  <div style="font-size:28px;font-weight:900;color:#7C3AED;letter-spacing:-1px;">
                    $${totalEarnedUsd.toFixed(2)}
                  </div>
                  <div style="font-size:12px;color:#999999;margin-top:4px;">Total earned</div>
                  <div style="font-size:11px;color:#BBBBBB;">₦${totalEarnedNgn.toLocaleString()}</div>
                </div>
              </div>

              ${
                pendingNgn >= MIN_PAYOUT_NGN
                  ? `
              <div style="margin-top:20px;padding:14px;background:#ECFDF5;border-radius:10px;border:1px solid #A7F3D0;">
                <p style="font-size:13px;color:#065F46;font-weight:600;margin:0;">
                  ✓ You have ₦${pendingNgn.toLocaleString()} pending. You can request a payout from your dashboard.
                </p>
              </div>
              `
                  : `
              <div style="margin-top:20px;padding:14px;background:#F5F3FF;border-radius:10px;border:1px solid #DDD6FE;">
                <p style="font-size:13px;color:#5B21B6;font-weight:600;margin:0;">
                  Keep sharing your link. One more referral and you can request your first payout.
                </p>
              </div>
              `
              }
            </div>

            <p style="font-size:15px;color:#444444;line-height:1.8;margin-bottom:28px;">
              Every person who buys through your link earns you <strong>$7.50 (₦7,500)</strong>. The more you share the more you earn. There is no cap.
            </p>

            <a href="${dashboardUrl}"
               style="display:inline-block;background:#7C3AED;color:white;font-weight:800;font-size:15px;padding:16px 32px;border-radius:10px;text-decoration:none;box-shadow:0 4px 20px rgba(124,58,237,0.3);">
              View My Earnings →
            </a>
          </div>

          <div style="background:#F8F8FB;border-top:1px solid #EEEEEE;padding:20px 32px;text-align:center;">
            <p style="font-size:12px;color:#AAAAAA;margin:0;">
              LeadPilot — Business Discovery Intelligence
              <br>
              Questions? <a href="https://wa.me/2349067285890" style="color:#7C3AED;text-decoration:none;">WhatsApp 09067285890</a>
            </p>
          </div>

        </div>
      </div>
    </body>
    </html>
  `;

  await sendEmail({
    to: referrerEmail,
    subject: `You just earned $${commissionUsd.toFixed(2)} — LeadPilot commission`,
    html,
  });
}

export async function sendActivationEmail(email: string, licenseKey: string): Promise<void> {
  const activateUrl = `${config.FRONTEND_URL}/activate?key=${encodeURIComponent(licenseKey)}`;

  const html = `
    <div style="font-family: Inter, Arial, sans-serif; max-width: 560px; margin: 0 auto; color: #111;">
      <h1 style="color: #7c3aed;">Your LeadPilot access is ready</h1>
      <p>Thank you for your purchase. Use your license key to activate lifetime access:</p>
      <p style="font-size: 20px; font-weight: bold; letter-spacing: 1px;">${licenseKey}</p>
      <p><a href="${activateUrl}" style="background:#7c3aed;color:#fff;padding:12px 20px;text-decoration:none;border-radius:8px;display:inline-block;">Activate LeadPilot</a></p>
      <p style="color:#666;font-size:14px;">If the button does not work, copy your key into the dashboard activation screen.</p>
    </div>
  `;

  await sendEmail({
    to: email,
    subject: "Your LeadPilot activation key",
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
          <span style="background:#7C3AED;color:white;padding:6px 14px;border-radius:100px;font-size:12px;font-weight:700;letter-spacing:0.05em;">LEADPILOT</span>
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
          LeadPilot — Business Discovery Intelligence<br>Your results are saved and available any time you log in.
        </p>
      </div>
    </body>
    </html>
  `;

  await sendEmail({
    to: email,
    subject: `Your search found ${totalFound} businesses — LeadPilot`,
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
          <span style="background:#7C3AED;color:white;padding:6px 14px;border-radius:100px;font-size:12px;font-weight:700;letter-spacing:0.05em;">LEADPILOT</span>
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
          LeadPilot — Business Discovery Intelligence<br>We will notify you again when your results are ready.
        </p>
      </div>
    </body>
    </html>
  `;

  await sendEmail({
    to: email,
    subject: "Your LeadPilot search is still running — we will notify you when done",
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
          <span style="background:#7C3AED;color:white;padding:6px 14px;border-radius:100px;font-size:12px;font-weight:700;letter-spacing:0.05em;">LEADPILOT</span>
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
          LeadPilot — Business Discovery Intelligence<br>If this keeps happening contact us and we will help you out.
        </p>
      </div>
    </body>
    </html>
  `;

  await sendEmail({
    to: email,
    subject: "Your LeadPilot search did not complete — here is what to try",
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
          <span style="background:#7C3AED;color:white;padding:6px 14px;border-radius:100px;font-size:12px;font-weight:700;letter-spacing:0.05em;">LEADPILOT</span>
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
          LeadPilot — Business Discovery Intelligence<br>Your searches reset on ${resetDate}.
        </p>
      </div>
    </body>
    </html>
  `;

  await sendEmail({
    to: email,
    subject: `Your LeadPilot monthly searches have been used — reset on ${resetDate}`,
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

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin:0;padding:0;background:#F4F4F8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;">
      <div style="max-width:560px;margin:0 auto;padding:40px 20px;">

        <div style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 2px 20px rgba(0,0,0,0.06);">

          <div style="background:#7C3AED;padding:24px 32px;display:flex;align-items:center;gap:12px;">
            <div style="width:34px;height:34px;background:rgba(255,255,255,0.2);border-radius:8px;display:inline-flex;align-items:center;justify-content:center;">
              <span style="color:white;font-size:12px;font-weight:800;">LP</span>
            </div>
            <span style="font-size:18px;font-weight:800;color:white;letter-spacing:-0.5px;">LeadPilot</span>
          </div>

          <div style="padding:36px 32px;">
            <h2 style="font-size:22px;font-weight:800;color:#111111;margin:0 0 20px;letter-spacing:-0.5px;line-height:1.2;">
              ${safeSubject}
            </h2>
            <div style="font-size:15px;color:#444444;line-height:1.8;white-space:pre-wrap;border-left:3px solid #7C3AED;padding-left:16px;">
              ${safeMessage}
            </div>
          </div>

          <div style="background:#F8F8FB;border-top:1px solid #EEEEEE;padding:20px 32px;text-align:center;">
            <p style="font-size:13px;color:#888888;margin:0 0 6px;font-weight:600;">
              LeadPilot — Business Discovery Intelligence
            </p>
            <p style="font-size:12px;color:#AAAAAA;margin:0;">
              Questions? 
              <a href="https://wa.me/2349067285890" style="color:#7C3AED;text-decoration:none;font-weight:600;">WhatsApp 09067285890</a>
              &nbsp;·&nbsp;
              <a href="mailto:access@leadpilot.live" style="color:#7C3AED;text-decoration:none;font-weight:600;">access@leadpilot.live</a>
            </p>
          </div>

        </div>

      </div>
    </body>
    </html>
  `;

  await sendEmail({
    to: email,
    subject,
    html,
  });
}
