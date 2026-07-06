import { supabase } from "./client";

export interface OutreachAccount {
  user_id: string;
  subscription_status: string;
  subscription_tier: string | null;
  subscription_renews_at: string | null;
  grace_until: string | null;
  paystack_subscription_code: string | null;
  max_mailboxes: number;
  monthly_allowance: number;
  monthly_allowance_remaining: number;
  monthly_allowance_reset_at: string | null;
  purchased_credits_balance: number;
  free_sends_granted: number;
  free_sends_used: number;
  free_sends_expire_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ConnectedMailbox {
  id: string;
  user_id: string;
  email_address: string;
  encrypted_app_password: string | null;
  smtp_host: string;
  smtp_port: number;
  account_type: "personal" | "workspace";
  status: string;
  daily_cap: number;
  daily_send_count: number;
  daily_count_reset_at: string | null;
  last_verified_at: string | null;
  last_error: string | null;
  created_at: string;
}

export async function ensureUserIdForEmail(email: string): Promise<string> {
  const normalized = email.toLowerCase().trim();
  const { data: existing, error: lookupError } = await supabase
    .from("users")
    .select("id")
    .eq("email", normalized)
    .maybeSingle();

  if (lookupError) throw new Error(lookupError.message);
  if (existing?.id) return existing.id;

  const { data: created, error: insertError } = await supabase
    .from("users")
    .insert({ email: normalized })
    .select("id")
    .single();

  if (insertError) throw new Error(insertError.message);
  return created.id;
}

export async function ensureOutreachAccount(userId: string): Promise<OutreachAccount> {
  const { data: existing, error: lookupError } = await supabase
    .from("outreach_accounts")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (lookupError) throw new Error(lookupError.message);
  if (existing) return existing as OutreachAccount;

  const { data: created, error: insertError } = await supabase
    .from("outreach_accounts")
    .insert({ user_id: userId })
    .select("*")
    .single();

  if (insertError) throw new Error(insertError.message);
  return created as OutreachAccount;
}

export async function getOutreachAccount(userId: string): Promise<OutreachAccount | null> {
  const { data, error } = await supabase
    .from("outreach_accounts")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return (data as OutreachAccount | null) ?? null;
}

export async function countActiveMailboxes(userId: string, excludeEmail?: string): Promise<number> {
  let query = supabase
    .from("connected_mailboxes")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("status", "active");

  if (excludeEmail) {
    query = query.neq("email_address", excludeEmail.toLowerCase().trim());
  }

  const { count, error } = await query;
  if (error) throw new Error(error.message);
  return count ?? 0;
}

export async function countAllMailboxes(userId: string): Promise<number> {
  const { count, error } = await supabase
    .from("connected_mailboxes")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);

  if (error) throw new Error(error.message);
  return count ?? 0;
}

export async function upsertConnectedMailbox(params: {
  userId: string;
  emailAddress: string;
  encryptedAppPassword: string;
  accountType: "personal" | "workspace";
  dailyCap: number;
}): Promise<ConnectedMailbox> {
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("connected_mailboxes")
    .upsert(
      {
        user_id: params.userId,
        email_address: params.emailAddress,
        encrypted_app_password: params.encryptedAppPassword,
        smtp_host: "smtp.gmail.com",
        smtp_port: 587,
        account_type: params.accountType,
        status: "active",
        daily_cap: params.dailyCap,
        daily_send_count: 0,
        daily_count_reset_at: now,
        last_verified_at: now,
        last_error: null,
      },
      { onConflict: "user_id,email_address" }
    )
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return data as ConnectedMailbox;
}

export async function listActiveMailboxes(userId: string): Promise<ConnectedMailbox[]> {
  const { data, error } = await supabase
    .from("connected_mailboxes")
    .select(
      "id, user_id, email_address, smtp_host, smtp_port, account_type, status, daily_cap, daily_send_count, daily_count_reset_at, last_verified_at, last_error, created_at"
    )
    .eq("user_id", userId)
    .eq("status", "active")
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []) as ConnectedMailbox[];
}

export async function disconnectMailbox(userId: string, mailboxId: string): Promise<void> {
  const { error } = await supabase
    .from("connected_mailboxes")
    .update({
      status: "disconnected",
      encrypted_app_password: null,
      last_error: null,
    })
    .eq("id", mailboxId)
    .eq("user_id", userId);

  if (error) throw new Error(error.message);
}

export type CreditBucket = "free_trial" | "monthly_allowance" | "purchased_credits";

