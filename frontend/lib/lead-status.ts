import type { Lead } from "@/types/lead";

export type LeadStatusValue =
  | "new"
  | "contacted"
  | "interested"
  | "closed"
  | "not_interested";

export function leadStatusKey(businessName: string, phone: string | null): string {
  const name = businessName.trim().toLowerCase();
  const digits = (phone || "").replace(/\D/g, "");
  return `${name}::${digits}`;
}

export function applyStatusFilter(
  leads: Lead[],
  statusFilter: string,
  statusByLeadId: Record<string, string>
): Lead[] {
  if (statusFilter === "all") return leads;
  return leads.filter((lead) => {
    const status = statusByLeadId[lead.id] || "new";
    return status === statusFilter;
  });
}
