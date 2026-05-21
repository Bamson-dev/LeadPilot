import type { BusinessLead } from "@leadpilot/shared";
import { CSV_HEADERS } from "@leadpilot/shared";
import { escapeCsvField, slugify } from "@leadpilot/shared";
import type { Lead } from "@/types/lead";
import { getAllEmailsForDisplay } from "@/utils/get-display-email";

function leadToRow(lead: Lead | BusinessLead): string[] {
  const isShared = "searchId" in lead;

  const emails = isShared
    ? getAllEmailsForDisplay({
        email: lead.email,
        extracted_email: lead.email,
        verified_emails: lead.verifiedEmails ?? [],
        predicted_emails: lead.predictedEmails ?? [],
      })
    : getAllEmailsForDisplay(lead);

  const topPrediction = isShared
    ? lead.predictedEmails?.[0]
    : lead.predicted_emails?.[0];

  const emailDisplay = emails.join(", ");

  return [
    isShared ? lead.name : lead.business_name,
    isShared ? lead.category : lead.category ?? "",
    isShared ? lead.address : lead.address ?? "",
    lead.phone ?? "",
    emailDisplay,
    topPrediction?.email ?? "",
    topPrediction != null ? String(topPrediction.confidence) : "",
    isShared
      ? lead.emailSource === "website"
        ? "verified"
        : lead.emailSource === "predicted"
          ? "predicted"
          : "none"
      : lead.email_source === "extracted"
        ? "verified"
        : lead.email_source === "predicted"
          ? "predicted"
          : "none",
    lead.website ?? "",
    lead.rating != null ? String(lead.rating) : "",
    isShared
      ? lead.reviewCount != null
        ? String(lead.reviewCount)
        : ""
      : lead.reviews_count != null
        ? String(lead.reviews_count)
        : "",
  ];
}

export function leadsToCsv(leads: Lead[]): string {
  const header = CSV_HEADERS.join(",");
  const body = leads
    .map((lead) => leadToRow(lead).map(escapeCsvField).join(","))
    .join("\n");
  return `${header}\n${body}`;
}

export function exportCSV(
  leads: Lead[],
  business: string,
  location: string
): void {
  const csv = leadsToCsv(leads);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `leadpilot-${slugify(business)}-${slugify(location)}-prospects.csv`;
  link.click();
  URL.revokeObjectURL(url);
}
