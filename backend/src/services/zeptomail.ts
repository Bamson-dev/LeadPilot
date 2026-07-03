import { logger } from "../utils/logger";

// SMTP alternative (not used): smtp.zeptomail.com:587, username emailapikey, password ZEPTOMAIL_API_KEY.

export type EmailSendResult =
  | { success: true }
  | { success: false; error: string };

function getZeptoMailConfig(): {
  apiKey: string;
  apiUrl: string;
  fromEmail: string;
} | null {
  const apiKey = process.env.ZEPTOMAIL_API_KEY?.trim();
  const apiUrl = process.env.ZEPTOMAIL_API_URL?.trim();
  const fromEmail = process.env.ZEPTOMAIL_FROM_EMAIL?.trim();

  if (!apiKey || !apiUrl || !fromEmail) {
    return null;
  }

  return { apiKey, apiUrl, fromEmail };
}

export async function sendViaZeptoMail(params: {
  to: string;
  subject: string;
  htmlBody: string;
  replyTo?: string;
  toName?: string;
}): Promise<EmailSendResult> {
  const config = getZeptoMailConfig();
  if (!config) {
    return { success: false, error: "ZeptoMail is not configured" };
  }

  const body: Record<string, unknown> = {
    from: { address: config.fromEmail },
    to: [
      {
        email_address: {
          address: params.to,
          ...(params.toName ? { name: params.toName } : {}),
        },
      },
    ],
    subject: params.subject,
    htmlbody: params.htmlBody,
  };

  if (params.replyTo) {
    body.reply_to = [{ address: params.replyTo }];
  }

  try {
    const response = await fetch(config.apiUrl, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `Zoho-enczapikey ${config.apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "unknown error");
      logger.error("ZeptoMail send failed", {
        to: params.to,
        subject: params.subject,
        status: response.status,
        error: errorText,
      });
      return { success: false, error: errorText || `HTTP ${response.status}` };
    }

    return { success: true };
  } catch (err) {
    const error = err instanceof Error ? err.message : "unknown error";
    logger.error("ZeptoMail send failed", {
      to: params.to,
      subject: params.subject,
      error,
    });
    return { success: false, error };
  }
}
