import { getApiUrl } from "@/utils/env";
import { getLicenseHeaders } from "@/services/api";
import type { AffiliateBank, AffiliateStats } from "@/types/affiliate";

async function parseError(res: Response): Promise<string> {
  const data = (await res.json().catch(() => ({}))) as { error?: string; message?: string };
  return data.error ?? data.message ?? `Request failed (${res.status})`;
}

export async function fetchAffiliateStats(): Promise<AffiliateStats | null> {
  try {
    const res = await fetch(`${getApiUrl()}/affiliate/stats`, {
      headers: getLicenseHeaders(),
      cache: "no-store",
    });
    if (!res.ok) return null;
    return (await res.json()) as AffiliateStats;
  } catch {
    return null;
  }
}

export async function fetchAffiliateBanks(): Promise<AffiliateBank[]> {
  const res = await fetch(`${getApiUrl()}/affiliate/banks`, { cache: "no-store" });
  if (!res.ok) throw new Error(await parseError(res));
  const data = (await res.json()) as { banks?: AffiliateBank[] };
  return data.banks ?? [];
}

export async function resolveAffiliateAccount(input: {
  accountNumber: string;
  bankCode: string;
}): Promise<{ accountName: string }> {
  const res = await fetch(`${getApiUrl()}/affiliate/resolve-account`, {
    method: "POST",
    headers: {
      ...getLicenseHeaders(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });
  const data = (await res.json().catch(() => ({}))) as {
    accountName?: string;
    error?: string;
  };
  if (!res.ok || !data.accountName) {
    throw new Error(data.error ?? "Could not resolve account. Check your details.");
  }
  return { accountName: data.accountName };
}

export async function saveAffiliateBankDetails(input: {
  accountNumber: string;
  bankCode: string;
  bankName: string;
  accountName: string;
}): Promise<void> {
  const res = await fetch(`${getApiUrl()}/affiliate/bank-details`, {
    method: "POST",
    headers: {
      ...getLicenseHeaders(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });
  const data = (await res.json().catch(() => ({}))) as {
    success?: boolean;
    error?: string;
  };
  if (!res.ok || !data.success) {
    throw new Error(data.error ?? "Failed to save bank details.");
  }
}

export async function requestAffiliatePayout(): Promise<string> {
  const res = await fetch(`${getApiUrl()}/affiliate/request-payout`, {
    method: "POST",
    headers: getLicenseHeaders(),
  });
  const data = (await res.json().catch(() => ({}))) as {
    success?: boolean;
    message?: string;
    error?: string;
  };
  if (!res.ok || !data.success) {
    throw new Error(data.error ?? "Failed to submit payout request.");
  }
  return data.message ?? "Payout request submitted.";
}
