import { randomBytes } from "crypto";
import { supabase } from "./client";
import { generateUniqueRefCode } from "../services/license-service";
import { logger } from "../utils/logger";

export interface LicenseKey {
  id: string;
  email: string;
  key: string;
  activated: boolean;
  activated_at: string | null;
  payment_channel: "paystack" | "bank_transfer" | "flutterwave";
  payment_reference: string | null;
  searches_used: number;
  exports_used: number;
  search_count?: number;
  search_credits?: number;
  total_credits_purchased?: number;
  monthly_search_limit?: number;
  export_count?: number;
  last_reset_at?: string | null;
  is_suspended?: boolean;
  suspension_reason?: string | null;
  max_devices?: number;
  notes?: string | null;
  created_at: string;
}

export function normalizeLicenseRow(row: Record<string, unknown>): LicenseKey {
  const license = row as unknown as LicenseKey;
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
    max_devices: (row.max_devices as number | undefined) ?? 2,
  };
}

function generateLicenseKeyValue(): string {
  const segment = randomBytes(4).toString("hex").toUpperCase();
  const segment2 = randomBytes(4).toString("hex").toUpperCase();
  return `LP-${segment}-${segment2}`;
}

export async function createLicenseKey(params: {
  email: string;
  paymentChannel: "paystack" | "bank_transfer" | "flutterwave";
  paymentReference: string;
}): Promise<LicenseKey> {
  const email = params.email.toLowerCase().trim();
  const key = generateLicenseKeyValue().toUpperCase();
  const refCode = await generateUniqueRefCode();

  const { data, error } = await supabase
    .from("license_keys")
    .insert({
      email,
      key,
      ref_code: refCode,
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

export async function getLicenseByKeyAndEmail(
  key: string,
  email: string
): Promise<LicenseKey | null> {
  const normalizedKey = key.trim().toUpperCase();
  const normalizedEmail = email.toLowerCase().trim();

  const { data, error } = await supabase
    .from("license_keys")
    .select("*")
    .eq("key", normalizedKey)
    .eq("email", normalizedEmail)
    .eq("activated", true)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data ? normalizeLicenseRow(data as Record<string, unknown>) : null;
}

export async function consumeSearch(licenseId: string): Promise<{
  success: boolean;
  reason?: string;
  searchesRemaining: number;
  creditsRemaining: number;
  usedCredits: boolean;
}> {
  const { data: license, error } = await supabase
    .from("license_keys")
    .select(
      "searches_used, search_count, monthly_search_limit, search_credits, last_reset_at, activated, is_suspended, suspension_reason"
    )
    .eq("id", licenseId)
    .single();

  if (error || !license) {
    return {
      success: false,
      reason: "License not found",
      searchesRemaining: 0,
      creditsRemaining: 0,
      usedCredits: false,
    };
  }

  if (!license.activated) {
    return {
      success: false,
      reason: "License not activated",
      searchesRemaining: 0,
      creditsRemaining: 0,
      usedCredits: false,
    };
  }

  if (license.is_suspended) {
    return {
      success: false,
      reason:
        (license.suspension_reason as string | null) ||
        "Account suspended. Contact support.",
      searchesRemaining: 0,
      creditsRemaining: 0,
      usedCredits: false,
    };
  }

  const now = new Date();
  const lastResetRaw = license.last_reset_at as string | null;
  const lastReset = lastResetRaw ? new Date(lastResetRaw) : now;
  const monthsSinceReset =
    (now.getFullYear() - lastReset.getFullYear()) * 12 +
    (now.getMonth() - lastReset.getMonth());

  let searchesUsed =
    (license.search_count as number | undefined) ??
    (license.searches_used as number | undefined) ??
    0;

  if (monthsSinceReset >= 1) {
    await supabase
      .from("license_keys")
      .update({
        searches_used: 0,
        search_count: 0,
        last_reset_at: now.toISOString(),
        limit_email_sent: false,
      })
      .eq("id", licenseId);

    searchesUsed = 0;
  }

  const monthlyLimit = (license.monthly_search_limit as number | undefined) ?? 100;
  const creditsRemaining = (license.search_credits as number | undefined) ?? 0;
  const freeRemaining = monthlyLimit - searchesUsed;

  if (freeRemaining > 0) {
    const nextCount = searchesUsed + 1;
    await supabase
      .from("license_keys")
      .update({ searches_used: nextCount, search_count: nextCount })
      .eq("id", licenseId);

    return {
      success: true,
      searchesRemaining: freeRemaining - 1,
      creditsRemaining,
      usedCredits: false,
    };
  }

  if (creditsRemaining >= 3) {
    await supabase
      .from("license_keys")
      .update({ search_credits: creditsRemaining - 3 })
      .eq("id", licenseId);

    return {
      success: true,
      searchesRemaining: 0,
      creditsRemaining: creditsRemaining - 3,
      usedCredits: true,
    };
  }

  return {
    success: false,
    reason: "Search limit reached",
    searchesRemaining: 0,
    creditsRemaining,
    usedCredits: false,
  };
}

export async function checkAndIncrementSearchCount(licenseId: string): Promise<{
  allowed: boolean;
  remaining: number;
  reason?: string;
  creditsRemaining?: number;
  usedCredits?: boolean;
}> {
  const result = await consumeSearch(licenseId);

  if (!result.success) {
    return {
      allowed: false,
      remaining: 0,
      reason: result.reason,
      creditsRemaining: result.creditsRemaining,
    };
  }

  return {
    allowed: true,
    remaining: result.searchesRemaining,
    creditsRemaining: result.creditsRemaining,
    usedCredits: result.usedCredits,
  };
}

export async function getLicenseEmailBySearchId(
  searchId: string
): Promise<string | null> {
  try {
    const { data: userSearch } = await supabase
      .from("user_searches")
      .select("license_key")
      .eq("search_id", searchId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!userSearch?.license_key) return null;

    const { data: license } = await supabase
      .from("license_keys")
      .select("email")
      .eq("key", userSearch.license_key as string)
      .maybeSingle();

    return (license?.email as string) ?? null;
  } catch {
    return null;
  }
}

function normalizeDeviceSignature(value: string | null | undefined): string {
  return String(value ?? "").trim();
}

function isLegacyFingerprintSignature(signature: string): boolean {
  return /^[a-z0-9]{1,15}$/i.test(signature);
}

function isStableDeviceId(signature: string): boolean {
  return (
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      signature
    ) || signature.startsWith("dev-")
  );
}

export async function registerDevice(
  licenseId: string,
  deviceSignature: string
): Promise<{ allowed: boolean; reason?: string }> {
  const normalizedSignature = normalizeDeviceSignature(deviceSignature);
  if (!normalizedSignature) {
    return { allowed: false, reason: "Invalid device signature" };
  }

  const { data, error } = await supabase
    .from("license_keys")
    .select("device_one, device_two, device_three, device_four, max_devices")
    .eq("id", licenseId)
    .single();

  if (error || !data) {
    logger.error("registerDevice license lookup failed", {
      licenseId,
      error: error?.message ?? "no data",
    });
    return { allowed: false, reason: "License not found" };
  }

  const maxDevices = Math.min(4, Math.max(1, (data.max_devices as number | null) || 4));

  const slots = [
    { key: "device_one" as const, value: data.device_one as string | null },
    { key: "device_two" as const, value: data.device_two as string | null },
    { key: "device_three" as const, value: data.device_three as string | null },
    { key: "device_four" as const, value: data.device_four as string | null },
  ];

  const isFilled = (value: string | null | undefined) =>
    normalizeDeviceSignature(value) !== "";

  // Recognise returning device on any slot (even if limit was lowered later)
  if (slots.some((s) => normalizeDeviceSignature(s.value) === normalizedSignature)) {
    return { allowed: true };
  }

  const activeSlots = slots.slice(0, maxDevices);
  const filledActive = activeSlots.filter((s) => isFilled(s.value)).length;

  if (filledActive >= maxDevices) {
    const filledSignatures = slots
      .filter((s) => isFilled(s.value))
      .map((s) => normalizeDeviceSignature(s.value));

    // Clients used to send unstable browser fingerprints. When slots are full of
    // those legacy ids and the client now sends a stable UUID, reset to that device.
    if (
      isStableDeviceId(normalizedSignature) &&
      filledSignatures.length > 0 &&
      filledSignatures.every(isLegacyFingerprintSignature)
    ) {
      const { error: resetError } = await supabase
        .from("license_keys")
        .update({
          device_one: normalizedSignature,
          device_two: null,
          device_three: null,
          device_four: null,
        })
        .eq("id", licenseId);

      if (resetError) {
        logger.error("registerDevice legacy migration failed", {
          licenseId,
          error: resetError.message,
        });
        return { allowed: false, reason: "Device registration failed. Try again." };
      }

      logger.info("registerDevice migrated legacy fingerprints to stable device id", {
        licenseId,
      });
      return { allowed: true };
    }

    return {
      allowed: false,
      reason:
        "Maximum devices reached. Contact support on WhatsApp 09067285890 to reset your devices.",
    };
  }

  const emptySlot = activeSlots.find((s) => !isFilled(s.value));

  if (emptySlot) {
    const { error: updateError } = await supabase
      .from("license_keys")
      .update({ [emptySlot.key]: normalizedSignature })
      .eq("id", licenseId);

    if (updateError) {
      logger.error("registerDevice slot update failed", {
        licenseId,
        slot: emptySlot.key,
        error: updateError.message,
      });
      return { allowed: false, reason: "Device registration failed. Try again." };
    }

    return { allowed: true };
  }

  return {
    allowed: false,
    reason:
      "Maximum devices reached. Contact support on WhatsApp 09067285890 to reset your devices.",
  };
}

export async function resetDevices(licenseId: string): Promise<void> {
  await supabase
    .from("license_keys")
    .update({
      device_one: null,
      device_two: null,
      device_three: null,
      device_four: null,
    })
    .eq("id", licenseId);
}
