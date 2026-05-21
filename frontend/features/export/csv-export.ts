import type { BusinessLead } from "@leadpilot/shared";
import { CSV_HEADERS } from "@leadpilot/shared";
import { escapeCsvField, slugify } from "@leadpilot/shared";
import type { Lead } from "@/types/lead";
import { getPredictedEmails, getVerifiedEmails } from "@/utils/get-display-email";

function leadToRow(lead: Lead | BusinessLead): string[] {
  const isShared = "searchId" in lead;

  const verified = isShared
    ? lead.verifiedEmails?.length
      ? lead.verifiedEmails.join(", ")
      : lead.email ?? ""
    : getVerifiedEmails(lead).join(", ");

  const predictions = isShared ? lead.predictedEmails ?? [] : getPredictedEmails(lead);
  const topPrediction = predictions[0];
  const predictedDisplay = topPrediction?.email ?? "";
  const confidenceDisplay =
    topPrediction != null ? String(topPrediction.confidence) : "";

  const emailSource = isShared
    ? lead.emailSource
    : lead.email_source === "extracted"
      ? "verified"
      : lead.email_source === "predicted"
        ? "predicted"
        : "none";

  return [
    isShared ? lead.name : lead.business_name,
    isShared ? lead.category : lead.category ?? "",
    isShared ? lead.address : lead.address ?? "",
    lead.phone ?? "",
    verified,
    predictedDisplay,
    confidenceDisplay,
    emailSource,
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
