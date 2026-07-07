import nodemailer from "nodemailer";

const GMAIL_SMTP_HOST = "smtp.gmail.com";
const GMAIL_SMTP_PORT = 587;

export const GMAIL_CONNECT_HELP =
  "Gmail could not verify that app password. In your Google Account go to Security, turn on 2-Step Verification, then create an App Password for Mail. Paste the 16-character password with no spaces and try again.";

export const GMAIL_APP_PASSWORDS_DISABLED_HELP =
  "This Google account may be a work or school account where an admin disabled app passwords. Try a personal @gmail.com address instead.";

function readVerifyErrorText(err: unknown): string {
  if (!err || typeof err !== "object") {
    return err instanceof Error ? err.message : String(err ?? "");
  }
  const response = (err as { response?: unknown }).response;
  if (typeof response === "string" && response.trim()) return response.trim();
  if (err instanceof Error && err.message.trim()) return err.message.trim();
  return "Gmail verification failed";
}

/** Map Gmail SMTP verify failures to connect error codes for the guided UI. */
export function classifyMailboxVerifyError(err: unknown): {
  code: "SMTP_VERIFY_FAILED" | "APP_PASSWORDS_DISABLED";
  message: string;
} {
  const text = readVerifyErrorText(err).toLowerCase();

  if (
    /application.specific password|app passwords? (are )?not available|not enabled by your administrator|disabled by your administrator|organization policy|workspace/.test(
      text
    )
  ) {
    return { code: "APP_PASSWORDS_DISABLED", message: GMAIL_APP_PASSWORDS_DISABLED_HELP };
  }

  return { code: "SMTP_VERIFY_FAILED", message: GMAIL_CONNECT_HELP };
}

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
