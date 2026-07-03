import { Resend } from "resend";
import { COMMISSION_NGN, COMMISSION_USD, MIN_PAYOUT_NGN } from "../constants/pricing";
import { displayCityFromLocation } from "../scraper/googleMaps/grid-search";
import { logger } from "../utils/logger";
import { sendViaZeptoMail, type EmailSendResult } from "./zeptomail";
import {
  buildEmailHtml,
  emailButton,
  emailHeading,
  emailHighlight,
  emailParagraph,
  emailSignature,
  escapeHtml,
  getFrontendUrl,
} from "./email-template";

let resendClient: Resend | null = null;

function getResendClient(): Resend | null {
  const key = process.env.RESEND_API_KEY?.trim();
  if (!key) return null;
  if (!resendClient) resendClient = new Resend(key);
  return resendClient;
}

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

function wrapTransactional(body: string, recipientEmail: string): string {
  return buildEmailHtml({ body, recipientEmail });
}

function wrapTrial(body: string, recipientEmail: string, step: number): string {
  return buildEmailHtml({
    body,
    recipientEmail,
    trialStep: step,
    trialFooterNote: "You are receiving this because you signed up for a LeadThur free trial.",
  });
}

export async function sendAccessEmail(to: string, licenseKey: string): Promise<void> {
  const body = `
    ${emailHeading("Your LeadThur access is ready")}
    ${emailParagraph("Your lifetime access is now active. Here is your license key.")}
    <div class="stat-box">
      <div class="detail-row"><strong>License key</strong><br>${escapeHtml(licenseKey)}</div>
    </div>
    ${emailParagraph("Go to your dashboard, enter this key, and run your first search. Type any business type and any city. You get 1,000+ potential clients with direct contact details in about 60 seconds.")}
    ${emailButton("Go to your dashboard", "https://leadthur.com/dashboard")}
    <p class="meta">If you have trouble activating, contact support and we will help you immediately.</p>
  `;

  await deliver({
    to,
    subject: "Your LeadThur access is ready",
    html: wrapTransactional(body, to),
  });
}

export async function sendWelcomeEmail(to: string): Promise<void> {
  const body = `
    ${emailHeading("Welcome to LeadThur")}
    ${emailParagraph("You now have access to 1,000+ business contacts in any city in the world. Here is how to get your first list in the next 60 seconds.")}
    ${emailParagraph("1. Type any business type — restaurants, salons, law firms, gyms, agencies.")}
    ${emailParagraph("2. Type any city — Lagos, London, Dubai, New York, Nairobi, Accra, and more.")}
    ${emailParagraph("3. Export your list and start pitching the same day.")}
    ${emailButton("Start your first search", "https://leadthur.com/dashboard")}
    <p class="meta">One payment. No monthly fees. LeadThur is yours for life.</p>
  `;

  await deliver({
    to,
    subject: "Start finding clients in 60 seconds",
    html: wrapTransactional(body, to),
  });
}

export async function sendPaymentConfirmationEmail(to: string, amount: string): Promise<void> {
  const body = `
    ${emailHeading("Payment confirmed")}
    ${emailParagraph("We received your payment and your LeadThur lifetime access is now active.")}
    <div class="stat-box">
      <div class="detail-row"><strong>Product</strong><br>LeadThur Lifetime Access</div>
      <div class="detail-row"><strong>Amount paid</strong><br>${escapeHtml(amount)}</div>
      <div class="detail-row"><strong>Access</strong><br>Lifetime. No renewal.</div>
    </div>
    ${emailButton("Go to your dashboard", "https://leadthur.com/dashboard")}
    <p class="meta">Keep this email for your records.</p>
  `;

  await deliver({
    to,
    subject: "Payment confirmed — LeadThur lifetime access activated",
    html: wrapTransactional(body, to),
  });
}

