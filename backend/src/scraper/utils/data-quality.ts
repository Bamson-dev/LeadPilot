import type { RawLeadInput } from "../../types/scraper";
import {
  emailFieldsForLeadEmit,
  parseMapsEmailsFromLead,
} from "./lead-email";
import { resolveBusinessWebsite } from "./website-utils";

const BLOCKED_STRINGS = [
  "send to phone", "copy phone", "directions", "share", "save",
  "website", "address", "hours", "reviews", "photos", "menu",
];

const BLOCKED_BUSINESS_NAMES = new Set([
  "results", "search results", "places", "businesses", "sponsored",
]);

const PHONE_PATTERNS = [
  /\+234[\s-]?\d{3}[\s-]?\d{3}[\s-]?\d{4}/g,
  /0[7-9][01]\d{8}/g,
];

export function isBlockedText(value: unknown): boolean {
  if (typeof value !== "string") return false;
  const lower = value.toLowerCase().trim();
  if (!lower || lower.length < 2) return true;
  return BLOCKED_STRINGS.some((b) => lower === b || lower.includes(b));
}

export function extractPhoneNumber(raw: string | null | undefined): string | null {
  if (!raw?.trim()) return null;
  const text = raw.trim();
  if (isBlockedText(text)) return null;
  for (const pattern of PHONE_PATTERNS) {
    pattern.lastIndex = 0;
    const match = text.match(pattern);
    if (match?.[0] && !isBlockedText(match[0])) return match[0].replace(/[\s-]/g, " ").trim();
  }
  return null;
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

export function sanitizeLead(lead: RawLeadInput): RawLeadInput | null {
  const business_name = cleanBusinessName(lead.business_name);
  if (!business_name) return null;
  const phone = extractPhoneNumber(lead.phone);
  const website = normalizeWebsite(lead.website);
  const category = lead.category?.trim() || null;
  const mapsEmails = parseMapsEmailsFromLead(lead);
  const emailFields = emailFieldsForLeadEmit(mapsEmails, website, category, business_name);
  let address = lead.address?.trim() || null;
  if (address && isBlockedText(address)) address = null;
  return { business_name, phone, ...emailFields, website, address,
    rating: lead.rating, reviews_count: lead.reviews_count, category,
    google_maps_url: lead.google_maps_url };
}

export function dedupeKey(lead: RawLeadInput): string {
  const phoneDigits = (lead.phone ?? "").replace(/\D/g, "");
  if (phoneDigits.length >= 10) return `phone:${phoneDigits}`;
  return `name:${lead.business_name.toLowerCase()}`;
}
