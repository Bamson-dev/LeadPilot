import { getApiUrl } from "@/utils/env";
import { getLicenseHeaders } from "@/services/api";
import type {
  OutreachBalance,
  OutreachEmailTemplate,
  OutreachMailbox,
  OutreachSendTarget,
  OutreachSentEmail,
  QueueSendResponse,
} from "@/types/outreach";

async function parseError(res: Response): Promise<string> {
  const data = (await res.json().catch(() => ({}))) as { error?: string };
  return data.error ?? `Request failed (${res.status})`;
}

export async function fetchOutreachBalance(): Promise<OutreachBalance | null> {
  try {
    const res = await fetch(`${getApiUrl()}/balance`, {
      headers: getLicenseHeaders(),
      cache: "no-store",
    });
    if (!res.ok) return null;
    return (await res.json()) as OutreachBalance;
  } catch {
    return null;
  }
}

export async function fetchMailboxes(): Promise<OutreachMailbox[]> {
  const res = await fetch(`${getApiUrl()}/mailboxes`, {
    headers: getLicenseHeaders(),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(await parseError(res));
  const data = (await res.json()) as { mailboxes?: OutreachMailbox[] };
  return data.mailboxes ?? [];
}

export async function connectMailbox(input: {
  email_address: string;
  app_password: string;
  account_type: "personal" | "workspace";
}): Promise<void> {
  const res = await fetch(`${getApiUrl()}/mailboxes/connect`, {
    method: "POST",
    headers: getLicenseHeaders(),
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(await parseError(res));
}

export async function disconnectMailbox(mailboxId: string): Promise<void> {
  const res = await fetch(`${getApiUrl()}/mailboxes/${encodeURIComponent(mailboxId)}`, {
    method: "DELETE",
    headers: getLicenseHeaders(),
  });
  if (!res.ok) throw new Error(await parseError(res));
}

export async function fetchEmailTemplates(): Promise<OutreachEmailTemplate[]> {
  const res = await fetch(`${getApiUrl()}/email-templates`, { cache: "no-store" });
  if (!res.ok) throw new Error(await parseError(res));
  const data = (await res.json()) as { templates?: OutreachEmailTemplate[] };
  return data.templates ?? [];
}

export async function queueOutreachSend(input: {
  targets: OutreachSendTarget[];
  subject: string;
  body: string;
  template_id?: string;
  mailbox_id?: string;
  send_mode: "auto" | "manual";
}): Promise<QueueSendResponse> {
  const res = await fetch(`${getApiUrl()}/send`, {
    method: "POST",
    headers: getLicenseHeaders(),
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(await parseError(res));
  return (await res.json()) as QueueSendResponse;
}

export async function fetchRecentSends(limit = 50): Promise<OutreachSentEmail[]> {
  const res = await fetch(`${getApiUrl()}/sends?limit=${limit}`, {
    headers: getLicenseHeaders(),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(await parseError(res));
  const data = (await res.json()) as { sends?: OutreachSentEmail[] };
  return data.sends ?? [];
}
