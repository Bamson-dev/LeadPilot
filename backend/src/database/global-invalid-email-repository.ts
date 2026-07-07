import { supabase } from "./client";
import { logger } from "../utils/logger";

export interface GlobalInvalidEmailRow {
  email: string;
  smtp_code: number | null;
  reason: string;
  bounced_at: string;
}

export async function isGloballyInvalidEmail(email: string): Promise<boolean> {
  const normalized = email.toLowerCase().trim();
  const { data, error } = await supabase
    .from("global_invalid_emails")
    .select("email")
    .eq("email", normalized)
    .maybeSingle();

  if (error) {
    logger.warn("[global-invalid-email] Lookup failed", {
      email: normalized,
      error: error.message,
    });
    return false;
  }

  return Boolean(data);
}

export async function addGloballyInvalidEmail(params: {
  email: string;
  smtpCode?: number | null;
  reason: string;
}): Promise<void> {
  const normalized = params.email.toLowerCase().trim();
  const { error } = await supabase.from("global_invalid_emails").upsert(
    {
      email: normalized,
      smtp_code: params.smtpCode ?? null,
      reason: params.reason,
      bounced_at: new Date().toISOString(),
    },
    { onConflict: "email" }
  );

  if (error) {
    logger.warn("[global-invalid-email] Upsert failed", {
      email: normalized,
      error: error.message,
    });
  }
}
