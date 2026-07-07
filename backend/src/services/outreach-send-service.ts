import { randomBytes } from "crypto";
import { config } from "../config/env";
import { decryptMailboxSecret } from "../utils/mailbox-crypto";
import { buildOutreachEmailContent } from "./outreach-email-template";
import { sendOutreachEmail } from "./outreach-send-smtp";
import {
  assignSentEmailMailbox,
  computeAvailableSends,
  createQueuedSentEmail,
  deductOneSendCredit,
  ensureOutreachAccount,
  getEmailTemplateById,
  getMailboxWithSecret,
  getSentEmailById,
  incrementMailboxSendCount,
  isRecipientSuppressed,
  listActiveMailboxesWithSecrets,
  logCreditSpend,
  markSentEmailBounced,
  markSentEmailFailed,
  markSentEmailSent,
  pauseMailboxForBounceRate,
  refundSendCredit,
  resetMailboxDailyCountIfNeeded,
  type ConnectedMailboxWithSecret,
  type CreditBucket,
} from "../database/outreach-repository";
import { isGloballyInvalidEmail } from "../database/global-invalid-email-repository";
import { enqueueOutreachSendJob } from "../queue/outreach-send-queue";
import type { OutreachSendMode } from "../queue/outreach-send-queue-types";
import { getVerifiedEmailsForBusinessId } from "../database/search-repository";
import { logger } from "../utils/logger";
import { OutreachSmtpSendError } from "../utils/outreach-smtp-error";
import { recordHardBounceForRecipient } from "./outreach-bounce-service";
import {
  mailboxBounceThresholdReached,
  recordMailboxHardBounce,
} from "./outreach-bounce-rate-guard";

export interface SendLeadTarget {
  recipient_email: string;
  business_name?: string;
  business_id?: string;
  email_kind?: "verified" | "predicted";
}

export interface QueueSendBatchParams {
  userId: string;
  targets: SendLeadTarget[];
  subject: string;
  body: string;
  templateId?: string;
  mailboxId?: string;
  sendMode: OutreachSendMode;
}

export interface QueueSendBatchResult {
  queued: number;
  skipped_suppression: number;
  skipped_no_verified_email: number;
  skipped_invalid_email: number;
  short_credits: number;
  sent_email_ids: string[];
}

function getOutreachTrackingBaseUrl(): string {
  const override = process.env.OUTREACH_TRACKING_BASE_URL?.trim();
  if (override) return override.replace(/\/$/, "");

  const frontend = config.FRONTEND_URL.replace(/\/$/, "");
  if (frontend.includes("staging.leadthur")) {
    return "https://staging-backend.leadthur.com";
  }
  if (frontend.includes("localhost")) {
    return `http://localhost:${process.env.PORT || "3000"}`;
  }
  return "https://backend.leadthur.com";
}

export function getOutreachOpenTrackingUrl(trackingToken: string): string {
  return `${getOutreachTrackingBaseUrl()}/outreach/open/${encodeURIComponent(trackingToken)}`;
}

export function getOutreachUnsubscribeUrl(trackingToken: string): string {
  return `${getOutreachTrackingBaseUrl()}/outreach/unsubscribe?token=${encodeURIComponent(trackingToken)}`;
}

function applyBusinessName(text: string, businessName?: string | null): string {
  const name = businessName?.trim() || "there";
  return text.replace(/\[Business Name\]/gi, name);
}

function generateTrackingToken(): string {
  return randomBytes(24).toString("hex");
}

async function recipientIsVerifiedForSend(target: SendLeadTarget): Promise<boolean> {
  if (target.email_kind === "predicted") return false;

  const recipient = target.recipient_email?.toLowerCase().trim();
  if (!recipient) return false;

  const businessId = target.business_id?.trim();
  if (businessId) {
    const verifiedEmails = await getVerifiedEmailsForBusinessId(businessId);
    return verifiedEmails.some((email) => email.toLowerCase().trim() === recipient);
  }

  return target.email_kind === "verified";
}

export async function queueSendBatch(params: QueueSendBatchParams): Promise<QueueSendBatchResult> {
  const account = await ensureOutreachAccount(params.userId);
  let available = computeAvailableSends(account);

  let subject = params.subject;
  let body = params.body;

  if (params.templateId) {
    const template = await getEmailTemplateById(params.templateId);
    if (template) {
      subject = template.subject;
      body = template.body;
    }
  }

  const result: QueueSendBatchResult = {
    queued: 0,
    skipped_suppression: 0,
    skipped_no_verified_email: 0,
    skipped_invalid_email: 0,
    short_credits: 0,
    sent_email_ids: [],
  };

  for (const target of params.targets) {
    const recipient = target.recipient_email?.toLowerCase().trim();
    if (!recipient) continue;

    if (!(await recipientIsVerifiedForSend(target))) {
      result.skipped_no_verified_email += 1;
      continue;
    }

    if (await isRecipientSuppressed(params.userId, recipient)) {
      result.skipped_suppression += 1;
      continue;
    }

    if (await isGloballyInvalidEmail(recipient)) {
      result.skipped_invalid_email += 1;
      continue;
    }

    if (available <= 0) {
      result.short_credits += 1;
      continue;
    }

    const personalizedSubject = applyBusinessName(subject, target.business_name);
    const personalizedBody = applyBusinessName(body, target.business_name);
    const trackingToken = generateTrackingToken();

    const row = await createQueuedSentEmail({
      userId: params.userId,
      recipientEmail: recipient,
      businessName: target.business_name,
      subject: personalizedSubject,
      body: personalizedBody,
      trackingToken,
    });

    await enqueueOutreachSendJob({
      sentEmailId: row.id,
      userId: params.userId,
      sendMode: params.sendMode,
      mailboxId: params.mailboxId,
    });

    result.queued += 1;
    result.sent_email_ids.push(row.id);
    available -= 1;
  }

  return result;
}

