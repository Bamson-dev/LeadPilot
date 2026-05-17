import type { Lead } from "./types";
import { MAX_EXPORT_ROWS } from "./constants";

const CSV_HEADERS = [
  "business_name",
  "phone",
  "email",
  "extracted_email",
  "generated_email",
  "email_source",
  "website",
  "address",
  "rating",
  "reviews_count",
  "category",
  "google_maps_url",
] as const;

function escapeCsv(value: string | number | null | undefined): string {
  const str = value == null ? "" : String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function leadsToCsv(leads: Lead[]): string {
  const rows = leads.slice(0, MAX_EXPORT_ROWS);
  const header = CSV_HEADERS.join(",");
  const body = rows
    .map((lead) =>
      CSV_HEADERS.map((key) => escapeCsv(lead[key as keyof Lead] as string | number | null))
        .join(",")
    )
    .join("\n");
  return `${header}\n${body}`;
}

export function downloadCsv(leads: Lead[], business: string, location: string) {
  const csv = leadsToCsv(leads);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `leadpilot-${business}-${location}-prospects.csv`;
  link.click();
  URL.revokeObjectURL(url);
}