export async function sendPasswordResetEmail(to: string, resetLink: string): Promise<void> {
  const body = `
    ${emailHeading("Reset your password")}
    ${emailParagraph("We received a request to reset your LeadThur password. Click the button below to set a new one. This link expires in one hour.")}
    ${emailButton("Reset my password", resetLink)}
    <p class="meta">If you did not request a password reset, ignore this email. Your account is safe.</p>
  `;

  await deliver({
    to,
    subject: "Reset your LeadThur password",
    html: wrapTransactional(body, to),
  });
}

export async function sendTrialWelcomeEmail(to: string): Promise<void> {
  const body = `
    ${emailHeading("Your free trial is ready")}
    ${emailParagraph("You have two free searches on LeadThur. No card. No commitment. See exactly what you get before you decide anything.")}
    ${emailHighlight("Search any business type and city. See 1,000+ results with direct contact details. No card required for the trial.")}
    ${emailButton("Start my free trial", "https://leadthur.com/dashboard")}
    <p class="meta">After your two free searches, lifetime access is a one-time payment. No subscriptions.</p>
  `;

  await deliver({
    to,
    subject: "Your LeadThur free trial is ready",
    html: wrapTransactional(body, to),
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
    .map((para) => emailParagraph(para))
    .join("");

  const body = `
    ${paragraphs}
    <p class="meta">This message was sent from the LeadThur team.</p>
  `;

  await deliver({
    to,
    subject,
    html: wrapTransactional(body, to),
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
  const pendingNote =
    pendingNgn >= MIN_PAYOUT_NGN
      ? `You have ₦${pendingNgn.toLocaleString()} pending. Request a payout from your dashboard now.`
      : "Keep sharing your link. One more referral and you can request your first payout.";

  const body = `
    ${emailHeading(`You just earned $${commissionUsd.toFixed(2)}`)}
    ${emailParagraph("Someone bought LeadThur through your referral link. Your commission has been added to your balance.")}
    <div class="stat-box">
      <div class="stat-number">$${commissionUsd.toFixed(2)}</div>
      <div class="stat-label">₦${commissionNgn.toLocaleString()} this commission</div>
      <div class="detail-row" style="margin-top:16px"><strong>Total earned:</strong> $${totalEarnedUsd.toFixed(2)} (₦${totalEarnedNgn.toLocaleString()})</div>
    </div>
    ${emailParagraph(pendingNote)}
    ${emailParagraph(`Every referral earns you $${COMMISSION_USD.toFixed(2)} (₦${COMMISSION_NGN.toLocaleString()}).`)}
    ${emailButton("View my earnings", `${getFrontendUrl()}/dashboard`)}
  `;

  await deliver({
    to: referrerEmail,
    subject: `You just earned $${commissionUsd.toFixed(2)} — LeadThur commission`,
    html: wrapTransactional(body, referrerEmail),
  });
}

export async function sendPayoutRequestedEmail(
  email: string,
  amountNgn: number,
  amountUsd: number,
  accountName: string,
  bankName: string
): Promise<void> {
  const body = `
    ${emailHeading("Payout request received")}
    ${emailParagraph("We have received your payout request and it is being processed. Expect your transfer within 24 hours.")}
    <div class="stat-box">
      <div class="detail-row"><strong>Amount</strong><br>₦${amountNgn.toLocaleString()} ($${amountUsd.toFixed(2)})</div>
      <div class="detail-row"><strong>Account</strong><br>${escapeHtml(accountName)}</div>
      <div class="detail-row"><strong>Bank</strong><br>${escapeHtml(bankName)}</div>
    </div>
    ${emailButton("View my dashboard", `${getFrontendUrl()}/dashboard`)}
  `;

  await deliver({
    to: email,
    subject: "Your payout request is being processed — LeadThur",
    html: wrapTransactional(body, email),
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
  const body = `
    ${emailHeading("Your payout has been sent")}
    ${emailParagraph("Your payout has been processed and the transfer has been initiated to your bank account.")}
    <div class="stat-box">
      <div class="stat-number">₦${amountNgn.toLocaleString()}</div>
      <div class="stat-label">${escapeHtml(accountName)} · ${escapeHtml(bankName)} · ${escapeHtml(accountNumber)}</div>
      <div class="detail-row" style="margin-top:16px"><strong>USD equivalent:</strong> $${amountUsd.toFixed(2)}</div>
    </div>
    ${emailButton("View my dashboard", `${getFrontendUrl()}/dashboard`)}
  `;

  await deliver({
    to: email,
    subject: `Your ₦${amountNgn.toLocaleString()} payout has been sent — LeadThur`,
    html: wrapTransactional(body, email),
  });
}

export async function sendDomainChangeEmail(email: string): Promise<void> {
  const body = `
    ${emailHeading("We have a new name and a new home")}
    ${emailParagraph("LeadPilot has moved to LeadThur. Everything works the same. Your account and access are unchanged.")}
    ${emailHighlight("New home: leadthur.com. Your old address redirects automatically.")}
    ${emailButton("Go to my dashboard", `${getFrontendUrl()}/dashboard`)}
  `;

  await deliver({
    to: email,
    subject: "We have a new name and a new home",
    html: wrapTransactional(body, email),
  });
}

export async function sendSearchCompleteEmail(
  email: string,
  query: string,
  location: string,
  totalFound: number
): Promise<void> {
  const body = `
    ${emailHeading("Your results are ready")}
    ${emailParagraph(`Your search for ${query} in ${location} is complete.`)}
    <div class="stat-box">
      <div class="stat-number">${totalFound}</div>
      <div class="stat-label">businesses found with contact details</div>
    </div>
    ${emailButton("View my results", `${getFrontendUrl()}/dashboard`)}
  `;

  await deliver({
    to: email,
    subject: `Your search found ${totalFound} businesses — LeadThur`,
    html: wrapTransactional(body, email),
  });
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
    ? emailParagraph(
        "Email addresses were not scraped for this search because server resources were limited. Phone numbers, websites, and addresses are ready now. Run this search again later for email coverage."
      )
    : "";

  const body = `
    ${emailHeading(`We found ${countLabel} potential clients in ${escapeHtml(city)}`)}
    ${emailParagraph(`Your search is complete. You have ${countLabel} businesses with direct contact details ready to reach out to.`)}
    ${skipEmailNote}
    ${emailHighlight("The sooner you contact them, the better your chances of landing them before anyone else does.")}
    ${emailButton(`View my ${countLabel} potential clients`, resultsUrl)}
  `;

  await deliver({
    to: email,
    subject: `We found ${countLabel} potential clients for you in ${city}`,
    html: wrapTransactional(body, email),
  });
}

export async function sendSearchRunningEmail(
  email: string,
  query: string,
  location: string
): Promise<void> {
  const body = `
    ${emailHeading("Your search is still running")}
    ${emailParagraph(`Your search for ${query} in ${location} is taking longer than usual.`)}
    ${emailParagraph("You do not need to keep the page open. Your results will be saved to your dashboard when the search finishes.")}
    ${emailButton("Go to dashboard", `${getFrontendUrl()}/dashboard`)}
  `;

  await deliver({
    to: email,
    subject: "Your LeadThur search is still running — we will notify you when done",
    html: wrapTransactional(body, email),
  });
}

export async function sendSearchFailedEmail(
  email: string,
  query: string,
  location: string
): Promise<void> {
  const body = `
    ${emailHeading("Your search did not complete")}
    ${emailParagraph(`Your search for ${query} in ${location} did not return results this time.`)}
    ${emailParagraph("Try a broader location, a more common business type, or wait a few minutes and try again. This search has not been counted against your monthly limit.")}
    ${emailButton("Try another search", `${getFrontendUrl()}/dashboard`)}
  `;

  await deliver({
    to: email,
    subject: "Your LeadThur search did not complete — here is what to try",
    html: wrapTransactional(body, email),
  });
}

export async function sendSearchQueueFailureEmail(
  email: string,
  query: string,
  location: string
): Promise<void> {
  const body = `
    ${emailHeading("Your search ran into a problem")}
    ${emailParagraph(`We could not finish your search for ${query} in ${location} this time.`)}
    ${emailParagraph("Please try again in a few minutes. If the problem continues, try a broader city or business type.")}
    ${emailButton("Try another search", `${getFrontendUrl()}/dashboard`)}
  `;

  await deliver({
    to: email,
    subject: "Your search ran into a problem, please try again",
    html: wrapTransactional(body, email),
  });
}

export async function sendLimitReachedEmail(email: string, resetDate: string): Promise<void> {
  const body = `
    ${emailHeading("Search limit reached")}
    ${emailParagraph(`You have used all your searches for this billing period. Upgrade from your dashboard to continue, or wait until your limit resets on ${resetDate}.`)}
    ${emailButton("Upgrade on dashboard", `${getFrontendUrl()}/dashboard`)}
  `;

  await deliver({
    to: email,
    subject: "Your LeadThur search limit has been reached",
    html: wrapTransactional(body, email),
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
  const body = `
    ${emailHeading("Top up confirmed")}
    ${emailParagraph("Your search credits have been added to your account.")}
    <div class="stat-box">
      <div class="detail-row"><strong>Credits added</strong><br>${credits}</div>
      <div class="detail-row"><strong>Amount paid</strong><br>₦${amountNgn.toLocaleString()}</div>
    </div>
    ${emailButton("Back to dashboard", `${getFrontendUrl()}/dashboard`)}
  `;

  await deliver({
    to: email,
    subject: "Your search credits have been added",
    html: wrapTransactional(body, email),
  });
}

export async function sendTrialEmail(email: string, step: number): Promise<void> {
  const { getTrialEmailBody, TRIAL_EMAIL_SUBJECTS } = await import("./trial-email-content");
  const subject = TRIAL_EMAIL_SUBJECTS[step];
  const body = getTrialEmailBody(step);
  if (!subject || !body) {
    throw new Error(`Invalid trial email step: ${step}`);
  }

  const html = wrapTrial(body, email, step);
  await deliver({ to: email, subject, html });
}

function formatBroadcastBody(body: string): string {
  const lines = body
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const htmlLines = lines.map((line) => emailParagraph(line)).join("");
  return `${htmlLines}${emailButton("Open LeadThur", "https://leadthur.com")}${emailSignature()}`;
}

export async function sendTrialBroadcastEmail(
  email: string,
  subject: string,
  body: string
): Promise<void> {
  const html = buildEmailHtml({
    body: formatBroadcastBody(body),
    recipientEmail: email,
    trialFooterNote: "You are receiving this because you signed up for a LeadThur free trial.",
  });
  await deliver({ to: email, subject, html });
}

/** Staging/admin helper for previewing redesigned emails. */
export async function sendTrialEmailPreview(email: string, step: number): Promise<boolean> {
  const { getTrialEmailBody, TRIAL_EMAIL_SUBJECTS } = await import("./trial-email-content");
  const subject = TRIAL_EMAIL_SUBJECTS[step];
  const body = getTrialEmailBody(step);
  if (!subject || !body) {
    throw new Error(`Invalid trial email step: ${step}`);
  }
  return sendEmail({ to: email, subject, html: wrapTrial(body, email, step) });
}

/** Staging/admin helper for previewing the results-ready email. */
export async function sendSearchResultsReadyEmailPreview(email: string): Promise<boolean> {
  const city = "Lagos";
  const countLabel = "847";
  const resultsUrl = `${getFrontendUrl()}/dashboard/search/preview-test`;
  const body = `
    ${emailHeading(`We found ${countLabel} potential clients in ${city}`)}
    ${emailParagraph(`Your search is complete. You have ${countLabel} businesses with direct contact details ready to reach out to.`)}
    ${emailHighlight("The sooner you contact them, the better your chances of landing them before anyone else does.")}
    ${emailButton(`View my ${countLabel} potential clients`, resultsUrl)}
  `;
  return sendEmail({
    to: email,
    subject: `We found ${countLabel} potential clients for you in ${city}`,
    html: wrapTransactional(body, email),
  });
}
