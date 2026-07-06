import { supabase } from "./client";

export interface OutreachAccount {
  user_id: string;
  subscription_status: string;
  subscription_tier: string | null;
  subscription_renews_at: string | null;
  grace_until: string | null;
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
