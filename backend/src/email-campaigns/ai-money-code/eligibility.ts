import { supabase } from "../../database/client";
import type { AudienceSummary, EligiblePaidUser } from "./types";
import { cached } from "../../observability/query-cache";

type LicenseRow = {
  id: string;
  email: string | null;
  activated: boolean;
  is_suspended: boolean | null;
  payment_reference: string | null;
  payment_channel: string | null;
  created_at: string;
};

function isInternalOrTestEmail(email: string): boolean {
  return (
    /^test/i.test(email) ||
    email.includes("@example.") ||
    email.includes("@mailinator.") ||
    email.endsWith("@leadthur.com") ||
    email.endsWith("@leadpilot.live") ||
    email.startsWith("noreply@") ||
    email.startsWith("no-reply@")
  );
}

function hasUsableEmail(email: string): boolean {
  return /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(email);
}

export async function inspectAudience(): Promise<{
  users: EligiblePaidUser[];
  summary: AudienceSummary;
}> {
  return cached("ai-money-code:inspect-audience", 10 * 60 * 1000, inspectAudienceUncached);
}

async function inspectAudienceUncached(): Promise<{
  users: EligiblePaidUser[];
  summary: AudienceSummary;
}> {
  const { data, error } = await supabase
    .from("license_keys")
    .select("id,email,activated,is_suspended,payment_reference,payment_channel,created_at")
    .eq("activated", true)
    .eq("is_suspended", false);
  if (error) throw new Error(error.message);

  const rows = (data || []) as LicenseRow[];
  const paidRows = rows.filter(
    (r) =>
      !!r.payment_reference &&
      (r.payment_channel === "paystack" ||
        r.payment_channel === "flutterwave" ||
        r.payment_reference.startsWith("manual-"))
  );

  let invalidOrBlankExcluded = 0;
  let internalOrTestExcluded = 0;
  const dedupe = new Map<string, EligiblePaidUser>();
  let duplicatesRemoved = 0;

  for (const row of paidRows) {
    const normalizedEmail = (row.email || "").trim().toLowerCase();
    if (!normalizedEmail || !hasUsableEmail(normalizedEmail)) {
      invalidOrBlankExcluded += 1;
      continue;
    }
    if (isInternalOrTestEmail(normalizedEmail)) {
      internalOrTestExcluded += 1;
      continue;
    }
    const existing = dedupe.get(normalizedEmail);
    if (existing) {
      duplicatesRemoved += 1;
      if (new Date(row.created_at).getTime() > new Date(existing.createdAt).getTime()) {
        dedupe.set(normalizedEmail, {
          licenseId: row.id,
          email: row.email || normalizedEmail,
          normalizedEmail,
          paymentReference: row.payment_reference || "",
          paymentChannel: row.payment_channel,
          createdAt: row.created_at,
        });
      }
      continue;
    }
    dedupe.set(normalizedEmail, {
      licenseId: row.id,
      email: row.email || normalizedEmail,
      normalizedEmail,
      paymentReference: row.payment_reference || "",
      paymentChannel: row.payment_channel,
      createdAt: row.created_at,
    });
  }

  const users = [...dedupe.values()];
  return {
    users,
    summary: {
      paidLicenseRecordsFound: paidRows.length,
      eligibleUniqueEmails: users.length,
      invalidOrBlankExcluded,
      duplicatesRemoved,
      internalOrTestExcluded,
      finalRecipientCount: users.length,
    },
  };
}
