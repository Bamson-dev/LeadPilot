import { supabase } from "../../database/client";
import { logger } from "../../utils/logger";
import {
  CAMPAIGN_KEY,
  CAMPAIGN_NAME,
  CAMPAIGN_START_DATE,
  CAMPAIGN_TIMEZONE,
  DEADLINE_AT_ISO,
  OFFER_URL,
  WEBINAR_URL,
  type CampaignRecipient,
  type CampaignRunLog,
  type CampaignSend,
  type CampaignSettings,
  type EligiblePaidUser,
} from "./types";

export async function ensureCampaignSettings(): Promise<CampaignSettings> {
  const { data, error } = await supabase
    .from("email_campaign_settings")
    .select("*")
    .eq("campaign_key", CAMPAIGN_KEY)
    .single();
  if (!error && data) {
    return data as CampaignSettings;
  }

  const now = new Date().toISOString();
  const { error: insertError } = await supabase
    .from("email_campaign_settings")
    .insert({
      campaign_key: CAMPAIGN_KEY,
      campaign_name: CAMPAIGN_NAME,
      enabled: false,
      activated_at: null,
      campaign_start_date: CAMPAIGN_START_DATE,
      timezone: CAMPAIGN_TIMEZONE,
      deadline_at: DEADLINE_AT_ISO,
      webinar_url: WEBINAR_URL,
      offer_url: OFFER_URL,
      created_at: now,
      updated_at: now,
    });
  if (insertError) throw new Error(insertError.message);

  const { data: inserted, error: readError } = await supabase
    .from("email_campaign_settings")
    .select("*")
    .eq("campaign_key", CAMPAIGN_KEY)
    .single();
  if (readError) throw new Error(readError.message);
  return inserted as CampaignSettings;
}

export async function setCampaignEnabled(enabled: boolean): Promise<void> {
  const updates: Record<string, unknown> = {
    enabled,
    updated_at: new Date().toISOString(),
  };
  if (enabled) updates.activated_at = new Date().toISOString();
  const { error } = await supabase
    .from("email_campaign_settings")
    .update(updates)
    .eq("campaign_key", CAMPAIGN_KEY);
  if (error) throw new Error(error.message);
}

export async function enrollRecipients(users: EligiblePaidUser[]): Promise<number> {
  if (!users.length) return 0;
  const rows = users.map((u) => ({
    campaign_key: CAMPAIGN_KEY,
    license_id: u.licenseId,
    email: u.email,
    normalized_email: u.normalizedEmail,
    eligibility_at: new Date().toISOString(),
    status: "enrolled",
    updated_at: new Date().toISOString(),
  }));
  const { error } = await supabase
    .from("email_campaign_recipients")
    .upsert(rows, { onConflict: "campaign_key,normalized_email" });
  if (error) throw new Error(error.message);

  const { count, error: countError } = await supabase
    .from("email_campaign_recipients")
    .select("id", { head: true, count: "exact" })
    .eq("campaign_key", CAMPAIGN_KEY);
  if (countError) throw new Error(countError.message);
  return count || 0;
}

export async function listEnrolledRecipients(): Promise<CampaignRecipient[]> {
  const { data, error } = await supabase
    .from("email_campaign_recipients")
    .select("*")
    .eq("campaign_key", CAMPAIGN_KEY)
    .eq("status", "enrolled");
  if (error) throw new Error(error.message);
  return (data || []) as CampaignRecipient[];
}

export async function getSuccessfulSend(
  recipientId: string,
  day: number
): Promise<CampaignSend | null> {
  const { data, error } = await supabase
    .from("email_campaign_sends")
    .select("*")
    .eq("campaign_key", CAMPAIGN_KEY)
    .eq("recipient_id", recipientId)
    .eq("campaign_day", day)
    .eq("status", "success")
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as CampaignSend | null) || null;
}

export async function getLatestSend(
  recipientId: string,
  day: number
): Promise<CampaignSend | null> {
  const { data, error } = await supabase
    .from("email_campaign_sends")
    .select("*")
    .eq("campaign_key", CAMPAIGN_KEY)
    .eq("recipient_id", recipientId)
    .eq("campaign_day", day)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as CampaignSend | null) || null;
}

