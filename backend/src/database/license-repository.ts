import { randomBytes } from "crypto";
import { supabase } from "./client";
import { queryPg, isPgConfigured } from "./pg-pool";
import { isSupabaseServiceRestricted } from "./supabase-errors";
import { generateUniqueRefCode } from "../services/license-service";
import { trackEvent } from "../observability/track";
import { EVENT_NAMES } from "../observability/event-taxonomy";
import { logger } from "../utils/logger";

/** Columns used by /auth/status — known-good on production PostgREST. */
export const LICENSE_AUTH_SELECT =
  "id, email, key, activated, is_suspended, suspension_reason";

/** PostgREST returns PGRST116 when `.single()` gets zero or multiple rows. */
export function isSupabaseRowNotFound(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  if (error.code === "PGRST116") return true;
  return /0 rows|multiple \(or no\) rows returned/i.test(error.message ?? "");
}

/** Broader read shape for admin/repository callers. */
export const LICENSE_ROW_SELECT =
  "id, email, key, activated, activated_at, payment_channel, payment_reference, searches_used, exports_used, search_count, monthly_search_limit, export_count, last_reset_at, is_suspended, suspension_reason, max_devices, notes, search_credits, total_credits_purchased, created_at";

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

type AuthLicenseRow = Pick<
  LicenseKey,
  "id" | "email" | "key" | "activated" | "is_suspended" | "suspension_reason"
>;

async function lookupLicenseAuthRowPg(
  key: string,
  email?: string
): Promise<AuthLicenseRow | null | undefined> {
  if (!isPgConfigured()) return undefined;
  const params = email ? [key, email] : [key];
  const emailClause = email ? "and email = $2" : "";
  const rows = await queryPg<Record<string, unknown>>(
    `select id, email, key, activated, is_suspended, suspension_reason
     from license_keys
     where key = $1 ${emailClause}
     limit 1`,
    params
  );
  if (rows === null) return undefined;
  const row = rows[0];
  return row ? (normalizeLicenseRow(row) as AuthLicenseRow) : null;
}

export type LicenseAuthLookupResult = {
  license: AuthLicenseRow | null;
  unavailable: boolean;
  viaPg: boolean;
};

/** License read for login flows — falls back to direct Postgres when REST is restricted. */
export async function lookupLicenseAuthRow(
  key: string,
  email?: string
): Promise<LicenseAuthLookupResult> {
  const normalizedKey = key.trim().toUpperCase();
  const normalizedEmail = email?.toLowerCase().trim();

  let query = supabase
    .from("license_keys")
    .select(LICENSE_AUTH_SELECT)
    .eq("key", normalizedKey);
  if (normalizedEmail) query = query.eq("email", normalizedEmail);
  const { data, error } = await query.single();

  if (!error && data) {
    return {
      license: normalizeLicenseRow(data as Record<string, unknown>) as AuthLicenseRow,
      unavailable: false,
      viaPg: false,
    };
  }
  if (error && isSupabaseRowNotFound(error)) {
    return { license: null, unavailable: false, viaPg: false };
  }

  const shouldPgFallback =
    Boolean(error) &&
    (isSupabaseServiceRestricted(error) || isPgConfigured());

  if (shouldPgFallback) {
    const pgLicense = await lookupLicenseAuthRowPg(normalizedKey, normalizedEmail);
    if (pgLicense !== undefined) {
      return { license: pgLicense, unavailable: false, viaPg: true };
    }
  }

  if (error) {
    logger.error("lookupLicenseAuthRow failed", {
      keyPrefix: normalizedKey.slice(0, 8),
      error: error.message,
    });
  }
  return { license: null, unavailable: true, viaPg: false };
}

