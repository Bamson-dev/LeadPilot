import type { LeadInput } from "../types";
import {
  emailFieldsForLeadEmit,
  parseMapsEmailsFromLead,
} from "../lead-email";
import { resolveBusinessWebsite } from "./website-utils";

/** UI labels that must never be saved as data */
const BLOCKED_STRINGS = [
  "send to phone",
  "copy phone",
  "copy number",
  "call phone",
  "directions",
  "share",
  "save",
  "order online",
  "reserve a table",
  "website",
  "address",
  "hours",
  "reviews",
  "photos",
  "menu",
  "claim this business",
  "suggest an edit",
  "nearby",
  "overview",
];

/** Google Maps UI labels — not real businesses */
const BLOCKED_BUSINESS_NAMES = new Set([
  "results",
  "search results",
  "places",
  "businesses",
  "list",
  "map",
  "directions",
  "sponsored",
  "advertisement",
  "ad",
]);

/** Nigerian + international phone patterns */
const PHONE_PATTERNS = [
  /\+234[\s-]?\d{3}[\s-]?\d{3}[\s-]?\d{4}/g,
  /\+234\d{10}/g,
  /0[7-9][01]\d{8}/g,
  /0\d{3}[\s-]?\d{3}[\s-]?\d{4}/g,
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
    if (match?.[0]) {
      const normalized = match[0].replace(/[\s-]/g, " ").trim();
      if (!isBlockedText(normalized)) return normalized;
    }
  }

  const digits = text.replace(/[^\d+]/g, "");
  if (digits.startsWith("+234") && digits.length >= 13) return text;
  if (digits.startsWith("234") && digits.length >= 12) return `+${digits}`;
  if (digits.startsWith("0") && digits.length >= 10 && digits.length <= 11) {
    return text.match(/0[7-9][01]\d{8}/)?.[0] ?? null;
  }

  return null;
}

export function normalizeWebsite(url: string | null | undefined): string | null {
  if (!url?.trim() || isBlockedText(url)) return null;
  return resolveBusinessWebsite(url);
}

export function cleanBusinessName(raw: string | null | undefined): string | null {
  if (!raw?.trim()) return null;
  const name = raw
    .replace(/^\d[.,]\d\s*(?:stars?)?\s*/i, "")
    .replace(/^[\uE000-\uF8FF\u2600-\u27BF]+\s*/u, "")
    .split("·")[0]
    ?.trim();
  if (!name || isBlockedText(name) || name.length < 2) return null;
  if (BLOCKED_BUSINESS_NAMES.has(name.toLowerCase())) return null;
  return name;
}

export function sanitizeLead(lead: LeadInput): LeadInput | null {
  const business_name = cleanBusinessName(lead.business_name);
  if (!business_name) return null;

  const phone = extractPhoneNumber(lead.phone);
  const website = normalizeWebsite(lead.website);

  let category = lead.category?.trim() || null;
  if (category && isBlockedText(category)) category = null;

  const mapsEmails = parseMapsEmailsFromLead(lead);
  const emailFields = emailFieldsForLeadEmit(
    mapsEmails,
    website,
    category,
    business_name
  );

  let address = lead.address?.trim() || null;
  if (address && isBlockedText(address)) address = null;

  return {
    business_name,
    phone,
    ...emailFields,
    website,
    address,
    rating: lead.rating,
    reviews_count: lead.reviews_count,
    category,
    google_maps_url: lead.google_maps_url,
  };
}

export function dedupeKey(lead: LeadInput): string {
  const phoneDigits = (lead.phone ?? "").replace(/\D/g, "");
  if (phoneDigits.length >= 10) return `phone:${phoneDigits}`;
  return `name:${lead.business_name.toLowerCase()}`;
}