export interface SentEmail {
  id: string;
  user_id: string;
  mailbox_id: string | null;
  lead_id: string | null;
  search_id: string | null;
  recipient_email: string;
  business_name: string | null;
  subject: string;
  body: string;
  status: string;
  credit_bucket: CreditBucket | null;
  provider_message_id: string | null;
  tracking_token: string | null;
  error_message: string | null;
  opened_at: string | null;
  open_count: number;
  sent_at: string | null;
  created_at: string;
}

export interface ConnectedMailboxWithSecret extends ConnectedMailbox {
  encrypted_app_password: string | null;
}

export function computeFreeTrialRemaining(account: OutreachAccount): number {
  if (account.free_sends_expire_at) {
    if (new Date(account.free_sends_expire_at) <= new Date()) return 0;
  }
  return Math.max(0, account.free_sends_granted - account.free_sends_used);
}

export function computeAvailableSends(account: OutreachAccount): number {
  return (
    computeFreeTrialRemaining(account) +
    account.monthly_allowance_remaining +
    account.purchased_credits_balance
  );
}

export async function isRecipientSuppressed(
  userId: string,
  recipientEmail: string
): Promise<boolean> {
  const normalized = recipientEmail.toLowerCase().trim();
  const { data, error } = await supabase
    .from("email_suppression")
    .select("id")
    .eq("user_id", userId)
    .eq("recipient_email", normalized)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return Boolean(data);
}

export interface EmailTemplateRow {
  id: string;
  name: string;
  subject: string;
  body: string;
  niche: string | null;
}

