import { extractDomainLoose } from "../utils/domain-utils";
import { MAX_DISPLAY_EMAILS } from "../utils/constants";

const IMAGE_EXTENSIONS = [
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".svg",
  ".ico",
  ".bmp",
  ".tiff",
];

const IMAGE_PATTERNS = [
  "favicon",
  "cropped",
  "scaled",
  "thumbnail",
  "resize",
  "sprite",
  "icon-",
];

const PLACEHOLDER_EMAILS = new Set([
  "your@email.com",
  "example@example.com",
  "email@email.com",
  "info@example.com",
  "test@test.com",
  "user@user.com",
  "name@domain.com",
  "your@domain.com",
  "hello@example.com",
  "contact@example.com",
  "email@domain.com",
  "yourname@email.com",
  "someone@example.com",
]);

const GENERIC_DOMAINS = new Set([
  "example.com",
  "domain.com",
  "email.com",
  "test.com",
  "user.com",
  "name.com",
  "sample.com",
  "placeholder.com",
]);

const NOREPLY_LOCAL_PARTS = [
  "noreply",
  "no-reply",
  "donotreply",
  "do-not-reply",
  "unsubscribe",
  "mailer-daemon",
  "postmaster",
];

const CONTACT_PREFIXES = [
  "contact",
  "info",
  "hello",
  "enquiries",
  "inquiry",
  "bookings",
  "reservations",
  "appointments",
];

const VALID_TLDS = new Set([
  "com",
  "org",
  "net",
  "io",
  "app",
  "live",
  "co",
  "uk",
  "ng",
  "us",
  "ca",
  "au",
  "de",
  "fr",
  "es",
  "it",
  "nl",
  "be",
  "ch",
  "at",
  "se",
  "no",
  "dk",
  "fi",
  "pl",
  "cz",
  "ie",
  "pt",
  "gr",
  "ro",
  "hu",
  "bg",
  "hr",
  "sk",
  "lt",
  "lv",
  "ee",
  "za",
  "ke",
  "gh",
  "tz",
  "ug",
  "rw",
  "zm",
  "zw",
  "bw",
  "mu",
  "ae",
  "sa",
  "qa",
  "kw",
  "bh",
  "om",
  "in",
  "pk",
  "bd",
  "lk",
  "np",
  "sg",
  "my",
  "ph",
  "th",
  "vn",
  "id",
  "jp",
  "kr",
  "cn",
  "hk",
  "tw",
  "mx",
  "br",
  "ar",
  "cl",
  "co",
  "pe",
  "ec",
  "ve",
  "edu",
  "gov",
  "mil",
  "int",
  "info",
  "biz",
  "dev",
  "tech",
  "store",
  "shop",
  "online",
  "site",
  "xyz",
  "me",
  "tv",
  "cc",
  "ai",
]);

export function isValidEmail(email: string): boolean {
  if (!email || typeof email !== "string") return false;

  const lower = email.toLowerCase().trim();

  const atCount = (lower.match(/@/g) || []).length;
  if (atCount !== 1) return false;

  const [local, domain] = lower.split("@");

  if (!local || local.length < 2 || local.length > 64) return false;
  if (!domain || !domain.includes(".")) return false;

  const domainLabels = domain.split(".").filter(Boolean);
  if (domainLabels[0] === "www" || domain.startsWith("www.")) return false;
  if (domainLabels.some((label) => label.length < 2)) return false;

  if (IMAGE_EXTENSIONS.some((ext) => lower.endsWith(ext))) return false;
  if (IMAGE_PATTERNS.some((pattern) => local.includes(pattern))) return false;
  if (/\d+x\d+/.test(local) || /\d+x-\d+/.test(local)) return false;
  if (/@\d+x/i.test(lower) || /-\d+x\d+/i.test(domain)) return false;

  if (PLACEHOLDER_EMAILS.has(lower)) return false;

  const domainBase = domain.split(".")[0];
  if (local === domainBase) return false;

  const suspiciousLocals = new Set(["only", "online", "email", "name", "user", "test"]);
  if (suspiciousLocals.has(local) && (domain.includes("aaa.") || domain.includes("example"))) {
    return false;
  }

  if (GENERIC_DOMAINS.has(domain)) return false;

  const hasNoreplyWord = NOREPLY_LOCAL_PARTS.some((w) => local.includes(w));
  if (
    hasNoreplyWord &&
    (GENERIC_DOMAINS.has(domain) ||
      domain.endsWith(".example.com") ||
      domain.endsWith(".domain.com"))
  ) {
    return false;
  }

  if (hasNoreplyWord && local === "postmaster") return false;

  const labels = domain.split(".").filter(Boolean);
  const tld = labels[labels.length - 1];
  if (!tld || /\d/.test(tld) || tld.length < 2 || tld.length > 12) return false;

  const secondLevel = labels.length >= 2 ? labels[labels.length - 2] : "";
  const compoundTld =
    secondLevel === "co" || secondLevel === "com" || secondLevel === "org"
      ? `${secondLevel}.${tld}`
      : null;

  if (!VALID_TLDS.has(tld) && compoundTld !== "co.uk" && compoundTld !== "com.ng") {
    if (!/^[a-z]{2,12}$/.test(tld)) return false;
  }

  if (!/^[a-z0-9._%+\-]+$/.test(local)) return false;

  if (local.includes("..") || domain.includes("..")) return false;

  return true;
}

export function filterValidEmails(emails: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of emails) {
    const normalized = raw.toLowerCase().trim();
    if (!isValidEmail(normalized) || seen.has(normalized)) continue;
    seen.add(normalized);
    out.push(normalized);
  }
  return out;
}

function isContactStyleEmail(local: string): boolean {
  return CONTACT_PREFIXES.some(
    (prefix) =>
      local === prefix ||
      local.startsWith(`${prefix}.`) ||
      local.startsWith(`${prefix}+`) ||
      local.includes(prefix)
  );
}

function matchesBusinessDomain(email: string, businessDomain: string): boolean {
  const emailDomain = email.split("@")[1] ?? "";
  return (
    emailDomain === businessDomain ||
    emailDomain.endsWith(`.${businessDomain}`) ||
    businessDomain.endsWith(`.${emailDomain}`)
  );
}

/** Pick up to MAX_DISPLAY_EMAILS contact emails using priority rules. */
export function pickBestEmail(
  emails: string[],
  businessWebsite?: string | null,
  max = MAX_DISPLAY_EMAILS
): string[] {
  const valid = filterValidEmails(emails);
  if (valid.length === 0) return [];

  const businessDomain = businessWebsite
    ? extractDomainLoose(businessWebsite)
    : null;

  const contactStyle: string[] = [];
  const domainMatch: string[] = [];
  const other: string[] = [];

  for (const email of valid) {
    const local = email.split("@")[0] ?? "";
    if (isContactStyleEmail(local)) {
      contactStyle.push(email);
    } else if (businessDomain && matchesBusinessDomain(email, businessDomain)) {
      domainMatch.push(email);
    } else {
      other.push(email);
    }
  }

  const ordered = [...contactStyle, ...domainMatch, ...other];
  const seen = new Set<string>();
  const out: string[] = [];

  for (const email of ordered) {
    if (seen.has(email)) continue;
    seen.add(email);
    out.push(email);
    if (out.length >= max) break;
  }

  return out;
}
