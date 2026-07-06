import {
  countActiveMailboxes,
  countAllMailboxes,
  disconnectMailbox,
  ensureOutreachAccount,
  grantFirstMailboxTrialCredits,
  listActiveMailboxes,
  upsertConnectedMailbox,
  type ConnectedMailbox,
} from "../database/outreach-repository";
import { encryptMailboxSecret } from "../utils/mailbox-crypto";
import {
  dailyCapForAccountType,
  GMAIL_CONNECT_HELP,
  verifyGmailMailboxCredentials,
} from "./mailbox-smtp";

const APP_PASSWORD_RE = /^[a-z0-9]{16}$/i;

export function normalizeAppPassword(raw: string): string {
  return raw.replace(/\s+/g, "").trim();
}

export function normalizeMailboxEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

export async function connectMailbox(params: {
  userId: string;
  emailAddress: string;
  appPassword: string;
  accountType: "personal" | "workspace";
}): Promise<{ mailbox: ConnectedMailbox; firstConnect: boolean }> {
  const emailAddress = normalizeMailboxEmail(params.emailAddress);
  const appPassword = normalizeAppPassword(params.appPassword);

  if (!emailAddress || !emailAddress.includes("@")) {
    throw new MailboxConnectError("A valid Gmail address is required.", 400);
  }

  if (!APP_PASSWORD_RE.test(appPassword)) {
    throw new MailboxConnectError(
      "App password must be exactly 16 characters with no spaces.",
      400
    );
  }

  const account = await ensureOutreachAccount(params.userId);
  const activeCount = await countActiveMailboxes(params.userId, emailAddress);
  if (activeCount >= account.max_mailboxes) {
    throw new MailboxConnectError(
      `You have reached your mailbox limit (${account.max_mailboxes}). Disconnect a mailbox before adding another.`,
      403,
      "MAILBOX_LIMIT"
    );
  }

  try {
    await verifyGmailMailboxCredentials(emailAddress, appPassword);
  } catch {
    throw new MailboxConnectError(GMAIL_CONNECT_HELP, 400, "SMTP_VERIFY_FAILED");
  }

  const firstConnect = (await countAllMailboxes(params.userId)) === 0;

  const mailbox = await upsertConnectedMailbox({
    userId: params.userId,
    emailAddress,
    encryptedAppPassword: encryptMailboxSecret(appPassword),
    accountType: params.accountType,
    dailyCap: dailyCapForAccountType(params.accountType),
  });

  if (firstConnect) {
    await grantFirstMailboxTrialCredits(params.userId);
  }

  return { mailbox, firstConnect };
}

export async function listMailboxesForUser(userId: string): Promise<ConnectedMailbox[]> {
  return listActiveMailboxes(userId);
}

export async function disconnectMailboxForUser(userId: string, mailboxId: string): Promise<void> {
  await disconnectMailbox(userId, mailboxId);
}

export class MailboxConnectError extends Error {
  readonly statusCode: number;
  readonly code?: string;

  constructor(message: string, statusCode: number, code?: string) {
    super(message);
    this.name = "MailboxConnectError";
    this.statusCode = statusCode;
    this.code = code;
  }
}
