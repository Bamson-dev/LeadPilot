import type { PredictedEmail } from "../types/email";

export type OutreachEmailKind = "verified" | "predicted";

export interface OutreachSendLeadInput {
  id?: string;
  name?: string;
  business_name?: string;
  verifiedEmails?: string[];
  emails?: string[];
  verified_emails?: string[];
  predictedEmails?: PredictedEmail[];
  predicted_emails?: PredictedEmail[];
}

export interface OutreachSendTargetDraft {
  recipient_email: string;
  business_name: string;
  business_id?: string;
  email_kind: OutreachEmailKind;
}

export function getVerifiedEmailAddresses(
  lead: Pick<OutreachSendLeadInput, "verifiedEmails" | "emails" | "verified_emails">
): string[] {
  if (lead.verifiedEmails?.length) {
    return lead.verifiedEmails.map((e) => e.trim()).filter(Boolean);
  }
  if (lead.verified_emails?.length) {
    return lead.verified_emails.map((e) => e.trim()).filter(Boolean);
  }
  if (lead.emails?.length) {
    return lead.emails.map((e) => e.trim()).filter(Boolean);
  }
  return [];
}

export function getPredictedEmailAddresses(
  lead: Pick<OutreachSendLeadInput, "predictedEmails" | "predicted_emails">
): string[] {
  const predicted = lead.predictedEmails?.length
    ? lead.predictedEmails
    : (lead.predicted_emails ?? []);
  return predicted
    .map((p) => (typeof p === "string" ? p : p.email))
    .map((e) => e.trim())
    .filter(Boolean);
}

export function buildOutreachSendTargetFromLead(
  lead: OutreachSendLeadInput
): {
  sendable: OutreachSendTargetDraft | null;
  skippedPredictedOnly: OutreachSendTargetDraft | null;
} {
  const verified = getVerifiedEmailAddresses(lead);
  const predicted = getPredictedEmailAddresses(lead);
  const business_name = (lead.business_name ?? lead.name ?? "").trim();
  const business_id = lead.id?.trim() || undefined;

  if (verified.length > 0) {
    return {
      sendable: {
        recipient_email: verified[0]!.toLowerCase(),
        business_name,
        business_id,
        email_kind: "verified",
      },
      skippedPredictedOnly: null,
    };
  }

  if (predicted.length > 0) {
    return {
      sendable: null,
      skippedPredictedOnly: {
        recipient_email: predicted[0]!.toLowerCase(),
        business_name,
        business_id,
        email_kind: "predicted",
      },
    };
  }

  return { sendable: null, skippedPredictedOnly: null };
}

export function buildOutreachSendTargetsFromLeads(leads: OutreachSendLeadInput[]): {
  targets: OutreachSendTargetDraft[];
  skippedNoVerifiedPreview: number;
} {
  const targets: OutreachSendTargetDraft[] = [];
  let skippedNoVerifiedPreview = 0;

  for (const lead of leads) {
    const { sendable, skippedPredictedOnly } = buildOutreachSendTargetFromLead(lead);
    if (sendable) {
      targets.push(sendable);
    } else if (skippedPredictedOnly) {
      targets.push(skippedPredictedOnly);
      skippedNoVerifiedPreview += 1;
    }
  }

  return { targets, skippedNoVerifiedPreview };
}

export function isVerifiedOutreachTarget(emailKind: OutreachEmailKind | undefined): boolean {
  return emailKind === "verified";
}
