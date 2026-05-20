export const CSV_HEADERS = [
  "Business Name",
  "Category",
  "Address",
  "Phone",
  "Email",
  "Email Source",
  "Website",
  "Rating",
  "Reviews",
] as const;

export type CsvHeader = (typeof CSV_HEADERS)[number];
