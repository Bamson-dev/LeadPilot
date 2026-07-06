import nodemailer from "nodemailer";
import { randomUUID } from "crypto";

const GMAIL_SMTP_HOST = "smtp.gmail.com";
const GMAIL_SMTP_PORT = 587;

export interface OutreachSmtpPayload {
  from: string;
  to: string;
  subject: string;
  html: string;
  appPassword: string;
}

/** Send outreach email via Gmail SMTP. Stubbed when MOCK_OUTREACH_SEND=1. */
export async function sendOutreachEmail(payload: OutreachSmtpPayload): Promise<string> {
  if (process.env.MOCK_OUTREACH_SEND === "1") {
    const failFor = process.env.MOCK_OUTREACH_SEND_FAIL_FOR?.trim();
    if (failFor && (failFor === payload.to || failFor === "throw")) {
      throw new Error("Mock outreach send failure");
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
      html: payload.html,
    });
    return info.messageId || randomUUID();
  } finally {
    transport.close();
  }
}