export async function probeLicenseAuthLookup(): Promise<{
  ok: boolean;
  viaPg: boolean;
  code: string | null;
  message: string | null;
}> {
  const probe = await lookupLicenseAuthRow("__health_probe__", "health-probe@invalid.local");
  if (!probe.unavailable) {
    return { ok: true, viaPg: probe.viaPg, code: null, message: null };
  }
  return {
    ok: false,
    viaPg: false,
    code: "SERVICE_RESTRICTED",
    message: isPgConfigured()
      ? "Supabase REST unavailable and Postgres fallback failed"
      : "Supabase REST restricted — set SUPABASE_DB_PASSWORD in Coolify for Postgres fallback",
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
    .select(LICENSE_ROW_SELECT)
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Failed to create license key");
  }

  const license = normalizeLicenseRow(data as Record<string, unknown>);
  trackEvent({
    eventName: EVENT_NAMES.REFERRAL_SIGNUP,
    source: "server",
    userEmail: email,
    licenseId: license.id,
    properties: { refCode },
    idempotencyKey: `referral_signup:${license.id}`,
  });

  return license;
}

export async function getLicenseKeyByKey(key: string): Promise<LicenseKey | null> {
  const normalized = key.trim().toUpperCase();
  const { data, error } = await supabase
    .from("license_keys")
    .select(LICENSE_AUTH_SELECT)
    .eq("key", normalized)
    .maybeSingle();

  if (error) {
    logger.error("getLicenseKeyByKey failed", {
      keyPrefix: normalized.slice(0, 8),
      error: error.message,
    });
    return null;
  }
  return data ? normalizeLicenseRow(data as Record<string, unknown>) : null;
}

export async function getLicenseKeyByEmail(email: string): Promise<LicenseKey | null> {
  const normalized = email.toLowerCase().trim();
  const { data, error } = await supabase
    .from("license_keys")
    .select(LICENSE_ROW_SELECT)
    .eq("email", normalized)
    .order("created_at", { ascending: false })
    .limit(1);

  if (error) {
    logger.error("getLicenseKeyByEmail failed", { error: error.message });
    return null;
  }
  const row = data?.[0];
  return row ? normalizeLicenseRow(row as Record<string, unknown>) : null;
}

export async function lookupLicensesByEmail(email: string): Promise<LicenseKey[]> {
  const trimmed = email.trim();
  const normalized = trimmed.toLowerCase();

  let query = supabase
    .from("license_keys")
    .select(LICENSE_ROW_SELECT)
    .order("created_at", { ascending: false })
    .limit(10);

  if (trimmed.includes("@")) {
    query = query.eq("email", normalized);
  } else {
    query = query.ilike("email", `%${normalized}%`);
  }

  const { data, error } = await query;
  if (error) {
    logger.error("lookupLicensesByEmail failed", { error: error.message });
    return [];
  }
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
    .select(LICENSE_ROW_SELECT)
    .single();

  if (!error && data) {
    return normalizeLicenseRow(data as Record<string, unknown>);
  }

  if (error && !isSupabaseServiceRestricted(error) && !isPgConfigured()) {
    throw new Error(error.message ?? "Failed to activate license");
  }

  const rows = await queryPg<Record<string, unknown>>(
    `update license_keys
     set activated = true, activated_at = now()
     where id = $1
     returning *`,
    [licenseId]
  );
  const row = rows?.[0];
  if (!row) {
    throw new Error(error?.message ?? "Failed to activate license");
  }
  return normalizeLicenseRow(row);
}

export async function getLicenseByPaymentReference(
  reference: string
): Promise<LicenseKey | null> {
  const { data, error } = await supabase
    .from("license_keys")
    .select(LICENSE_ROW_SELECT)
    .eq("payment_reference", reference)
    .maybeSingle();

  if (error) {
    logger.error("getLicenseByPaymentReference failed", {
      referencePrefix: reference.slice(0, 12),
      error: error.message,
    });
    return null;
  }
  return data ? normalizeLicenseRow(data as Record<string, unknown>) : null;
}

export async function listRecentLicenses(limit = 50): Promise<LicenseKey[]> {
  const { data, error } = await supabase
    .from("license_keys")
    .select(LICENSE_ROW_SELECT)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    logger.error("listRecentLicenses failed", { error: error.message });
    return [];
  }
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
    .select(LICENSE_ROW_SELECT)
    .eq("key", normalizedKey)
    .eq("email", normalizedEmail)
    .eq("activated", true)
    .maybeSingle();

  if (error) {
    logger.error("getLicenseByKeyAndEmail failed", {
      keyPrefix: normalizedKey.slice(0, 8),
      error: error.message,
    });
    return null;
  }
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

