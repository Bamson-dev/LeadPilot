import { supabase } from "../../database/client";
import { logger } from "../../utils/logger";
import {
  buildRecipientUrgencyContext,
  calculatePersonalDeadlineAt,
  getCurrentDateInLagos,
  getRecipientCampaignDay,
  isPastPersonalDeadline,
} from "./campaign-definition";
import {
  CAMPAIGN_KEY,
  CAMPAIGN_NAME,
  CAMPAIGN_TIMEZONE,
  CAMPAIGN_TOTAL_DAYS,
  LEGACY_CAMPAIGN_START_DATE,
  LEGACY_DEADLINE_AT_ISO,
  OFFER_URL,
  WEBINAR_URL,
  type CampaignProgressSummary,
  type CampaignRecipient,
  type CampaignRunLog,
  type CampaignSend,
  type CampaignSettings,
  type EligiblePaidUser,
} from "./types";

function asIsoString(value: unknown): string {
  if (typeof value === "string") return value;
  if (value instanceof Date) return value.toISOString();
  if (value == null) return "";
  return String(value);
}

function asDatePrefix(value: unknown): string {
  return asIsoString(value).slice(0, 10);
}

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
      evergreen_mode: true,
      campaign_start_date: LEGACY_CAMPAIGN_START_DATE,
      timezone: CAMPAIGN_TIMEZONE,
      deadline_at: LEGACY_DEADLINE_AT_ISO,
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
    evergreen_mode: true,
    updated_at: new Date().toISOString(),
  };
  if (enabled) updates.activated_at = new Date().toISOString();
  const { error } = await supabase
    .from("email_campaign_settings")
    .update(updates)
    .eq("campaign_key", CAMPAIGN_KEY);
  if (error) throw new Error(error.message);
}

export async function enrollNewRecipients(
  users: EligiblePaidUser[],
  campaignStartDate: string,
  personalDeadlineAt: string
): Promise<number> {
  if (!users.length) return 0;
  const now = new Date().toISOString();
  const rows = users.map((u) => ({
    campaign_key: CAMPAIGN_KEY,
    license_id: u.licenseId,
    email: u.email,
    normalized_email: u.normalizedEmail,
    eligibility_at: now,
    enrolled_at: now,
    campaign_start_date: campaignStartDate,
    personal_deadline_at: personalDeadlineAt,
    status: "enrolled",
    updated_at: now,
  }));

  const { data, error } = await supabase
    .from("email_campaign_recipients")
    .upsert(rows, { onConflict: "campaign_key,normalized_email", ignoreDuplicates: true })
    .select("id");
  if (error) throw new Error(error.message);
  return data?.length || 0;
}

/** Activation-time bulk enroll; preserves existing recipients via ignoreDuplicates. */
export async function enrollRecipients(users: EligiblePaidUser[]): Promise<number> {
  if (!users.length) return 0;
  const startDate = getCurrentDateInLagos();
  const personalDeadlineAt = calculatePersonalDeadlineAt(startDate);
  await enrollNewRecipients(users, startDate, personalDeadlineAt);

  const { count, error: countError } = await supabase
    .from("email_campaign_recipients")
    .select("id", { head: true, count: "exact" })
    .eq("campaign_key", CAMPAIGN_KEY);
  if (countError) throw new Error(countError.message);
  return count || 0;
}

export async function listActiveRecipients(): Promise<CampaignRecipient[]> {
  const { data, error } = await supabase
    .from("email_campaign_recipients")
    .select("*")
    .eq("campaign_key", CAMPAIGN_KEY)
    .eq("status", "enrolled");
  if (error) throw new Error(error.message);
  return (data || []) as CampaignRecipient[];
}

