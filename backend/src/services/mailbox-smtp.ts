import nodemailer from "nodemailer";

const GMAIL_SMTP_HOST = "smtp.gmail.com";
const GMAIL_SMTP_PORT = 587;

export const GMAIL_CONNECT_HELP =
  "Gmail could not verify that app password. In your Google Account go to Security, turn on 2-Step Verification, then create an App Password for Mail. Paste the 16-character password with no spaces and try again.";

export async function verifyGmailMailboxCredentials(
  emailAddress: string,
  appPassword: string
): Promise<void> {
  if (process.env.MOCK_MAILBOX_SMTP === "1") {
    return;
  }

  const transport = nodemailer.createTransport({
    host: GMAIL_SMTP_HOST,
    port: GMAIL_SMTP_PORT,
    secure: false,
    auth: {
      user: emailAddress,
      pass: appPassword,
    },
    connectionTimeout: 15_000,
    greetingTimeout: 15_000,
    socketTimeout: 15_000,
  });

  try {
    await transport.verify();
  } finally {
    transport.close();
  }
}

export function dailyCapForAccountType(accountType: "personal" | "workspace"): number {
  return accountType === "workspace" ? 1500 : 300;
}