export async function createPendingSend(input: {
  recipient: CampaignRecipient;
  day: number;
  scheduledDate: string;
  subject: string;
  ctaUrl: string;
  retryCount: number;
}): Promise<CampaignSend> {
  const { data, error } = await supabase
    .from("email_campaign_sends")
    .insert({
      campaign_key: CAMPAIGN_KEY,
      recipient_id: input.recipient.id,
      normalized_email: input.recipient.normalized_email,
      campaign_day: input.day,
      scheduled_date: input.scheduledDate,
      subject: input.subject,
      cta_url: input.ctaUrl,
      status: "pending",
      retry_count: input.retryCount,
      updated_at: new Date().toISOString(),
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data as CampaignSend;
}

export async function markSendSuccess(sendId: string, messageId: string | null): Promise<void> {
  const { error } = await supabase
    .from("email_campaign_sends")
    .update({
      status: "success",
      provider_message_id: messageId,
      sent_at: new Date().toISOString(),
      error_summary: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", sendId);
  if (error) throw new Error(error.message);
}

export async function markSendFailed(sendId: string, errorSummary: string): Promise<void> {
  const { error } = await supabase
    .from("email_campaign_sends")
    .update({
      status: "failed",
      error_summary: errorSummary.slice(0, 500),
      updated_at: new Date().toISOString(),
    })
    .eq("id", sendId);
  if (error) throw new Error(error.message);
}

export async function createRunLog(trigger: string): Promise<CampaignRunLog> {
  const { data, error } = await supabase
    .from("email_campaign_run_logs")
    .insert({
      campaign_key: CAMPAIGN_KEY,
      trigger,
      started_at: new Date().toISOString(),
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data as CampaignRunLog;
}

export async function finishRunLog(
  runId: string,
  input: { evaluated: number; sent: number; skipped: number; failures: number; error?: string | null }
): Promise<void> {
  const { error } = await supabase
    .from("email_campaign_run_logs")
    .update({
      completed_at: new Date().toISOString(),
      recipients_evaluated: input.evaluated,
      emails_sent: input.sent,
      skipped: input.skipped,
      failures: input.failures,
      error_summary: input.error || null,
    })
    .eq("id", runId);
  if (error) throw new Error(error.message);
}

export async function getStatusSnapshot(currentDay: number): Promise<{
  settings: CampaignSettings;
  enrolled: number;
  dayAttempted: number;
  daySuccess: number;
  dayFailed: number;
  dayPending: number;
  totalSuccess: number;
  recentRuns: CampaignRunLog[];
}> {
  const settings = await ensureCampaignSettings();
  const recipients = await listEnrolledRecipients();
  const enrolled = recipients.length;

  async function countByStatus(day: number, status?: "pending" | "success" | "failed"): Promise<number> {
    let query = supabase
      .from("email_campaign_sends")
      .select("id", { head: true, count: "exact" })
      .eq("campaign_key", CAMPAIGN_KEY)
      .eq("campaign_day", day);
    if (status) query = query.eq("status", status);
    const { count, error } = await query;
    if (error) throw new Error(error.message);
    return count || 0;
  }

  const [dayAttempted, daySuccess, dayFailed, dayPending, totalSuccess, recentRuns] = await Promise.all([
    countByStatus(currentDay),
    countByStatus(currentDay, "success"),
    countByStatus(currentDay, "failed"),
    countByStatus(currentDay, "pending"),
    (async () => {
      const { count, error } = await supabase
        .from("email_campaign_sends")
        .select("id", { head: true, count: "exact" })
        .eq("campaign_key", CAMPAIGN_KEY)
        .eq("status", "success");
      if (error) throw new Error(error.message);
      return count || 0;
    })(),
    (async () => {
      const { data, error } = await supabase
        .from("email_campaign_run_logs")
        .select("*")
        .eq("campaign_key", CAMPAIGN_KEY)
        .order("started_at", { ascending: false })
        .limit(10);
      if (error) {
        logger.error("Failed to read campaign run logs", { error: error.message });
        return [];
      }
      return (data || []) as CampaignRunLog[];
    })(),
  ]);

  return { settings, enrolled, dayAttempted, daySuccess, dayFailed, dayPending, totalSuccess, recentRuns };
}
