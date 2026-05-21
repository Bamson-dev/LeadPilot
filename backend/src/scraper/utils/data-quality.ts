import type { RawLeadInput } from "../../types/scraper";
import { isValidEmail } from "../parsers/email-validation";
import {
  emailFieldsForLeadEmit,
  parseMapsEmailsFromLead,
} from "./lead-email";
import { normalizePhoneForLocation } from "./phone-validation";
import { resolveBusinessWebsite } from "./website-utils";

const BLOCKED_STRINGS = [
  "send to phone", "copy phone", "directions", "share", "save",
  "website", "address", "hours", "reviews", "photos", "menu",
];

const BLOCKED_BUSINESS_NAMES = new Set([
  "results", "search results", "places", "businesses", "sponsored",
]);

export function isBlockedText(value: unknown): boolean {
  if (typeof value !== "string") return false;
  const lower = value.toLowerCase().trim();
  if (!lower || lower.length < 2) return true;
  return BLOCKED_STRINGS.some((b) => lower === b || lower.includes(b));
}

/** Panel-only phone — does not scan full page text. */
export function extractPhoneNumber(
  raw: string | null | undefined,
  location = ""
): string | null {
  const phone = normalizePhoneForLocation(raw, location);
  if (!phone || isBlockedText(phone)) return null;
  return phone;
}

export function normalizeWebsite(url: string | null | undefined): string | null {
  if (!url?.trim() || isBlockedText(url)) return null;
  return resolveBusinessWebsite(url);
}

export function cleanBusinessName(raw: string | null | undefined): string | null {
  if (!raw?.trim()) return null;
  const name = raw.split("·")[0]?.trim();
  if (!name || isBlockedText(name) || name.length < 2) return null;
  if (BLOCKED_BUSINESS_NAMES.has(name.toLowerCase())) return null;
  return name;
}

export function sanitizeLead(
  lead: RawLeadInput,
  location = ""
): RawLeadInput | null {
  const business_name = cleanBusinessName(lead.business_name);
  if (!business_name) return null;
  const phone = extractPhoneNumber(lead.phone, location);
  const website = normalizeWebsite(lead.website);
  const category = lead.category?.trim() || null;
  const mapsEmails = parseMapsEmailsFromLead(lead);
  const emailFields = emailFieldsForLeadEmit(mapsEmails, website, category, business_name);

  const singleEmail = emailFields.email;
  const validatedEmail =
    singleEmail && isValidEmail(singleEmail) ? singleEmail : null;

  let address = lead.address?.trim() || null;
  if (address && isBlockedText(address)) address = null;

  return {
    business_name,
    phone,
    email: validatedEmail,
    extracted_email: validatedEmail,
    generated_email: null,
    email_source: validatedEmail ? emailFields.email_source : null,
    website,
    address,
    rating: lead.rating,
    reviews_count: lead.reviews_count,
    category,
    google_maps_url: lead.google_maps_url,
  };
}

export function dedupeKey(lead: RawLeadInput): string {
  const phoneDigits = (lead.phone ?? "").replace(/\D/g, "");
  if (phoneDigits.length >= 10) return `phone:${phoneDigits}`;
  return `name:${lead.business_name.toLowerCase()}`;
}
