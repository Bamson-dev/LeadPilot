export interface OutreachMailbox {
  id: string;
  email_address: string;
  account_type: "personal" | "workspace";
  status: string;
  daily_cap: number;
  daily_send_count: number;
  daily_count_reset_at: string | null;
  last_verified_at: string | null;
  last_error: string | null;
}

export interface OutreachBalance {
  send_balance: number;
  free_trial_remaining: number;
  monthly_allowance_remaining: number;
  purchased_credits: number;
  subscription_tier: string | null;
  subscription_status: string;
  max_mailboxes: number;
  mailbox_count: number;
  monthly_allowance_reset_at: string | null;
  subscription_renews_at: string | null;
  grace_until: string | null;
  free_sends_expire_at: string | null;
}

export type OutreachSubscriptionTierId = "starter" | "growth" | "scale";
export type OutreachCreditPackId = "small" | "medium" | "large";

export interface OutreachSubscriptionTier {
  id: OutreachSubscriptionTierId;
  label: string;
  amount_ngn: number;
  monthly_allowance: number;
  max_mailboxes: number;
}

export interface OutreachCreditPack {
  id: OutreachCreditPackId;
  label: string;
  amount_ngn: number;
  credits: number;
}

export interface OutreachCheckoutResponse {
  authorization_url: string;
  reference: string;
  access_code?: string;
}

export interface OutreachEmailTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
  niche: string | null;
}

export interface OutreachSendTarget {
  recipient_email: string;
  business_name?: string;
  business_id?: string;
  email_kind?: "verified" | "predicted";
}

export interface QueueSendResponse {
  queued: number;
  skipped_suppression: number;
  skipped_no_verified_email: number;
  skipped_invalid_email: number;
  short_credits: number;
  sent_email_ids: string[];
}

export interface OutreachSentEmail {
  id: string;
  recipient_email: string;
  business_name: string | null;
  subject: string;
  status: string;
  credit_bucket?: string | null;
  provider_message_id?: string | null;
  error_message: string | null;
  opened_at: string | null;
  open_count: number;
  sent_at: string | null;
  created_at: string;
  mailbox_id: string | null;
  mailbox_email?: string | null;
}

export interface OutreachSendsSummary {
  total_sent: number;
  total_opened: number;
  open_rate: number;
}

export interface OutreachSendsPagination {
  limit: number;
  offset: number;
  total: number;
}

export interface OutreachSendsReport {
  sends: OutreachSentEmail[];
  pagination: OutreachSendsPagination;
  summary: OutreachSendsSummary;
}

export type OutreachSendStatusFilter =
  | "all"
  | "queued"
  | "sending"
  | "sent"
  | "failed"
  | "bounced";

export interface FetchSendsReportParams {
  limit?: number;
  offset?: number;
  status?: OutreachSendStatusFilter;
  sort?: "recent" | "sent_at";
}

export type OutreachEmailTone = "direct" | "friendly" | "consultative" | "bold";

export interface GenerateOutreachEmailInput {
  service_description: string;
  target_business_type: string;
  tone?: OutreachEmailTone | null;
}

export interface GenerateOutreachEmailResult {
  subject: string;
  body: string;
}

export const OUTREACH_FREE_SENDS_ON_CONNECT = 200;
