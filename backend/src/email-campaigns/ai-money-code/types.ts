export const CAMPAIGN_KEY = "ai-money-code-2026";
export const CAMPAIGN_NAME = "LeadThur AI Money Code Paid User Campaign";
export const CAMPAIGN_TIMEZONE = "Africa/Lagos";
export const CAMPAIGN_TOTAL_DAYS = 30;
export const WEBINAR_URL = "https://aimoneycode.com.ng/reg";
export const OFFER_URL = "https://aimoneycode.com.ng/offer";
export const SPECIAL_PRICE_NGN = 49999;
export const REGULAR_PRICE_NGN = 100000;

/** Legacy cohort anchor kept for settings display only; scheduling is per-recipient. */
export const LEGACY_CAMPAIGN_START_DATE = "2026-08-18";
export const LEGACY_DEADLINE_AT_ISO = "2026-09-16T22:59:00.000Z";

export type CampaignEmailTemplate = {
  day: number;
  subject: string;
  preview: string;
  body: string[];
  ctaLabel: string;
  ctaUrl: string;
};

export type CampaignEmail = CampaignEmailTemplate;

export type RecipientUrgencyContext = {
  personalDeadlineAt: string;
  personalDeadlineLagos: string;
  personalDeadlineDate: string;
  daysRemaining: number;
  hoursRemaining: number;
  isPastDeadline: boolean;
  specialPriceLabel: string;
  regularPriceLabel: string;
};

export type CampaignSettings = {
  campaign_key: string;
  campaign_name: string;
  enabled: boolean;
  activated_at: string | null;
  evergreen_mode: boolean;
  campaign_start_date: string;
  timezone: string;
  deadline_at: string;
  webinar_url: string;
  offer_url: string;
  created_at: string;
  updated_at: string;
};

export type CampaignRecipient = {
  id: string;
  campaign_key: string;
  license_id: string | null;
  email: string;
  normalized_email: string;
  eligibility_at: string | null;
  enrolled_at: string;
  campaign_start_date: string;
  personal_deadline_at: string;
  completed_at: string | null;
  status: "enrolled" | "paused" | "completed";
  created_at: string;
  updated_at: string;
};

export type CampaignSend = {
  id: string;
  campaign_key: string;
  recipient_id: string;
  normalized_email: string;
  campaign_day: number;
  scheduled_date: string;
  subject: string;
  cta_url: string;
  status: "pending" | "success" | "failed";
  provider_message_id: string | null;
  sent_at: string | null;
  retry_count: number;
  error_summary: string | null;
  created_at: string;
  updated_at: string;
};

export type CampaignRunLog = {
  id: string;
  campaign_key: string;
  trigger: string;
  started_at: string;
  completed_at: string | null;
  recipients_evaluated: number;
  emails_sent: number;
  skipped: number;
  failures: number;
  error_summary: string | null;
};

export type EligiblePaidUser = {
  licenseId: string;
  email: string;
  normalizedEmail: string;
  paymentReference: string;
  paymentChannel: string | null;
  createdAt: string;
};

export type AudienceSummary = {
  paidLicenseRecordsFound: number;
  eligibleUniqueEmails: number;
  invalidOrBlankExcluded: number;
  duplicatesRemoved: number;
  internalOrTestExcluded: number;
  finalRecipientCount: number;
};

export type CampaignProgressSummary = {
  enrolled: number;
  active: number;
  completed: number;
  paused: number;
  enrolledToday: number;
  dayDistribution: Record<string, number>;
  activeDeadlines: number;
  expiredDeadlines: number;
  nextUpcomingDeadline: string | null;
};