export function pickMailboxForAutoSend(
  mailboxes: ConnectedMailboxWithSecret[]
): ConnectedMailboxWithSecret | null {
  for (const mailbox of mailboxes) {
    if (mailbox.daily_send_count < mailbox.daily_cap) {
      return mailbox;
    }
  }
  return null;
}

export function pickMailboxForManualSend(
  mailboxes: ConnectedMailboxWithSecret[],
  mailboxId: string
): ConnectedMailboxWithSecret | null {
  return mailboxes.find((m) => m.id === mailboxId) ?? null;
}

const mailboxLastSendAt = new Map<string, number>();
const mailboxChains = new Map<string, Promise<void>>();

function randomSpacingMs(): number {
  if (process.env.OUTREACH_SEND_SKIP_SPACING === "1") return 0;
  return 5_000 + Math.floor(Math.random() * 10_001);
}

async function waitForMailboxSpacing(mailboxId: string): Promise<() => void> {
  const prior = mailboxChains.get(mailboxId) ?? Promise.resolve();
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  mailboxChains.set(mailboxId, gate);

  await prior;

  const lastAt = mailboxLastSendAt.get(mailboxId) ?? 0;
  const elapsed = Date.now() - lastAt;
  const required = randomSpacingMs();
  if (lastAt > 0 && required > 0 && elapsed < required) {
    await new Promise((r) => setTimeout(r, required - elapsed));
  }

  return release;
}

function markMailboxSendComplete(mailboxId: string, release: () => void): void {
  mailboxLastSendAt.set(mailboxId, Date.now());
  release();
}

export type ProcessSendJobOutcome =
  | { action: "sent"; sentEmailId: string; mailboxId: string; creditBucket: CreditBucket }
  | { action: "bounced"; sentEmailId: string; mailboxId: string; error: string }
  | { action: "requeue"; delayMs: number; reason: string }
  | { action: "failed"; sentEmailId: string; error: string };

const MAILBOX_BOUNCE_PAUSE_MESSAGE =
  "Sending paused: this mailbox hit a high bounce rate. Remove bad addresses from your list or reconnect after reviewing your leads.";

async function refundCreditIfNeeded(params: {
  userId: string;
  creditBucket: CreditBucket | null;
  sentEmailId: string;
}): Promise<void> {
  if (!params.creditBucket) return;
  try {
    await refundSendCredit({
      userId: params.userId,
      bucket: params.creditBucket,
      sentEmailId: params.sentEmailId,
    });
  } catch (refundErr) {
    logger.error("Outreach send refund failed", {
      sentEmailId: params.sentEmailId,
      error: refundErr instanceof Error ? refundErr.message : "unknown",
    });
  }
}

async function handleMailboxHardBounce(mailboxId: string): Promise<void> {
  const bounceCount = recordMailboxHardBounce(mailboxId);
  if (mailboxBounceThresholdReached(mailboxId)) {
    await pauseMailboxForBounceRate(
      mailboxId,
      `${MAILBOX_BOUNCE_PAUSE_MESSAGE} (${bounceCount} hard bounces this session.)`
    );
  }
}

