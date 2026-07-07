import { randomUUID } from "crypto";
import nodemailer from "nodemailer";
import { classifySmtpSendError, OutreachSmtpSendError } from "../utils/outreach-smtp-error";

const GMAIL_SMTP_HOST = "smtp.gmail.com";
const GMAIL_SMTP_PORT = 587;

export interface OutreachSmtpPayload {
  from: string;
  to: string;
  subject: string;
  html: string;
  text: string;
  appPassword: string;
}

function mockHardBounceFor(payload: OutreachSmtpPayload): OutreachSmtpSendError | null {
  const hardFor = process.env.MOCK_OUTREACH_SEND_HARD_BOUNCE_FOR?.trim().toLowerCase();
  if (!hardFor) return null;
  if (hardFor !== payload.to.toLowerCase().trim() && hardFor !== "throw") return null;

  const smtpResponse =
    "550 5.1.1 The email account that you tried to reach does not exist. Please try double-checking the recipient's email address for typos or unnecessary spaces.";
  return new OutreachSmtpSendError({
    kind: "hard_bounce",
    message: smtpResponse,
    smtpCode: 550,
    smtpResponse,
  });
}

function mockSoftFailureFor(payload: OutreachSmtpPayload): OutreachSmtpSendError | null {
  const softFor = process.env.MOCK_OUTREACH_SEND_SOFT_FAIL_FOR?.trim().toLowerCase();
  if (!softFor) return null;
  if (softFor !== payload.to.toLowerCase().trim() && softFor !== "throw") return null;

  if (process.env.MOCK_OUTREACH_SEND_SOFT_FAIL_CODE?.trim() === "421") {
    const smtpResponse = "421 4.7.0 Temporary system problem. Try again later.";
    return new OutreachSmtpSendError({
      kind: "soft_failure",
      message: smtpResponse,
      smtpCode: 421,
      smtpResponse,
    });
  }

  return new OutreachSmtpSendError({
    kind: "soft_failure",
    message: "Connection timeout while sending outreach email",
    smtpCode: null,
    smtpResponse: null,
  });
}

/** Send outreach email via Gmail SMTP. Stubbed when MOCK_OUTREACH_SEND=1. */
export async function sendOutreachEmail(payload: OutreachSmtpPayload): Promise<string> {
  if (process.env.MOCK_OUTREACH_SEND === "1") {
    const hard = mockHardBounceFor(payload);
    if (hard) throw hard;

    const soft = mockSoftFailureFor(payload);
    if (soft) throw soft;

    const failFor = process.env.MOCK_OUTREACH_SEND_FAIL_FOR?.trim();
    if (failFor && (failFor === payload.to || failFor === "throw")) {
      throw classifySmtpSendError(new Error("Mock outreach send failure"));
    }

    return `mock-${randomUUID()}`;
  }

  const transport = nodemailer.createTransport({
    host: GMAIL_SMTP_HOST,
    port: GMAIL_SMTP_PORT,
    secure: false,
    auth: {
      user: payload.from,
      pass: payload.appPassword,
    },
    connectionTimeout: 30_000,
    greetingTimeout: 30_000,
    socketTimeout: 30_000,
  });

  try {
    const info = await transport.sendMail({
      from: payload.from,
      to: payload.to,
      subject: payload.subject,
      text: payload.text,
      html: payload.html,
    });
    return info.messageId || randomUUID();
  } catch (err) {
    throw classifySmtpSendError(err);
  } finally {
    transport.close();
  }
}
