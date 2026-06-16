import { supabase } from "./client";

export type LeadStatusValue =
  | "new"
  | "contacted"
  | "interested"
  | "closed"
  | "not_interested";

export type LeadStatusRow = {
  id: string;
  email: string;
  business_name: string;
  business_phone: string | null;
  business_address: string | null;
  search_id: string | null;
  status: LeadStatusValue;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export async function upsertLeadStatus(input: {
  email: string;
  business_name: string;
  business_phone?: string | null;
  business_address?: string | null;
  search_id?: string | null;
  status: LeadStatusValue;
  notes?: string | null;
}): Promise<LeadStatusRow> {
  const row = {
    email: input.email.toLowerCase().trim(),
    business_name: input.business_name.trim(),
    business_phone: input.business_phone?.trim() || null,
    business_address: input.business_address?.trim() || null,
    search_id: input.search_id ?? null,
    status: input.status,
    notes: input.notes ?? null,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("lead_statuses")
    .upsert(row, { onConflict: "email,business_name,business_phone" })
    .select("*")
    .single();

  if (error) throw error;
  return data as LeadStatusRow;
}

export async function getLeadStatusesByEmail(
  email: string,
  statusFilter?: string
): Promise<LeadStatusRow[]> {
  let query = supabase
    .from("lead_statuses")
    .select("*")
    .eq("email", email.toLowerCase().trim())
    .order("updated_at", { ascending: false });

  if (statusFilter && statusFilter !== "all") {
    query = query.eq("status", statusFilter);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as LeadStatusRow[];
}

export async function updateLeadStatusById(
  id: string,
  email: string,
  updates: { status?: LeadStatusValue; notes?: string | null }
): Promise<LeadStatusRow> {
  const { data, error } = await supabase
    .from("lead_statuses")
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("email", email.toLowerCase().trim())
    .select("*")
    .single();

  if (error) throw error;
  return data as LeadStatusRow;
}