export async function processOutreachSendJob(data: {
  sentEmailId: string;
  userId: string;
  sendMode: OutreachSendMode;
  mailboxId?: string;
}): Promise<ProcessSendJobOutcome> {
  const sentEmail = await getSentEmailById(data.sentEmailId);
  if (!sentEmail) {
    return { action: "failed", sentEmailId: data.sentEmailId, error: "Sent email row not found" };
  }

  if (sentEmail.status === "sent" || sentEmail.status === "failed" || sentEmail.status === "bounced") {
    return { action: "sent", sentEmailId: sentEmail.id, mailboxId: sentEmail.mailbox_id ?? "", creditBucket: sentEmail.credit_bucket ?? "monthly_allowance" };
  }

  if (await isGloballyInvalidEmail(sentEmail.recipient_email)) {
    await markSentEmailBounced(
      sentEmail.id,
      "Recipient address is globally invalid (hard bounce recorded previously)"
    );
    return {
      action: "bounced",
      sentEmailId: sentEmail.id,
      mailboxId: sentEmail.mailbox_id ?? "",
      error: "Recipient address is globally invalid",
    };
  }

  let mailboxes = await listActiveMailboxesWithSecrets(data.userId);
  mailboxes = await Promise.all(mailboxes.map((m) => resetMailboxDailyCountIfNeeded(m)));

  let mailbox: ConnectedMailboxWithSecret | null = null;
  if (data.sendMode === "manual" && data.mailboxId) {
    mailbox = pickMailboxForManualSend(mailboxes, data.mailboxId);
    if (!mailbox) {
      await markSentEmailFailed(sentEmail.id, "Manual mailbox not found or inactive");
      return { action: "failed", sentEmailId: sentEmail.id, error: "Manual mailbox not found or inactive" };
    }
  } else {
    mailbox = pickMailboxForAutoSend(mailboxes);
    if (!mailbox) {
      const earliestReset = mailboxes
        .map((m) => (m.daily_count_reset_at ? new Date(m.daily_count_reset_at).getTime() : Date.now()))
        .sort((a, b) => a - b)[0];
      const delayMs = Math.max(1_000, (earliestReset ?? Date.now()) - Date.now());
      return { action: "requeue", delayMs, reason: "All mailboxes at daily cap" };
    }
  }

  if (mailbox.daily_send_count >= mailbox.daily_cap) {
    const resetAt = mailbox.daily_count_reset_at
      ? new Date(mailbox.daily_count_reset_at).getTime()
      : Date.now() + 86_400_000;
    const delayMs = Math.max(1_000, resetAt - Date.now());
    return { action: "requeue", delayMs, reason: "Mailbox at daily cap" };
  }

  if (!mailbox.encrypted_app_password) {
    await markSentEmailFailed(sentEmail.id, "Mailbox has no stored credentials");
    return { action: "failed", sentEmailId: sentEmail.id, error: "Mailbox has no stored credentials" };
  }

  await assignSentEmailMailbox(sentEmail.id, mailbox.id);
  const releaseSpacing = await waitForMailboxSpacing(mailbox.id);

  let creditBucket: CreditBucket | null = null;
  try {
    const appPassword =
      process.env.MOCK_OUTREACH_SEND === "1"
        ? "mock-not-used"
        : decryptMailboxSecret(mailbox.encrypted_app_password);
    const trackingUrl = getOutreachOpenTrackingUrl(sentEmail.tracking_token!);
    const unsubscribeUrl = getOutreachUnsubscribeUrl(sentEmail.tracking_token!);
    const { html, text } = buildOutreachEmailContent({
      body: sentEmail.body,
      trackingPixelUrl: trackingUrl,
      unsubscribeUrl,
    });

    creditBucket = await deductOneSendCredit(data.userId);
    await logCreditSpend({
      userId: data.userId,
      bucket: creditBucket,
      sentEmailId: sentEmail.id,
    });

    const providerMessageId = await sendOutreachEmail({
      from: mailbox.email_address,
      to: sentEmail.recipient_email,
      subject: sentEmail.subject,
      html,
      text,
      appPassword,
    });

    await markSentEmailSent({
      sentEmailId: sentEmail.id,
      providerMessageId,
      creditBucket,
    });
    await incrementMailboxSendCount(mailbox.id);
    markMailboxSendComplete(mailbox.id, releaseSpacing);

    return { action: "sent", sentEmailId: sentEmail.id, mailboxId: mailbox.id, creditBucket };
  } catch (err) {
    if (err instanceof OutreachSmtpSendError && err.kind === "hard_bounce") {
      await refundCreditIfNeeded({
        userId: data.userId,
        creditBucket,
        sentEmailId: sentEmail.id,
      });
      await markSentEmailBounced(sentEmail.id, err.message);
      await recordHardBounceForRecipient({
        recipientEmail: sentEmail.recipient_email,
        smtpCode: err.smtpCode,
        reason: err.message,
      });
      await handleMailboxHardBounce(mailbox.id);
      markMailboxSendComplete(mailbox.id, releaseSpacing);
      return { action: "bounced", sentEmailId: sentEmail.id, mailboxId: mailbox.id, error: err.message };
    }

    const message = err instanceof Error ? err.message : "Send failed";
    await refundCreditIfNeeded({
      userId: data.userId,
      creditBucket,
      sentEmailId: sentEmail.id,
    });
    await markSentEmailFailed(sentEmail.id, message);
    markMailboxSendComplete(mailbox.id, releaseSpacing);
    return { action: "failed", sentEmailId: sentEmail.id, error: message };
  }
}

/** Test helper: reset per-mailbox spacing state between test cases. */
export function resetOutreachSendSpacingForTests(): void {
  mailboxLastSendAt.clear();
  mailboxChains.clear();
}

export { MAILBOX_BOUNCE_PAUSE_MESSAGE };
