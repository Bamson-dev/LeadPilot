import { EMAIL_REGEX, MAX_DISPLAY_EMAILS } from "../utils/constants";

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

/** Minimal normalization only — does NOT reject noreply, test, gmail, etc. */
export function normalizeRawEmail(raw: unknown): string | null {
  const str = asString(raw);
  if (!str) return null;
  const email = str.toLowerCase().trim();
  if (!email.includes("@")) return null;
  const parts = email.split("@");
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null;
  if (!parts[1].includes(".")) return null;
  if (email.length > 150) return null;
  return email;
}

export function deobfuscateEmailText(text: string): string {
  return text
    .replace(/\s*\[at\]\s*/gi, "@")
    .replace(/\s*\(at\)\s*/gi, "@")
    .replace(/\s+at\s+/gi, "@")
    .replace(/\s*\[dot\]\s*/gi, ".")
    .replace(/\s*\(dot\)\s*/gi, ".");
}

/** Extract every email match from text — no quality filtering */
export function extractAllEmailsFromText(text: string): string[] {
  if (!text?.trim()) return [];

  const normalized = deobfuscateEmailText(text);
  const regex = new RegExp(EMAIL_REGEX.source, "gi");
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
  return [...set];
}

/** Comma-separated, capped for table display */
export function formatEmailsForDisplay(
  emails: string[],
  max = MAX_DISPLAY_EMAILS
): string | null {
  if (emails.length === 0) return null;
  return emails.slice(0, max).join(", ");
}

export function parseEmailList(value: string | null | undefined): string[] {
  if (!value?.trim()) return [];
  return value
    .split(",")
    .map((e) => e.trim())
    .filter(Boolean);
}

export function limitEmailString(
  value: string | null | undefined,
  max = MAX_DISPLAY_EMAILS
): string | null {
  const list = parseEmailList(value);
  return formatEmailsForDisplay(list, max);
}
