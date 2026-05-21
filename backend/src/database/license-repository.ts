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
  created_at: string;
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
    })
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Failed to create license key");
  }

  return data as LicenseKey;
}

export async function getLicenseKeyByKey(key: string): Promise<LicenseKey | null> {
  const normalized = key.trim().toUpperCase();
  const { data, error } = await supabase
    .from("license_keys")
    .select("*")
    .eq("key", normalized)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data ? (data as LicenseKey) : null;
}

export async function getLicenseKeyByEmail(email: string): Promise<LicenseKey | null> {
  const { data, error } = await supabase
    .from("license_keys")
    .select("*")
    .eq("email", email.toLowerCase().trim())
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data ? (data as LicenseKey) : null;
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

  return data as LicenseKey;
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
  return data ? (data as LicenseKey) : null;
}

export async function listRecentLicenses(limit = 50): Promise<LicenseKey[]> {
  const { data, error } = await supabase
    .from("license_keys")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);
  return (data ?? []) as LicenseKey[];
}

export function truncateLicenseKey(key: string): string {
  if (key.length <= 12) return key;
  return `${key.slice(0, 12)}...`;
}
