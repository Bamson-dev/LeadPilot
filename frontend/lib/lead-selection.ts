/** Stable row key for email selection when API id is missing. */
export function getLeadSelectionId(lead: {
  id?: string | null;
  google_maps_url?: string | null;
  business_name?: string | null;
  phone?: string | null;
  address?: string | null;
}): string {
  if (lead.id?.trim()) return lead.id.trim();
  const gmaps = lead.google_maps_url?.trim();
  if (gmaps) return `gmaps:${gmaps}`;
  return `row:${lead.business_name ?? ""}|${lead.phone ?? ""}|${lead.address ?? ""}`;
}