export async function markRecipientCompleted(recipientId: string): Promise<void> {
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("email_campaign_recipients")
    .update({ status: "completed", completed_at: now, updated_at: now })
    .eq("id", recipientId)
    .eq("campaign_key", CAMPAIGN_KEY);
  if (error) throw new Error(error.message);
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

export async function hasSuccessfulSendOnDate(
  recipientId: string,
  scheduledDate: string
): Promise<boolean> {
  const { count, error } = await supabase
    .from("email_campaign_sends")
    .select("id", { head: true, count: "exact" })
    .eq("campaign_key", CAMPAIGN_KEY)
    .eq("recipient_id", recipientId)
    .eq("scheduled_date", scheduledDate)
    .eq("status", "success");
  if (error) throw new Error(error.message);
  return (count || 0) > 0;
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

async function countRecipientsByStatus(status?: CampaignRecipient["status"]): Promise<number> {
  let query = supabase
    .from("email_campaign_recipients")
    .select("id", { head: true, count: "exact" })
    .eq("campaign_key", CAMPAIGN_KEY);
  if (status) query = query.eq("status", status);
  const { count, error } = await query;
  if (error) throw new Error(error.message);
  return count || 0;
}

export async function getProgressSummary(): Promise<CampaignProgressSummary> {
  const { data, error } = await supabase
    .from("email_campaign_recipients")
    .select("*")
    .eq("campaign_key", CAMPAIGN_KEY);
  if (error) throw new Error(error.message);

  const recipients = (data || []) as CampaignRecipient[];
  const today = getCurrentDateInLagos();
  const now = new Date();
  const dayDistribution: Record<string, number> = {};
  let activeDeadlines = 0;
  let expiredDeadlines = 0;
  let nextUpcomingDeadline: string | null = null;
  let enrolledToday = 0;

  for (const recipient of recipients) {
    const enrolledAt = asDatePrefix(recipient.enrolled_at);
    const startDate = asDatePrefix(recipient.campaign_start_date);
    if (enrolledAt === today || startDate === today) {
      enrolledToday += 1;
    }
    if (recipient.status === "completed") {
      dayDistribution.completed = (dayDistribution.completed || 0) + 1;
      continue;
    }
    if (recipient.status !== "enrolled") continue;

    const day = getRecipientCampaignDay(startDate, now);
    if (day >= 1 && day <= CAMPAIGN_TOTAL_DAYS) {
      const key = String(day);
      dayDistribution[key] = (dayDistribution[key] || 0) + 1;
    } else if (day > CAMPAIGN_TOTAL_DAYS) {
      dayDistribution.post_sequence = (dayDistribution.post_sequence || 0) + 1;
    }

    if (isPastPersonalDeadline(asIsoString(recipient.personal_deadline_at), now)) {
      expiredDeadlines += 1;
    } else {
      activeDeadlines += 1;
      const deadlineIso = asIsoString(recipient.personal_deadline_at);
      if (!nextUpcomingDeadline || deadlineIso < nextUpcomingDeadline) {
        nextUpcomingDeadline = deadlineIso;
      }
    }
  }

  const [enrolled, active, completed, paused] = await Promise.all([
    countRecipientsByStatus(),
    countRecipientsByStatus("enrolled"),
    countRecipientsByStatus("completed"),
    countRecipientsByStatus("paused"),
  ]);

  return {
    enrolled,
    active,
    completed,
    paused,
    enrolledToday,
    dayDistribution,
    activeDeadlines,
    expiredDeadlines,
    nextUpcomingDeadline,
  };
}

export async function getStatusSnapshot(): Promise<{
  settings: CampaignSettings;
  enrolled: number;
  dayAttempted: number;
  daySuccess: number;
  dayFailed: number;
  dayPending: number;
  totalSuccess: number;
  duplicatesPrevented: number;
  recentRuns: CampaignRunLog[];
  progress: CampaignProgressSummary;
}> {
  const settings = await ensureCampaignSettings();
  const progress = await getProgressSummary();
  const lagosDate = getCurrentDateInLagos();

  async function countToday(status?: "pending" | "success" | "failed"): Promise<number> {
    let query = supabase
      .from("email_campaign_sends")
      .select("id", { head: true, count: "exact" })
      .eq("campaign_key", CAMPAIGN_KEY)
      .eq("scheduled_date", lagosDate);
    if (status) query = query.eq("status", status);
    const { count, error } = await query;
    if (error) throw new Error(error.message);
    return count || 0;
  }

  const [dayAttempted, daySuccess, dayFailed, dayPending, totalSuccess, recentRuns] = await Promise.all([
    countToday(),
    countToday("success"),
    countToday("failed"),
    countToday("pending"),
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

  return {
    settings,
    enrolled: progress.enrolled,
    dayAttempted,
    daySuccess,
    dayFailed,
    dayPending,
    totalSuccess,
    duplicatesPrevented: Math.max(0, dayAttempted - daySuccess - dayFailed - dayPending),
    recentRuns,
    progress,
  };
}

export function buildUrgencyForRecipient(recipient: CampaignRecipient) {
  return buildRecipientUrgencyContext(recipient.personal_deadline_at);
}
