import { MAX_DISPLAY_EMAILS } from "../utils/constants";
import { filterValidEmails, isValidEmail, pickBestEmail } from "./email-validation";

function asString(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (value == null) return null;
  return String(value);
}

/** Flatten nested / mixed email values from DOM or APIs */
export function flattenEmailValues(input: unknown): string[] {
  if (input == null) return [];
  if (typeof input === "string") return input.trim() ? [input] : [];
  if (!Array.isArray(input)) return [];
  return input.flatMap((item) => flattenEmailValues(item));
}

export function deobfuscateEmailText(text: string): string {
  return text
    .replace(/\s*\[at\]\s*/gi, "@")
    .replace(/\s*\(at\)\s*/gi, "@")
    .replace(/\s+at\s+/gi, "@")
    .replace(/\s*\[dot\]\s*/gi, ".")
    .replace(/\s*\(dot\)\s*/gi, ".");
}

/** Normalize and validate — invalid emails are dropped. */
export function normalizeRawEmail(raw: unknown): string | null {
  const str = asString(raw);
  if (!str) return null;
  const email = str.toLowerCase().trim();
  if (!isValidEmail(email)) return null;
  return email;
}

/** Extract every email match from text, then validate. */
export function extractAllEmailsFromText(text: string): string[] {
  if (!text?.trim()) return [];

  const normalized = deobfuscateEmailText(text);
  const regex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/gi;
  const found: string[] = [];

  for (const match of normalized.matchAll(regex)) {
    const email = normalizeRawEmail(match[0]);
    if (email) found.push(email);
  }

  return found;
}

export function mergeEmails(...inputs: unknown[]): string[] {
  const set = new Set<string>();
  for (const input of inputs) {
    for (const e of flattenEmailValues(input)) {
      const n = normalizeRawEmail(e);
      if (n) set.add(n);
    }
  }
  return filterValidEmails([...set]);
}

/** Top emails for storage (comma-separated) and display. */
export function formatEmailsForDisplay(
  emails: string[],
  businessWebsite?: string | null,
  max = MAX_DISPLAY_EMAILS
): string | null {
  const picked = pickBestEmail(emails, businessWebsite, max);
  if (picked.length === 0) return null;
  return picked.join(", ");
}

export function parseEmailList(value: string | null | undefined): string[] {
  if (!value?.trim()) return [];
  return filterValidEmails(
    value
      .split(",")
      .map((e) => e.trim())
      .filter(Boolean)
  );
}

export function limitEmailString(
  value: string | null | undefined,
  businessWebsite?: string | null
): string | null {
  const list = parseEmailList(value);
  return formatEmailsForDisplay(list, businessWebsite);
}