export async function listSystemEmailTemplates(): Promise<EmailTemplateRow[]> {
  const { data, error } = await supabase
    .from("email_templates")
    .select("id, name, subject, body, niche")
    .is("user_id", null)
    .order("name", { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []) as EmailTemplateRow[];
}

export async function getEmailTemplateById(
  templateId: string
): Promise<{ subject: string; body: string } | null> {
  const { data, error } = await supabase
    .from("email_templates")
    .select("subject, body")
    .eq("id", templateId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data as { subject: string; body: string } | null;
}

export async function listRecentSentEmails(
  userId: string,
  limit = 50
): Promise<SentEmail[]> {
  const { data, error } = await supabase
    .from("sent_emails")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);
  return (data ?? []) as SentEmail[];
}

export async function createQueuedSentEmail(params: {
  userId: string;
  recipientEmail: string;
  businessName?: string | null;
  subject: string;
  body: string;
  trackingToken: string;
}): Promise<SentEmail> {
  const { data, error } = await supabase
    .from("sent_emails")
    .insert({
      user_id: params.userId,
      recipient_email: params.recipientEmail.toLowerCase().trim(),
      business_name: params.businessName ?? null,
      subject: params.subject,
      body: params.body,
      status: "queued",
      tracking_token: params.trackingToken,
    })
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return data as SentEmail;
}

export async function getSentEmailById(sentEmailId: string): Promise<SentEmail | null> {
  const { data, error } = await supabase
    .from("sent_emails")
    .select("*")
    .eq("id", sentEmailId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return (data as SentEmail | null) ?? null;
}

export async function getMailboxWithSecret(
  mailboxId: string,
  userId: string
): Promise<ConnectedMailboxWithSecret | null> {
  const { data, error } = await supabase
    .from("connected_mailboxes")
    .select("*")
    .eq("id", mailboxId)
    .eq("user_id", userId)
    .eq("status", "active")
    .maybeSingle();

  if (error) throw new Error(error.message);
  return (data as ConnectedMailboxWithSecret | null) ?? null;
}

export async function listActiveMailboxesWithSecrets(
  userId: string
): Promise<ConnectedMailboxWithSecret[]> {
  const { data, error } = await supabase
    .from("connected_mailboxes")
    .select("*")
    .eq("user_id", userId)
    .eq("status", "active")
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []) as ConnectedMailboxWithSecret[];
}

export async function resetMailboxDailyCountIfNeeded(
  mailbox: ConnectedMailboxWithSecret
): Promise<ConnectedMailboxWithSecret> {
  if (!mailbox.daily_count_reset_at) return mailbox;

  const resetAt = new Date(mailbox.daily_count_reset_at);
  if (resetAt > new Date()) return mailbox;

  const nextReset = new Date();
  nextReset.setHours(nextReset.getHours() + 24);

  const { data, error } = await supabase
    .from("connected_mailboxes")
    .update({
      daily_send_count: 0,
      daily_count_reset_at: nextReset.toISOString(),
    })
    .eq("id", mailbox.id)
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return data as ConnectedMailboxWithSecret;
}

export async function incrementMailboxSendCount(mailboxId: string): Promise<void> {
  const { data: mailbox, error: fetchError } = await supabase
    .from("connected_mailboxes")
    .select("daily_send_count")
    .eq("id", mailboxId)
    .single();

  if (fetchError) throw new Error(fetchError.message);

  const { error } = await supabase
    .from("connected_mailboxes")
    .update({ daily_send_count: (mailbox.daily_send_count ?? 0) + 1 })
    .eq("id", mailboxId);

  if (error) throw new Error(error.message);
}

export async function assignSentEmailMailbox(
  sentEmailId: string,
  mailboxId: string
): Promise<void> {
  const { error } = await supabase
    .from("sent_emails")
    .update({ mailbox_id: mailboxId, status: "sending" })
    .eq("id", sentEmailId);

  if (error) throw new Error(error.message);
}

export async function markSentEmailSent(params: {
  sentEmailId: string;
  providerMessageId: string;
  creditBucket: CreditBucket;
}): Promise<void> {
  const { error } = await supabase
    .from("sent_emails")
    .update({
      status: "sent",
      provider_message_id: params.providerMessageId,
      credit_bucket: params.creditBucket,
      sent_at: new Date().toISOString(),
    })
    .eq("id", params.sentEmailId);

  if (error) throw new Error(error.message);
}

export async function markSentEmailFailed(sentEmailId: string, errorMessage: string): Promise<void> {
  const { error } = await supabase
    .from("sent_emails")
    .update({
      status: "failed",
      error_message: errorMessage,
    })
    .eq("id", sentEmailId);

  if (error) throw new Error(error.message);
}

export async function deductOneSendCredit(userId: string): Promise<CreditBucket> {
  const account = await ensureOutreachAccount(userId);
  const freeRemaining = computeFreeTrialRemaining(account);

  let bucket: CreditBucket;
  const updates: Partial<OutreachAccount> = {};

  if (freeRemaining > 0) {
    bucket = "free_trial";
    updates.free_sends_used = account.free_sends_used + 1;
  } else if (account.monthly_allowance_remaining > 0) {
    bucket = "monthly_allowance";
    updates.monthly_allowance_remaining = account.monthly_allowance_remaining - 1;
  } else if (account.purchased_credits_balance > 0) {
    bucket = "purchased_credits";
    updates.purchased_credits_balance = account.purchased_credits_balance - 1;
  } else {
    throw new Error("No send credits available");
  }

  const { error: updateError } = await supabase
    .from("outreach_accounts")
    .update(updates)
    .eq("user_id", userId);

  if (updateError) throw new Error(updateError.message);
  return bucket;
}

export async function logCreditSpend(params: {
  userId: string;
  bucket: CreditBucket;
  sentEmailId: string;
}): Promise<void> {
  const { error } = await supabase.from("outreach_credit_transactions").insert({
    user_id: params.userId,
    type: "spend",
    bucket: params.bucket,
    amount: -1,
    reference: params.sentEmailId,
  });

  if (error) throw new Error(error.message);
}

export async function refundSendCredit(params: {
  userId: string;
  bucket: CreditBucket;
  sentEmailId: string;
}): Promise<void> {
  const account = await getOutreachAccount(params.userId);
  if (!account) throw new Error("Outreach account not found");

  const updates: Partial<OutreachAccount> = {};
  if (params.bucket === "free_trial") {
    updates.free_sends_used = Math.max(0, account.free_sends_used - 1);
  } else if (params.bucket === "monthly_allowance") {
    updates.monthly_allowance_remaining = account.monthly_allowance_remaining + 1;
  } else {
    updates.purchased_credits_balance = account.purchased_credits_balance + 1;
  }

  const { error: updateError } = await supabase
    .from("outreach_accounts")
    .update(updates)
    .eq("user_id", params.userId);

  if (updateError) throw new Error(updateError.message);

  const { error: ledgerError } = await supabase.from("outreach_credit_transactions").insert({
    user_id: params.userId,
    type: "refund",
    bucket: params.bucket,
    amount: 1,
    reference: params.sentEmailId,
  });

  if (ledgerError) throw new Error(ledgerError.message);
}

export async function recordOutreachEmailOpen(trackingToken: string): Promise<void> {
  const { data: existing, error: lookupError } = await supabase
    .from("sent_emails")
    .select("id, opened_at, open_count")
    .eq("tracking_token", trackingToken)
    .maybeSingle();

  if (lookupError) throw new Error(lookupError.message);
  if (!existing) return;

  const now = new Date().toISOString();
  const updates: { open_count: number; opened_at?: string } = {
    open_count: (existing.open_count ?? 0) + 1,
  };
  if (!existing.opened_at) {
    updates.opened_at = now;
  }

  const { error } = await supabase
    .from("sent_emails")
    .update(updates)
    .eq("id", existing.id);

  if (error) throw new Error(error.message);
}

export async function grantFirstMailboxTrialCredits(userId: string): Promise<void> {
  const expireAt = new Date();
  expireAt.setDate(expireAt.getDate() + 30);

  const { error: accountError } = await supabase
    .from("outreach_accounts")
    .update({
      free_sends_granted: 200,
      free_sends_expire_at: expireAt.toISOString(),
    })
    .eq("user_id", userId);

  if (accountError) throw new Error(accountError.message);

  const { error: ledgerError } = await supabase.from("outreach_credit_transactions").insert({
    user_id: userId,
    type: "trial_grant",
    bucket: "free_trial",
    amount: 200,
    reference: "first_mailbox_connect",
  });

  if (ledgerError) throw new Error(ledgerError.message);
}

export interface OutreachPaystackPlanRow {
  tier: string;
  plan_code: string;
  amount_kobo: number;
  monthly_allowance: number;
  max_mailboxes: number;
  updated_at: string;
}

export async function getOutreachPaystackPlanCode(
  tier: string
): Promise<OutreachPaystackPlanRow | null> {
  const { data, error } = await supabase
    .from("outreach_paystack_plans")
    .select("*")
    .eq("tier", tier)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return (data as OutreachPaystackPlanRow | null) ?? null;
}

export async function upsertOutreachPaystackPlan(row: {
  tier: string;
  planCode: string;
  amountKobo: number;
  monthlyAllowance: number;
  maxMailboxes: number;
}): Promise<void> {
  const { error } = await supabase.from("outreach_paystack_plans").upsert(
    {
      tier: row.tier,
      plan_code: row.planCode,
      amount_kobo: row.amountKobo,
      monthly_allowance: row.monthlyAllowance,
      max_mailboxes: row.maxMailboxes,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "tier" }
  );

  if (error) throw new Error(error.message);
}

export async function listOutreachPaystackPlans(): Promise<OutreachPaystackPlanRow[]> {
  const { data, error } = await supabase.from("outreach_paystack_plans").select("*");

  if (error) throw new Error(error.message);
  return (data ?? []) as OutreachPaystackPlanRow[];
}

export async function isOutreachLedgerReferenceProcessed(reference: string): Promise<boolean> {
  const ref = reference.trim();
  if (!ref) return false;

  const { data, error } = await supabase
    .from("outreach_credit_transactions")
    .select("id")
    .eq("reference", ref)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return Boolean(data);
}

function addMonths(date: Date, months: number): Date {
  const next = new Date(date);
  next.setMonth(next.getMonth() + months);
  return next;
}

export async function creditPurchasedPack(params: {
  userId: string;
  credits: number;
  reference: string;
}): Promise<{ credited: boolean; duplicate: boolean }> {
  if (await isOutreachLedgerReferenceProcessed(params.reference)) {
    return { credited: false, duplicate: true };
  }

  await ensureOutreachAccount(params.userId);
  const account = await getOutreachAccount(params.userId);
  if (!account) throw new Error("Outreach account not found");

  const { error: updateError } = await supabase
    .from("outreach_accounts")
    .update({
      purchased_credits_balance: account.purchased_credits_balance + params.credits,
    })
    .eq("user_id", params.userId);

  if (updateError) throw new Error(updateError.message);

  const { error: ledgerError } = await supabase.from("outreach_credit_transactions").insert({
    user_id: params.userId,
    type: "purchase",
    bucket: "purchased_credits",
    amount: params.credits,
    reference: params.reference,
  });

  if (ledgerError) throw new Error(ledgerError.message);
  return { credited: true, duplicate: false };
}

export async function activateOutreachSubscription(params: {
  userId: string;
  tier: string;
  monthlyAllowance: number;
  maxMailboxes: number;
  reference: string;
  renewsAt?: string | null;
  subscriptionCode?: string | null;
}): Promise<{ applied: boolean; duplicate: boolean }> {
  if (await isOutreachLedgerReferenceProcessed(params.reference)) {
    return { applied: false, duplicate: true };
  }

  await ensureOutreachAccount(params.userId);

  const resetAt = addMonths(new Date(), 1);
  const updates: Record<string, unknown> = {
    subscription_status: "active",
    subscription_tier: params.tier,
    max_mailboxes: params.maxMailboxes,
    monthly_allowance: params.monthlyAllowance,
    monthly_allowance_remaining: params.monthlyAllowance,
    monthly_allowance_reset_at: resetAt.toISOString(),
    grace_until: null,
  };

  if (params.renewsAt) {
    updates.subscription_renews_at = params.renewsAt;
  }
  if (params.subscriptionCode) {
    updates.paystack_subscription_code = params.subscriptionCode;
  }

  const { error: updateError } = await supabase
    .from("outreach_accounts")
    .update(updates)
    .eq("user_id", params.userId);

  if (updateError) throw new Error(updateError.message);

  const { error: ledgerError } = await supabase.from("outreach_credit_transactions").insert({
    user_id: params.userId,
    type: "monthly_refill",
    bucket: "monthly_allowance",
    amount: params.monthlyAllowance,
    reference: params.reference,
  });

  if (ledgerError) throw new Error(ledgerError.message);
  return { applied: true, duplicate: false };
}

export async function storePaystackSubscription(params: {
  userId: string;
  subscriptionCode: string;
  renewsAt?: string | null;
}): Promise<void> {
  await ensureOutreachAccount(params.userId);

  const updates: Record<string, unknown> = {
    paystack_subscription_code: params.subscriptionCode,
  };
  if (params.renewsAt) {
    updates.subscription_renews_at = params.renewsAt;
  }

  const { error } = await supabase
    .from("outreach_accounts")
    .update(updates)
    .eq("user_id", params.userId);

  if (error) throw new Error(error.message);
}

export async function findOutreachUserByPaystackSubscription(
  subscriptionCode: string
): Promise<string | null> {
  const { data, error } = await supabase
    .from("outreach_accounts")
    .select("user_id")
    .eq("paystack_subscription_code", subscriptionCode)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data?.user_id ?? null;
}

export async function enterOutreachGracePeriod(userId: string): Promise<void> {
  const graceUntil = new Date();
  graceUntil.setDate(graceUntil.getDate() + 3);

  const { error } = await supabase
    .from("outreach_accounts")
    .update({
      subscription_status: "grace",
      grace_until: graceUntil.toISOString(),
    })
    .eq("user_id", userId);

  if (error) throw new Error(error.message);
}

export async function expireOutreachGraceAccounts(): Promise<number> {
  const now = new Date().toISOString();

  const { data: accounts, error: fetchError } = await supabase
    .from("outreach_accounts")
    .select("user_id")
    .eq("subscription_status", "grace")
    .lt("grace_until", now);

  if (fetchError) throw new Error(fetchError.message);
  if (!accounts?.length) return 0;

  const userIds = accounts.map((a) => a.user_id);
  const { error: updateError } = await supabase
    .from("outreach_accounts")
    .update({
      subscription_status: "none",
      monthly_allowance_remaining: 0,
      grace_until: null,
    })
    .in("user_id", userIds);

  if (updateError) throw new Error(updateError.message);
  return userIds.length;
}

export interface OutreachBalanceBreakdown {
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

export async function getOutreachBalance(userId: string): Promise<OutreachBalanceBreakdown> {
  const account = await ensureOutreachAccount(userId);
  const mailboxCount = await countActiveMailboxes(userId);
  const freeTrialRemaining = computeFreeTrialRemaining(account);

  return {
    send_balance:
      freeTrialRemaining +
      account.monthly_allowance_remaining +
      account.purchased_credits_balance,
    free_trial_remaining: freeTrialRemaining,
    monthly_allowance_remaining: account.monthly_allowance_remaining,
    purchased_credits: account.purchased_credits_balance,
    subscription_tier: account.subscription_tier,
    subscription_status: account.subscription_status,
    max_mailboxes: account.max_mailboxes,
    mailbox_count: mailboxCount,
    monthly_allowance_reset_at: account.monthly_allowance_reset_at,
    subscription_renews_at: account.subscription_renews_at,
    grace_until: account.grace_until,
    free_sends_expire_at: account.free_sends_expire_at,
  };
}
