import type { BusinessLead } from "@leadpilot/shared";
import { getAllEmailsForDisplay, hasAnyEmail } from "@/utils/get-display-email";
import type { Lead } from "@/types/lead";
import { businessLeadToLead } from "@/types/lead";

function leadEmailSource(lead: Lead | BusinessLead): string {
  const asLead: Lead =
    "email_source" in lead ? (lead as Lead) : businessLeadToLead(lead as BusinessLead);
  if (asLead.email_source === "predicted") return "Generated";
  return hasAnyEmail(asLead) ? "Website" : "";
}

function leadEmail(lead: Lead | BusinessLead): string {
  if ("verifiedEmails" in lead) {
    const emails =
      lead.emails && lead.emails.length > 0
        ? lead.emails
        : [
            ...(lead.verifiedEmails ?? []),
            ...(lead.predictedEmails ?? []).map((p) => p.email),
          ];
    const seen = new Set<string>();
    const out: string[] = [];
    for (const e of emails) {
      const k = e.toLowerCase();
      if (seen.has(k)) continue;
      seen.add(k);
      out.push(e);
    }
    return out.join("; ");
  }
  const leadEmails =
    (lead as Lead).emails && (lead as Lead).emails.length > 0
      ? (lead as Lead).emails
      : getAllEmailsForDisplay(lead as Lead);
  return leadEmails.join("; ");
}

function toBusinessLead(lead: Lead | BusinessLead): BusinessLead {
  if ("searchId" in lead) return lead;
  return {
    id: lead.id,
    searchId: lead.search_id,
    name: lead.business_name,
    category: lead.category ?? "",
    address: lead.address ?? "",
    phone: lead.phone,
    email: lead.email,
    emails: lead.emails ?? lead.verified_emails ?? [],
    verifiedEmails: lead.verified_emails ?? lead.emails ?? [],
    predictedEmails: lead.predicted_emails ?? [],
    emailSource:
      lead.email_source === "extracted"
        ? "website"
        : lead.email_source === "predicted"
          ? "predicted"
          : "none",
    website: lead.website,
    rating: lead.rating,
    reviewCount: lead.reviews_count,
    googleMapsUrl: lead.google_maps_url,
    hasWebsite: Boolean(lead.website),
    hasInstagram: false,
    createdAt: lead.created_at,
  };
}

export function exportToCSV(leads: (Lead | BusinessLead)[], filename: string): void {
  const headers = [
    "Business Name",
    "Category",
    "Address",
    "Phone",
    "Email",
    "Website",
    "Rating",
    "Reviews",
    "LeadPilot URL",
    "Email Source",
  ];

  const rows = leads.map((lead) => {
    const row = toBusinessLead(lead);
    return [
      row.name || "",
      row.category || "",
      row.address || "",
      row.phone || "",
      leadEmail(lead),
      row.website || "",
      row.rating?.toString() || "",
      row.reviewCount?.toString() || "",
      row.googleMapsUrl || "",
      leadEmailSource(lead),
    ]
      .map((field) => `"${String(field).replace(/"/g, '""')}"`)
      .join(",");
  });

  const csv = [headers.join(","), ...rows].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

/** @deprecated Use exportToCSV */
export function exportCSV(
  leads: Lead[],
  business: string,
  location: string
): void {
  const slug = (s: string) =>
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
  exportToCSV(
    leads,
    `leadpilot-${slug(business)}-${slug(location)}-${Date.now()}.csv`
  );
}

export function leadsToCsv(leads: Lead[]): string {
  const headers = [
    "Business Name",
    "Category",
    "Address",
    "Phone",
    "Email",
    "Website",
    "Rating",
    "Reviews",
    "LeadPilot URL",
    "Email Source",
  ];
  const rows = leads.map((lead) => {
    const bl = businessLeadToLead(
      toBusinessLead(lead) as BusinessLead & { searchId: string }
    );
    return [
      bl.business_name,
      bl.category ?? "",
      bl.address ?? "",
      bl.phone ?? "",
      getAllEmailsForDisplay(bl).join("; "),
      bl.website ?? "",
      bl.rating != null ? String(bl.rating) : "",
      bl.reviews_count != null ? String(bl.reviews_count) : "",
      bl.google_maps_url ?? "",
      leadEmailSource(bl),
    ]
      .map((f) => `"${String(f).replace(/"/g, '""')}"`)
      .join(",");
  });
  return [headers.join(","), ...rows].join("\n");
}
