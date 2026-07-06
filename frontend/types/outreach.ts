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
}

export interface QueueSendResponse {
  queued: number;
  skipped_suppression: number;
  short_credits: number;
  sent_email_ids: string[];
}

export interface OutreachSentEmail {
  id: string;
  recipient_email: string;
  business_name: string | null;
  subject: string;
  status: string;
  credit_bucket: string | null;
  provider_message_id: string | null;
  error_message: string | null;
  opened_at: string | null;
  open_count: number;
  sent_at: string | null;
  created_at: string;
  mailbox_id: string | null;
}

export const OUTREACH_FREE_SENDS_ON_CONNECT = 200;
