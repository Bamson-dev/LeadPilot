import type { Lead } from "./types";

/** Show only real stored emails — never invent from business name */
export function getDisplayEmail(
  lead: Pick<Lead, "email" | "extracted_email" | "generated_email">
): string | null {
  if (lead.email?.trim()) return lead.email.trim();
  if (lead.extracted_email?.trim()) return lead.extracted_email.trim();
  if (lead.generated_email?.trim()) return lead.generated_email.trim();
  return null;
}