const PHANTOM_DEVICE_VALUES = new Set(["null", "undefined", "none", "n/a", "0"]);

function normalizeDeviceSignature(value: string | null | undefined): string {
  return String(value ?? "").trim();
}

function effectiveDeviceSignature(value: string | null | undefined): string {
  const normalized = normalizeDeviceSignature(value);
  if (!normalized) return "";
  if (PHANTOM_DEVICE_VALUES.has(normalized.toLowerCase())) return "";
  return normalized;
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

function isStaleDeviceSignature(signature: string): boolean {
  return (
    !signature ||
    PHANTOM_DEVICE_VALUES.has(signature.toLowerCase()) ||
    isLegacyFingerprintSignature(signature)
  );
}

async function writeDeviceSlot(
  licenseId: string,
  slotKey: "device_one" | "device_two" | "device_three" | "device_four",
  deviceSignature: string
): Promise<{ ok: boolean; reason?: string }> {
  const { error } = await supabase
    .from("license_keys")
    .update({ [slotKey]: deviceSignature })
    .eq("id", licenseId);

  if (!error) return { ok: true };

  if (!isSupabaseServiceRestricted(error) && !isPgConfigured()) {
    logger.error("registerDevice slot update failed", {
      licenseId,
      slot: slotKey,
      error: error.message,
    });
    return { ok: false, reason: "Device registration failed. Try again." };
  }

  const rows = await queryPg(
    `update license_keys set ${slotKey} = $1 where id = $2 returning id`,
    [deviceSignature, licenseId]
  );
  if (rows?.[0]) return { ok: true };

  logger.error("registerDevice slot update failed", {
    licenseId,
    slot: slotKey,
    error: error.message,
  });
  return { ok: false, reason: "Device registration failed. Try again." };
}

async function resetDevicesToSingle(
  licenseId: string,
  deviceSignature: string,
  reason: string
): Promise<{ allowed: boolean; reason?: string }> {
  const { error: resetError } = await supabase
    .from("license_keys")
    .update({
      device_one: deviceSignature,
      device_two: null,
      device_three: null,
      device_four: null,
    })
    .eq("id", licenseId);

  if (resetError) {
    if (isSupabaseServiceRestricted(resetError) || isPgConfigured()) {
      const rows = await queryPg(
        `update license_keys
         set device_one = $1, device_two = null, device_three = null, device_four = null
         where id = $2
         returning id`,
        [deviceSignature, licenseId]
      );
      if (rows?.[0]) {
        logger.info("registerDevice reset device slots via pg", { licenseId, reason });
        return { allowed: true };
      }
    }
    logger.error("registerDevice device reset failed", {
      licenseId,
      error: resetError.message,
      reason,
    });
    return { allowed: false, reason: "Device registration failed. Try again." };
  }

  logger.info("registerDevice reset device slots", { licenseId, reason });
  return { allowed: true };
}

export async function registerDevice(
  licenseId: string,
  deviceSignature: string,
  options?: { isActivation?: boolean }
): Promise<{ allowed: boolean; reason?: string }> {
  const normalizedSignature = effectiveDeviceSignature(deviceSignature);
  if (!normalizedSignature) {
    return { allowed: false, reason: "Invalid device signature" };
  }

  const { data, error } = await supabase
    .from("license_keys")
    .select(
      "device_one, device_two, device_three, device_four, max_devices, search_count, searches_used"
    )
    .eq("id", licenseId)
    .single();

  let licenseData = data as Record<string, unknown> | null;
  if ((error || !licenseData) && (isSupabaseServiceRestricted(error) || isPgConfigured())) {
    const rows = await queryPg<Record<string, unknown>>(
      `select device_one, device_two, device_three, device_four, max_devices, search_count, searches_used
       from license_keys where id = $1 limit 1`,
      [licenseId]
    );
    licenseData = rows?.[0] ?? null;
  }

  if (!licenseData) {
    logger.error("registerDevice license lookup failed", {
      licenseId,
      error: error?.message ?? "no data",
    });
    return { allowed: false, reason: "License not found" };
  }

  const storedMax = (licenseData.max_devices as number | null) || 4;
  const maxDevices = Math.min(4, Math.max(4, storedMax));
  const searchesUsed = Math.max(
    Number(licenseData.search_count ?? 0),
    Number(licenseData.searches_used ?? 0)
  );

  const slots = [
    { key: "device_one" as const, value: licenseData.device_one as string | null },
    { key: "device_two" as const, value: licenseData.device_two as string | null },
    { key: "device_three" as const, value: licenseData.device_three as string | null },
    { key: "device_four" as const, value: licenseData.device_four as string | null },
  ];

  const isFilled = (value: string | null | undefined) =>
    effectiveDeviceSignature(value) !== "";

  // Recognise returning device on any slot (even if limit was lowered later)
  if (
    slots.some((s) => effectiveDeviceSignature(s.value) === normalizedSignature)
  ) {
    return { allowed: true };
  }

  const activeSlots = slots.slice(0, maxDevices);
  const filledSignatures = [
    ...new Set(
      activeSlots
        .map((s) => effectiveDeviceSignature(s.value))
        .filter((signature) => signature !== "")
    ),
  ];
  const filledActive = filledSignatures.length;

  if (filledActive >= maxDevices) {
    const allStoredSignatures = slots
      .map((s) => effectiveDeviceSignature(s.value))
      .filter((signature) => signature !== "");

    if (
      isStableDeviceId(normalizedSignature) &&
      allStoredSignatures.length > 0 &&
      allStoredSignatures.every(isStaleDeviceSignature)
    ) {
      return resetDevicesToSingle(
        licenseId,
        normalizedSignature,
        "legacy_or_phantom_slots"
      );
    }

    if (isStableDeviceId(normalizedSignature)) {
      const legacySlot = activeSlots.find((slot) =>
        isStaleDeviceSignature(effectiveDeviceSignature(slot.value))
      );
      if (legacySlot) {
        const write = await writeDeviceSlot(
          licenseId,
          legacySlot.key,
          normalizedSignature
        );
        if (!write.ok) return { allowed: false, reason: write.reason };
        logger.info("registerDevice replaced legacy device slot", {
          licenseId,
          slot: legacySlot.key,
        });
        return { allowed: true };
      }
    }

    if (
      options?.isActivation &&
      isStableDeviceId(normalizedSignature)
    ) {
      const emptySlot = activeSlots.find((s) => !isFilled(s.value));
      if (emptySlot) {
        const write = await writeDeviceSlot(
          licenseId,
          emptySlot.key,
          normalizedSignature
        );
        if (write.ok) return { allowed: true };
        return { allowed: false, reason: write.reason };
      }

      const slotToEvict = [...activeSlots].reverse().find((s) => isFilled(s.value));
      if (slotToEvict) {
        const write = await writeDeviceSlot(
          licenseId,
          slotToEvict.key,
          normalizedSignature
        );
        if (!write.ok) return { allowed: false, reason: write.reason };
        logger.info("registerDevice activation evicted slot for re-login", {
          licenseId,
          slot: slotToEvict.key,
        });
        return { allowed: true };
      }
    }

    if (
      options?.isActivation &&
      isStableDeviceId(normalizedSignature) &&
      searchesUsed === 0
    ) {
      return resetDevicesToSingle(
        licenseId,
        normalizedSignature,
        "activation_unused_license"
      );
    }

    return {
      allowed: false,
      reason:
        "Maximum devices reached. Contact support on WhatsApp 09067285890 to reset your devices.",
    };
  }

  const emptySlot = activeSlots.find((s) => !isFilled(s.value));

  if (emptySlot) {
    const write = await writeDeviceSlot(licenseId, emptySlot.key, normalizedSignature);
    if (!write.ok) return { allowed: false, reason: write.reason };
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
