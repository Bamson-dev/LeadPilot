import { randomBytes } from "crypto";
import { supabase } from "./client";

export interface LicenseKey {
  id: string;
  email: string;
  key: string;
  activated: boolean;
  activated_at: string | null;
  payment_channel: "paystack" | "bank_transfer";
  payment_reference: string | null;
  searches_used: number;
  exports_used: number;
  search_count?: number;
  monthly_search_limit?: number;
  export_count?: number;
  last_reset_at?: string | null;
  is_suspended?: boolean;
  suspension_reason?: string | null;
  notes?: string | null;
  created_at: string;
}

export function normalizeLicenseRow(row: Record<string, unknown>): LicenseKey {
  const license = row as LicenseKey;
  return {
    ...license,
    search_count:
      (row.search_count as number | undefined) ??
      (row.searches_used as number | undefined) ??
      0,
    monthly_search_limit: (row.monthly_search_limit as number | undefined) ?? 100,
    export_count:
      (row.export_count as number | undefined) ??
      (row.exports_used as number | undefined) ??
      0,
    is_suspended: Boolean(row.is_suspended),
  };
}

function generateLicenseKeyValue(): string {
  const segment = randomBytes(4).toString("hex").toUpperCase();
  const segment2 = randomBytes(4).toString("hex").toUpperCase();
  return `LP-${segment}-${segment2}`;
}

export async function createLicenseKey(params: {
  email: string;
  paymentChannel: "paystack" | "bank_transfer";
  paymentReference: string;
}): Promise<LicenseKey> {
  const email = params.email.toLowerCase().trim();
  const key = generateLicenseKeyValue().toUpperCase();

  const { data, error } = await supabase
    .from("license_keys")
    .insert({
      email,
      key,
      payment_channel: params.paymentChannel,
      payment_reference: params.paymentReference,
      activated: false,
      monthly_search_limit: 100,
      search_count: 0,
    })
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Failed to create license key");
  }

  return normalizeLicenseRow(data as Record<string, unknown>);
}

export async function getLicenseKeyByKey(key: string): Promise<LicenseKey | null> {
  const normalized = key.trim().toUpperCase();
  const { data, error } = await supabase
    .from("license_keys")
    .select("*")
    .eq("key", normalized)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data ? normalizeLicenseRow(data as Record<string, unknown>) : null;
}

export async function getLicenseKeyByEmail(email: string): Promise<LicenseKey | null> {
  const normalized = email.toLowerCase().trim();
  const { data, error } = await supabase
    .from("license_keys")
    .select("*")
    .eq("email", normalized)
    .order("created_at", { ascending: false })
    .limit(1);

  if (error) throw new Error(error.message);
  const row = data?.[0];
  return row ? normalizeLicenseRow(row as Record<string, unknown>) : null;
}

export async function lookupLicensesByEmail(email: string): Promise<LicenseKey[]> {
  const trimmed = email.trim();
  const normalized = trimmed.toLowerCase();

  let query = supabase.from("license_keys").select("*").order("created_at", { ascending: false }).limit(10);

  if (trimmed.includes("@")) {
    query = query.eq("email", normalized);
  } else {
    query = query.ilike("email", `%${normalized}%`);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => normalizeLicenseRow(row as Record<string, unknown>));
}

export async function activateLicense(licenseId: string): Promise<LicenseKey> {
  const { data, error } = await supabase
    .from("license_keys")
    .update({
      activated: true,
      activated_at: new Date().toISOString(),
    })
    .eq("id", licenseId)
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Failed to activate license");
  }

  return normalizeLicenseRow(data as Record<string, unknown>);
}

export async function getLicenseByPaymentReference(
  reference: string
): Promise<LicenseKey | null> {
  const { data, error } = await supabase
    .from("license_keys")
    .select("*")
    .eq("payment_reference", reference)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data ? normalizeLicenseRow(data as Record<string, unknown>) : null;
}

export async function listRecentLicenses(limit = 50): Promise<LicenseKey[]> {
  const { data, error } = await supabase
    .from("license_keys")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => normalizeLicenseRow(row as Record<string, unknown>));
}

export function truncateLicenseKey(key: string): string {
  if (key.length <= 12) return key;
  return `${key.slice(0, 12)}...`;
}
