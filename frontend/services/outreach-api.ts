import { getApiUrl } from "@/utils/env";
import { getLicenseHeaders } from "@/services/api";
import type {
  OutreachBalance,
  OutreachCheckoutResponse,
  OutreachCreditPackId,
  OutreachEmailTemplate,
  OutreachMailbox,
  OutreachSubscriptionTierId,
  OutreachSendTarget,
  OutreachSendsReport,
  OutreachSentEmail,
  FetchSendsReportParams,
  GenerateOutreachEmailInput,
  GenerateOutreachEmailResult,
  OutreachFollowupConfigInput,
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
  followups?: OutreachFollowupConfigInput;
}): Promise<QueueSendResponse> {
  const res = await fetch(`${getApiUrl()}/send`, {
    method: "POST",
    headers: getLicenseHeaders(),
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(await parseError(res));
  return (await res.json()) as QueueSendResponse;
}

export async function markSentEmailReplied(sentEmailId: string): Promise<void> {
  const res = await fetch(`${getApiUrl()}/sends/${encodeURIComponent(sentEmailId)}/replied`, {
    method: "POST",
    headers: getLicenseHeaders(),
  });
  if (!res.ok) throw new Error(await parseError(res));
}

export async function markRecipientReplied(recipientEmail: string): Promise<void> {
  const res = await fetch(`${getApiUrl()}/sends/replied-by-recipient`, {
    method: "POST",
    headers: getLicenseHeaders(),
    body: JSON.stringify({ recipient_email: recipientEmail }),
  });
  if (!res.ok) throw new Error(await parseError(res));
}

export async function fetchRecentSends(limit = 50): Promise<OutreachSentEmail[]> {
  const report = await fetchSendsReport({ limit, offset: 0 });
  return report.sends;
}

export async function fetchSendsReport(
  params: FetchSendsReportParams = {}
): Promise<OutreachSendsReport> {
  const search = new URLSearchParams();
  search.set("limit", String(params.limit ?? 25));
  search.set("offset", String(params.offset ?? 0));
  if (params.status && params.status !== "all") {
    search.set("status", params.status);
  }
  if (params.sort) {
    search.set("sort", params.sort);
  }

  const res = await fetch(`${getApiUrl()}/sends?${search.toString()}`, {
    headers: getLicenseHeaders(),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(await parseError(res));
  return (await res.json()) as OutreachSendsReport;
}

export async function generateOutreachEmail(
  input: GenerateOutreachEmailInput
): Promise<GenerateOutreachEmailResult> {
  const res = await fetch(`${getApiUrl()}/outreach/generate-email`, {
    method: "POST",
    headers: getLicenseHeaders(),
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(await parseError(res));
  return (await res.json()) as GenerateOutreachEmailResult;
}

export async function initializeOutreachSubscriptionCheckout(
  tier: OutreachSubscriptionTierId
): Promise<OutreachCheckoutResponse> {
  const res = await fetch(`${getApiUrl()}/checkout`, {
    method: "POST",
    headers: getLicenseHeaders(),
    body: JSON.stringify({
      type: "subscription",
      tier,
    }),
  });
  if (!res.ok) throw new Error(await parseError(res));
  return (await res.json()) as OutreachCheckoutResponse;
}

export async function initializeOutreachPackCheckout(
  packId: OutreachCreditPackId
): Promise<OutreachCheckoutResponse> {
  const res = await fetch(`${getApiUrl()}/checkout`, {
    method: "POST",
    headers: getLicenseHeaders(),
    body: JSON.stringify({
      type: "pack",
      pack_id: packId,
    }),
  });
  if (!res.ok) throw new Error(await parseError(res));
  return (await res.json()) as OutreachCheckoutResponse;
}
